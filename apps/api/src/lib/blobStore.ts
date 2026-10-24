import { createHash } from "node:crypto"
import { list, put } from "@vercel/blob"
import type { z } from "zod"
import { adminUserSchema, type AdminUser } from "../domains/admin/contracts.js"
import {
  ConcurrencyConflictError,
  coinBalanceRecordSchema,
  coinTransactionRecordSchema,
  type CoinBalanceRecord,
  type CoinTransactionRecord,
} from "../domains/coins/contracts.js"
import { internal } from "./errors.js"

function assertBlobTokenConfigured(): void {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw internal(
      "missing_blob_token",
      "BLOB_READ_WRITE_TOKEN is not configured. Set it in apps/api/.env.local (see .env.example).",
    )
  }
}

function balancePathname(ownerId: string): string {
  return `coins/balances/${ownerId}.json`
}

function transactionsPrefix(ownerId: string): string {
  return `coins/transactions/${ownerId}/`
}

function transactionPathname(ownerId: string, createdAt: string, txId: string): string {
  // ISO timestamps sort lexicographically in chronological order (research.md D6).
  return `${transactionsPrefix(ownerId)}${createdAt}-${txId}.json`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// A blob's public CDN URL can briefly 403/404 immediately after `put()` resolves —
// the edge hasn't replicated it yet. This is a real, observed read-after-write gap
// (confirmed against a live Blob store, not speculative), not a permissions bug: a
// retry a moment later succeeds against the exact same URL. This retry is deliberately
// short — it is NOT a defense against Vercel's own bot-protection challenge (which
// this same CDN domain can return under a tight burst of same-IP requests, with
// `Retry-After: 30`; see apps/api/README.md's "Known, documented limitations" for
// why that case is out of scope for a retry loop here).
const READ_AFTER_WRITE_RETRY_DELAYS_MS = [100, 200, 400, 800]

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  let lastStatus: number | undefined
  for (let attempt = 0; attempt <= READ_AFTER_WRITE_RETRY_DELAYS_MS.length; attempt += 1) {
    const res = await fetch(url)
    if (res.ok) {
      const parsed = schema.safeParse(await res.json())
      if (!parsed.success) {
        throw internal("blob_corrupt_record", `Record at ${url} does not match its expected schema.`)
      }
      return parsed.data
    }
    lastStatus = res.status
    const isTransient = res.status === 403 || res.status === 404
    const baseDelayMs = READ_AFTER_WRITE_RETRY_DELAYS_MS[attempt]
    if (!isTransient || baseDelayMs === undefined) break
    // Full jitter: many concurrent callers hitting the same pathname (SC-003's 50
    // concurrent top-ups) would otherwise retry in lockstep at the same instants,
    // re-creating the exact contention that caused the 403 in the first place.
    await delay(Math.random() * baseDelayMs)
  }
  throw internal("blob_read_failed", `Failed to read ${url} from Vercel Blob (${lastStatus}).`)
}

/**
 * Reads the current balance record for an owner, or `null` if none has ever
 * been written (lazy creation: see contracts/api-routes.md GET /coins/balance).
 */
export async function readBalance(ownerId: string): Promise<CoinBalanceRecord | null> {
  assertBlobTokenConfigured()
  const { blobs } = await list({ prefix: balancePathname(ownerId), limit: 1 })
  const [blob] = blobs
  if (!blob) return null
  return fetchJson(blob.url, coinBalanceRecordSchema)
}

/**
 * Writes a new balance record, enforcing optimistic concurrency (research.md D5):
 * re-reads the current stored version immediately before writing and rejects if
 * it no longer matches `expectedVersion`. This narrows, but does not eliminate,
 * the race window — Vercel Blob has no compare-and-swap primitive.
 */
export async function writeBalance(
  record: CoinBalanceRecord,
  expectedVersion: number,
): Promise<void> {
  assertBlobTokenConfigured()
  const current = await readBalance(record.ownerId)
  const currentVersion = current?.version ?? 0
  if (currentVersion !== expectedVersion) {
    throw new ConcurrencyConflictError()
  }

  // addRandomSuffix: false makes this write overwrite the existing blob at this
  // exact pathname (this installed SDK version has no separate allowOverwrite
  // flag — that is simply what a non-random pathname does here).
  await put(balancePathname(record.ownerId), JSON.stringify(record), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  })
}

export async function appendTransaction(record: CoinTransactionRecord): Promise<void> {
  assertBlobTokenConfigured()
  await put(transactionPathname(record.ownerId, record.createdAt, record.txId), JSON.stringify(record), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  })
}

export async function listTransactions(
  ownerId: string,
  limit: number,
): Promise<CoinTransactionRecord[]> {
  assertBlobTokenConfigured()
  const { blobs } = await list({ prefix: transactionsPrefix(ownerId) })
  // Pathnames embed an ISO timestamp first, so lexicographic order == chronological
  // order (research.md D6); sort descending for "most recent first".
  const sorted = [...blobs].sort((a, b) => b.pathname.localeCompare(a.pathname)).slice(0, limit)
  return Promise.all(sorted.map((blob) => fetchJson(blob.url, coinTransactionRecordSchema)))
}

// --- Admin users ---------------------------------------------------------------------------------
// Stored as `admin/users/<sha256(email)>.json`: deterministic (lookup by e-mail) without putting the
// e-mail itself in the pathname. NOTE: every blob here is served from a public CDN URL (this SDK only
// supports `access: "public"`); the password is a salted scrypt hash, never plaintext, and the store's
// hostname is not guessable, but the record is not private storage. See apps/api/README.md.

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function adminIdFor(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex")
}

function adminUserPathname(email: string): string {
  return `admin/users/${adminIdFor(email)}.json`
}

export async function readAdminUser(email: string): Promise<AdminUser | null> {
  assertBlobTokenConfigured()
  const { blobs } = await list({ prefix: adminUserPathname(email), limit: 1 })
  const [blob] = blobs
  if (!blob) return null
  return fetchJson(blob.url, adminUserSchema)
}

export async function writeAdminUser(user: AdminUser): Promise<void> {
  assertBlobTokenConfigured()
  await put(adminUserPathname(user.email), JSON.stringify(user), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  })
}

export interface OwnerListing {
  ownerId: string
  /** Upload time of the balance blob, i.e. the last accepted balance change. */
  updatedAt: string
}

/**
 * Lists owners that have a balance, from blob metadata only (no per-owner CDN read, so it stays cheap and
 * independent of the CDN's bot protection). One page; pass the returned cursor for the next one.
 */
export async function listOwners(
  limit: number,
  cursor?: string,
): Promise<{ owners: OwnerListing[]; cursor: string | undefined }> {
  assertBlobTokenConfigured()
  const prefix = "coins/balances/"
  const page = await list({ prefix, limit, cursor })
  const owners = page.blobs.map((blob) => ({
    ownerId: blob.pathname.slice(prefix.length).replace(/\.json$/, ""),
    updatedAt: new Date(blob.uploadedAt).toISOString(),
  }))
  return { owners, cursor: page.hasMore ? page.cursor : undefined }
}
