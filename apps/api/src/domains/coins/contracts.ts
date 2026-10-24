import { z } from "zod"

export const coinBalanceRecordSchema = z.object({
  ownerId: z.string().min(1),
  amount: z.number().int().nonnegative(),
  /** Incremented by +1 on every accepted write; used for optimistic concurrency. */
  version: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
})

export type CoinBalanceRecord = z.infer<typeof coinBalanceRecordSchema>

export const coinTransactionRecordSchema = z.object({
  txId: z.string().min(1),
  ownerId: z.string().min(1),
  direction: z.enum(["credit", "debit"]),
  /** Always positive; the sign comes from `direction`. */
  amount: z.number().int().positive(),
  resultingBalance: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
})

export type CoinTransactionRecord = z.infer<typeof coinTransactionRecordSchema>

export class InsufficientBalanceError extends Error {
  constructor() {
    super("Insufficient balance for this debit.")
  }
}

export class ConcurrencyConflictError extends Error {
  constructor() {
    super("The balance was modified concurrently; retry the operation.")
  }
}
