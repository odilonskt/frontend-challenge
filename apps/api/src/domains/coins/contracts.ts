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

/**
 * Request body for `POST /api/coins/topup` and `POST /api/coins/debit`.
 * Centralized (single source) for runtime validation and OpenAPI generation.
 * Moved verbatim from `routes/coins.ts` — `amount` MUST be a positive integer.
 */
export const amountSchema = z.object({
  amount: z.number().int().positive(),
})

export type AmountRequest = z.infer<typeof amountSchema>

/**
 * Query for `GET /api/coins/transactions`. `limit` is an optional, coerced
 * integer in `[1, 200]` defaulting to `50`. Centralized (single source) so the
 * OpenAPI parameter is derived from the same schema that parses the request.
 * Moved verbatim from `routes/coins.ts`.
 */
export const transactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>

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
