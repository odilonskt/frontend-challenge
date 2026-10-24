import { randomUUID } from "node:crypto"
import * as blobStore from "../../lib/blobStore.js"
import {
  ConcurrencyConflictError,
  InsufficientBalanceError,
  type CoinBalanceRecord,
  type CoinTransactionRecord,
} from "./contracts.js"

function emptyBalance(ownerId: string): CoinBalanceRecord {
  return { ownerId, amount: 0, version: 0, updatedAt: new Date(0).toISOString() }
}

async function applyTransactionOnce(
  ownerId: string,
  direction: "credit" | "debit",
  amount: number,
): Promise<CoinBalanceRecord> {
  const current = (await blobStore.readBalance(ownerId)) ?? emptyBalance(ownerId)
  const nextAmount = direction === "credit" ? current.amount + amount : current.amount - amount

  if (nextAmount < 0) {
    throw new InsufficientBalanceError()
  }

  const next: CoinBalanceRecord = {
    ownerId,
    amount: nextAmount,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  }

  // Throws ConcurrencyConflictError if the stored version no longer matches
  // `current.version` by the time this write happens (research.md D5).
  await blobStore.writeBalance(next, current.version)

  const entry: CoinTransactionRecord = {
    txId: randomUUID(),
    ownerId,
    direction,
    amount,
    resultingBalance: nextAmount,
    createdAt: next.updatedAt,
  }
  await blobStore.appendTransaction(entry)

  return next
}

/**
 * Applies one top-up/debit, retrying exactly once on a detected concurrency
 * conflict (FR-008) before surfacing it to the caller as a `409` (routes/coins.ts).
 */
async function applyTransaction(
  ownerId: string,
  direction: "credit" | "debit",
  amount: number,
): Promise<CoinBalanceRecord> {
  try {
    return await applyTransactionOnce(ownerId, direction, amount)
  } catch (err) {
    if (err instanceof ConcurrencyConflictError) {
      return applyTransactionOnce(ownerId, direction, amount)
    }
    throw err
  }
}

export async function getBalance(ownerId: string): Promise<CoinBalanceRecord> {
  return (await blobStore.readBalance(ownerId)) ?? emptyBalance(ownerId)
}

export async function topUp(ownerId: string, amount: number): Promise<CoinBalanceRecord> {
  return applyTransaction(ownerId, "credit", amount)
}

export async function debit(ownerId: string, amount: number): Promise<CoinBalanceRecord> {
  return applyTransaction(ownerId, "debit", amount)
}

export async function listTransactions(
  ownerId: string,
  limit: number,
): Promise<CoinTransactionRecord[]> {
  return blobStore.listTransactions(ownerId, limit)
}

export { ConcurrencyConflictError, InsufficientBalanceError }
