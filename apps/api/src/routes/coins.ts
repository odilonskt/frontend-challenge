import { Router } from "express"
import { requireAuth } from "../lib/auth.js"
import {
  ConcurrencyConflictError,
  InsufficientBalanceError,
  amountSchema,
  transactionsQuerySchema,
} from "../domains/coins/contracts.js"
import * as coinsService from "../domains/coins/service.js"
import { badRequest, conflict, paymentRequired } from "../lib/errors.js"

// Express 5 forwards rejected promises from async handlers to the error
// middleware, so a Blob failure surfaces as a structured 500 instead of
// crashing the process.
const router = Router()

router.use(requireAuth)

function ownerIdOrThrow(req: { ownerId?: string }): string {
  // Always set: this router sits behind requireAuth.
  if (!req.ownerId) {
    throw new Error("requireAuth did not populate req.ownerId")
  }
  return req.ownerId
}

router.get("/balance", async (req, res) => {
  const ownerId = ownerIdOrThrow(req)
  const balance = await coinsService.getBalance(ownerId)
  res.status(200).json(balance)
})

router.get("/transactions", async (req, res, next) => {
  const ownerId = ownerIdOrThrow(req)
  const parsed = transactionsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    next(badRequest("invalid_limit", "limit MUST be an integer between 1 and 200."))
    return
  }

  const items = await coinsService.listTransactions(ownerId, parsed.data.limit)
  res.status(200).json({ ownerId, transactions: items })
})

router.post("/topup", async (req, res, next) => {
  const ownerId = ownerIdOrThrow(req)
  const parsed = amountSchema.safeParse(req.body)
  if (!parsed.success) {
    next(badRequest("invalid_amount", "amount MUST be a positive integer."))
    return
  }

  try {
    const balance = await coinsService.topUp(ownerId, parsed.data.amount)
    res.status(200).json(balance)
  } catch (err) {
    if (err instanceof ConcurrencyConflictError) {
      next(conflict("concurrency_conflict", "The balance changed concurrently; retry the request."))
      return
    }
    throw err
  }
})

router.post("/debit", async (req, res, next) => {
  const ownerId = ownerIdOrThrow(req)
  const parsed = amountSchema.safeParse(req.body)
  if (!parsed.success) {
    next(badRequest("invalid_amount", "amount MUST be a positive integer."))
    return
  }

  try {
    const balance = await coinsService.debit(ownerId, parsed.data.amount)
    res.status(200).json(balance)
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      next(paymentRequired("insufficient_balance", "Balance is lower than the requested amount."))
      return
    }
    if (err instanceof ConcurrencyConflictError) {
      next(conflict("concurrency_conflict", "The balance changed concurrently; retry the request."))
      return
    }
    throw err
  }
})

export default router
