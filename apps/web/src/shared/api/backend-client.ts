import axios, { type AxiosRequestConfig } from 'axios'
import { ZodError, z } from 'zod'
import { env } from '@/shared/config/env'
import { subscribeSessionToken } from './session'

/**
 * Client of the real backend (`apps/api`), reached through the same-origin `/backend` proxy, for domains whose
 * data lives there (specs/014-user-profile, research D8). A separate Axios instance on purpose: it never reuses
 * `./http` (whose `/api` prefix is owned by MSW and whose 401s log the site session out).
 *
 * `apps/api` requires a short-lived signed token per owner (`POST /auth/token`); the acting owner is read from the
 * verified token only. Tokens are cached per owner in memory (never in storage) and refreshed shortly before they
 * expire. `domains/ledger` keeps its own, older copy of this logic; it is deliberately not migrated here.
 */
export const backendHttp = axios.create({
  baseURL: env.backendBaseUrl,
  timeout: env.requestTimeoutMs,
  headers: { 'Content-Type': 'application/json' },
})

const backendTokenSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.string(),
})

const backendErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Only on `validation_error`: the problem code of each invalid field. */
    fields: z.record(z.string(), z.string()).optional(),
  }),
})

/** Normalised error of the real backend; never inspect an `AxiosError` outside this file. */
export class BackendError extends Error {
  readonly status: number | null
  readonly code: string
  readonly fields: Record<string, string>

  constructor(params: { status: number | null; code: string; message: string; fields?: Record<string, string> }) {
    super(params.message)
    this.name = 'BackendError'
    this.status = params.status
    this.code = params.code
    this.fields = params.fields ?? {}
  }

  /** Network failures, timeouts and 5xx can succeed on a later attempt; 4xx cannot. */
  get isRetryable() {
    return this.status === null || this.status >= 500
  }

  /** `400 validation_error`: `fields` says which inputs to fix. */
  get isValidation() {
    return this.status === 400
  }
}

/** TanStack Query `retry`: only transient failures are worth another attempt, and never more than twice. */
export const retryTransientBackend = (failureCount: number, error: unknown) =>
  error instanceof BackendError && error.isRetryable && failureCount < 2

function toBackendError(error: unknown): BackendError {
  if (error instanceof BackendError) return error
  if (axios.isCancel(error)) return new BackendError({ status: null, code: 'CANCELED', message: 'Requisição cancelada.' })
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const body = backendErrorBodySchema.safeParse(error.response.data)
      return new BackendError({
        status: error.response.status,
        code: body.success ? body.data.error.code : 'UNEXPECTED_RESPONSE',
        message: body.success ? body.data.error.message : 'Falha inesperada no servidor.',
        fields: body.success ? body.data.error.fields : undefined,
      })
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new BackendError({ status: null, code: 'TIMEOUT', message: 'O servidor demorou para responder.' })
    }
    return new BackendError({ status: null, code: 'NETWORK', message: 'Sem conexão com o servidor.' })
  }
  if (error instanceof ZodError) {
    return new BackendError({ status: 502, code: 'INVALID_RESPONSE', message: 'Resposta inesperada do servidor.' })
  }
  return new BackendError({ status: null, code: 'INTERNAL', message: 'Erro inesperado.' })
}

// --- Token session ------------------------------------------------------------------------------------------

const REFRESH_MARGIN_MS = 30_000

interface CachedToken {
  token: string
  expiresAtMs: number
}

const tokens = new Map<string, CachedToken>()
const inFlight = new Map<string, Promise<string>>()

async function issueToken(ownerId: string): Promise<string> {
  try {
    const { data } = await backendHttp.post('/auth/token', { ownerId })
    const parsed = backendTokenSchema.parse(data)
    tokens.set(ownerId, { token: parsed.token, expiresAtMs: Date.parse(parsed.expiresAt) })
    return parsed.token
  } catch (error) {
    throw toBackendError(error)
  } finally {
    inFlight.delete(ownerId)
  }
}

async function tokenFor(ownerId: string): Promise<string> {
  const cached = tokens.get(ownerId)
  if (cached && cached.expiresAtMs - Date.now() > REFRESH_MARGIN_MS) return cached.token
  // Concurrent callers share one issuance instead of each minting its own token.
  const pending = inFlight.get(ownerId) ?? issueToken(ownerId)
  inFlight.set(ownerId, pending)
  return pending
}

/** Drops every cached token (logout / user switch must not leave credentials in memory). */
export function clearBackendTokens() {
  tokens.clear()
  inFlight.clear()
}

// Login, logout and user switches all change the site session token: drop the cached backend tokens then
// (constitution, Principle IV). Subscribing here, instead of calling from the auth domain, avoids a cycle.
subscribeSessionToken(clearBackendTokens)

// --- Requests -----------------------------------------------------------------------------------------------

/**
 * Authenticated, schema-validated request for `ownerId`. The only automatic retry is the token rule: a 401
 * (expired token) re-issues the token once. Everything else is thrown at once as a {@link BackendError}.
 */
export async function backendRequest<T>(ownerId: string, config: AxiosRequestConfig, schema: z.ZodType<T>): Promise<T> {
  let refreshedAfter401 = false

  for (;;) {
    try {
      const token = await tokenFor(ownerId)
      const { data } = await backendHttp.request({
        ...config,
        headers: { ...config.headers, Authorization: `Bearer ${token}` },
      })
      return schema.parse(data)
    } catch (error) {
      const backendError = toBackendError(error)

      if (backendError.status === 401 && !refreshedAfter401) {
        refreshedAfter401 = true
        tokens.delete(ownerId)
        continue
      }
      throw backendError
    }
  }
}
