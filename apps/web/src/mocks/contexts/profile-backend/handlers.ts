import { HttpResponse, http } from 'msw'
import { ProfileBackendError, type ProfileBackendService } from './service'

/** Failure modes driven by the active mock scenario (specs/014-user-profile, research D10). */
export interface ProfileFailurePolicy {
  /** Every `/profile*` route answers 503, as if the profile service were down; the rest of `/backend` is fine. */
  unavailable: () => boolean
}

const noFailures: ProfileFailurePolicy = { unavailable: () => false }

/** Anything carrying the real API's error contract: the profile service's own errors and the ledger's identity ones. */
interface HttpFailure {
  status: number
  code: string
  message: string
  fields?: Record<string, string>
}

const isHttpFailure = (error: unknown): error is HttpFailure =>
  error instanceof Error &&
  'status' in error &&
  typeof error.status === 'number' &&
  'code' in error &&
  typeof error.code === 'string'

const serviceUnavailable = () =>
  new ProfileBackendError(503, 'service_unavailable', 'The profile service is temporarily unavailable.')

/**
 * `base` is the app's `/backend` prefix, which Vite/vercel.json map to the real API's `/api`. `ownerOf` reads the
 * acting owner from the request's token ONLY (the same token issuer as the coins mock), like the real API.
 */
export function profileBackendHandlers(
  base: string,
  service: ProfileBackendService,
  ownerOf: (request: Request) => string,
  failures: ProfileFailurePolicy = noFailures,
) {
  /** Runs `fn`, turning the real API's error contract into a response; anything else is a bug and propagates. */
  const run = (fn: () => Response | Promise<Response>) => async () => {
    try {
      if (failures.unavailable()) throw serviceUnavailable()
      return await fn()
    } catch (error) {
      if (isHttpFailure(error)) {
        return HttpResponse.json(
          { error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } },
          { status: error.status },
        )
      }
      throw error
    }
  }

  /** The body as `unknown`; a body that is not JSON is `400 invalid_json`, like the real API's parser. */
  const bodyOf = async (request: Request): Promise<unknown> => {
    try {
      return await request.json()
    } catch {
      throw new ProfileBackendError(400, 'invalid_json', 'Request body MUST be valid JSON.')
    }
  }

  return [
    http.get(`${base}/profile`, ({ request }) => run(() => HttpResponse.json(service.get(ownerOf(request))))()),

    http.put(`${base}/profile`, ({ request }) =>
      run(async () => {
        const ownerId = ownerOf(request)
        return HttpResponse.json(service.save(ownerId, await bodyOf(request)))
      })(),
    ),

    http.get(`${base}/profile/avatar`, ({ request }) => run(() => HttpResponse.json(service.getAvatar(ownerOf(request))))()),

    http.put(`${base}/profile/avatar`, ({ request }) =>
      run(async () => {
        const ownerId = ownerOf(request)
        return HttpResponse.json(service.saveAvatar(ownerId, await bodyOf(request)))
      })(),
    ),

    http.delete(`${base}/profile/avatar`, ({ request }) =>
      run(() => HttpResponse.json(service.deleteAvatar(ownerOf(request))))(),
    ),
  ]
}
