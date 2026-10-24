import { list, put } from "@vercel/blob"
import type { z } from "zod"
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

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw internal("blob_read_failed", `Failed to read ${url} from Vercel Blob (${res.status}).`)
  }
  const parsed = schema.safeParse(await res.json())
  if (!parsed.success) {
    throw internal("blob_corrupt_record", `Record at ${url} does not match its expected schema.`)
  }
  return parsed.data
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
