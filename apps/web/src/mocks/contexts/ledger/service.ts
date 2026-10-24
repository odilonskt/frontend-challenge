// Simulates `apps/api` (specs/007-monorepo-vercel-blob/contracts/api-routes.md) for tests and offline
// demos. It reproduces the contract (token issuance, per-owner isolation, 401/402/400), not the Blob storage.

const TOKEN_TTL_MS = 15 * 60 * 1000

export interface LedgerBalanceRecord {
  ownerId: string
  amount: number
  version: number
  updatedAt: string
}

export interface LedgerTransactionRecord {
  txId: string
  ownerId: string
  direction: 'credit' | 'debit'
  amount: number
  resultingBalance: number
  createdAt: string
}

/** Error carrying the API's `{ error: { code, message } }` contract. */
export class LedgerMockError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export class LedgerService {
  private balances = new Map<string, LedgerBalanceRecord>()
  private history = new Map<string, LedgerTransactionRecord[]>()
  private sequence = 0

  private readonly now: () => number

  constructor(now: () => number = Date.now) {
    this.now = now
  }

  reset() {
    this.balances.clear()
    this.history.clear()
    this.sequence = 0
  }

  issueToken(ownerId: unknown) {
    if (typeof ownerId !== 'string' || ownerId.trim() === '') {
      throw new LedgerMockError(400, 'invalid_owner_id', 'ownerId is required and MUST be a non-empty string.')
    }
    const expiresAtMs = this.now() + TOKEN_TTL_MS
    return {
      token: `mock-ledger.${encodeURIComponent(ownerId.trim())}.${expiresAtMs}`,
      expiresAt: new Date(expiresAtMs).toISOString(),
    }
  }

  /** The acting owner comes only from the token, exactly like the real API. */
  authenticate(authorization: string | null): string {
    const [scheme, token] = authorization?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) {
      throw new LedgerMockError(401, 'missing_token', 'Authorization: Bearer <token> header is required.')
    }
    const [prefix, owner, expires] = token.split('.')
    if (prefix !== 'mock-ledger' || !owner || !expires || Number(expires) <= this.now()) {
      throw new LedgerMockError(401, 'invalid_token', 'Token is expired or its signature could not be verified.')
    }
    return decodeURIComponent(owner)
  }

  getBalance(ownerId: string): LedgerBalanceRecord {
    return this.balances.get(ownerId) ?? { ownerId, amount: 0, version: 0, updatedAt: new Date(0).toISOString() }
  }

  topUp(ownerId: string, amount: unknown) {
    return this.apply(ownerId, 'credit', this.validAmount(amount))
  }

  debit(ownerId: string, amount: unknown) {
    return this.apply(ownerId, 'debit', this.validAmount(amount))
  }

  listTransactions(ownerId: string, limit: number) {
    return [...(this.history.get(ownerId) ?? [])].reverse().slice(0, limit)
  }

  private validAmount(amount: unknown): number {
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
      throw new LedgerMockError(400, 'invalid_amount', 'amount MUST be a positive integer.')
    }
    return amount
  }

  private apply(ownerId: string, direction: 'credit' | 'debit', amount: number): LedgerBalanceRecord {
    const current = this.getBalance(ownerId)
    const next = direction === 'credit' ? current.amount + amount : current.amount - amount
    if (next < 0) {
      throw new LedgerMockError(402, 'insufficient_balance', 'Balance is lower than the requested amount.')
    }

    const updatedAt = new Date(this.now()).toISOString()
    const record: LedgerBalanceRecord = { ownerId, amount: next, version: current.version + 1, updatedAt }
    this.balances.set(ownerId, record)

    this.sequence += 1
    const entry: LedgerTransactionRecord = {
      txId: `mock-tx-${this.sequence}`,
      ownerId,
      direction,
      amount,
      resultingBalance: next,
      createdAt: updatedAt,
    }
    this.history.set(ownerId, [...(this.history.get(ownerId) ?? []), entry])
    return record
  }
}
