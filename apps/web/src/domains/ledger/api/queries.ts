import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/domains/auth'
import {
  LEDGER_TRANSACTIONS_DEFAULT_LIMIT,
  ledgerBalanceSchema,
  ledgerTransactionsSchema,
  type LedgerBalance,
} from '../model/contracts'
import { LedgerError, ledgerRequest } from './client'

// Query keys are isolated per user (and per page size), so one account's data is never served to another.
export const ledgerKeys = {
  balance: (userId: string | undefined) => ['ledger', 'balance', userId] as const,
  transactions: (userId: string | undefined, limit: number) => ['ledger', 'transactions', userId, limit] as const,
}

/** 4xx answers are final; only network/timeout/5xx failures are worth another attempt. */
const retryTransient = (failureCount: number, error: unknown) =>
  error instanceof LedgerError && error.isRetryable && failureCount < 2

function useLedgerUserId() {
  const session = useSession()
  return session.data?.user.id
}

export function useLedgerBalance() {
  const userId = useLedgerUserId()

  return useQuery({
    queryKey: ledgerKeys.balance(userId),
    // `signal` lets TanStack Query cancel a stale request (constitution, Principle III).
    queryFn: ({ signal }) =>
      ledgerRequest(userId as string, { method: 'GET', url: '/coins/balance', signal }, ledgerBalanceSchema),
    enabled: userId !== undefined,
    retry: retryTransient,
  })
}

export function useLedgerTransactions(limit: number = LEDGER_TRANSACTIONS_DEFAULT_LIMIT) {
  const userId = useLedgerUserId()

  return useQuery({
    queryKey: ledgerKeys.transactions(userId, limit),
    queryFn: ({ signal }) =>
      ledgerRequest(
        userId as string,
        { method: 'GET', url: '/coins/transactions', params: { limit }, signal },
        ledgerTransactionsSchema,
      ).then((r) => r.transactions),
    enabled: userId !== undefined,
    retry: retryTransient,
  })
}

function useLedgerWrite(endpoint: '/coins/topup' | '/coins/debit') {
  const userId = useLedgerUserId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (amount: number) => {
      // Never mint a token for an unknown owner: a write without a signed-in user is a caller bug.
      if (!userId) {
        return Promise.reject(
          new LedgerError({ status: 401, code: 'UNAUTHENTICATED', message: 'Faça login para continuar.' }),
        )
      }
      return ledgerRequest(userId, { method: 'POST', url: endpoint, data: { amount } }, ledgerBalanceSchema)
    },
    onSuccess: (balance: LedgerBalance) => {
      // The write already returns the new balance: publish it now, then refresh the history in background.
      queryClient.setQueryData(ledgerKeys.balance(userId), balance)
      void queryClient.invalidateQueries({ queryKey: ['ledger', 'transactions', userId] })
    },
  })
}

export const useLedgerTopUp = () => useLedgerWrite('/coins/topup')

/** Rejects with a `LedgerError` whose `isInsufficientBalance` is true when the balance is too low (402). */
export const useLedgerDebit = () => useLedgerWrite('/coins/debit')
