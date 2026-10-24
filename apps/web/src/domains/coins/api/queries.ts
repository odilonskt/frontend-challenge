import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from '@/domains/auth'
import { coinsHttp } from './client'
import { coinsEnabled } from '../model/availability'
import type { CoinBalance, CoinTransactionResult } from '../model/contracts'

/** Thrown by `debitCoins` specifically for the insufficient-balance case (FR-007). */
export class InsufficientCoinsError extends Error {
  readonly balance: number
  constructor(balance: number) {
    super('Saldo de moedas insuficiente para esta compra.')
    this.name = 'InsufficientCoinsError'
    this.balance = balance
  }
}

const balanceKey = (userId: string | undefined) => ['coins', 'balance', userId] as const

export function useCoinsBalance() {
  const session = useSession()
  const userId = session.data?.user.id

  return useQuery({
    queryKey: balanceKey(userId),
    queryFn: () => coinsHttp.get<CoinBalance>('/coins/balance', { headers: { 'X-User-Id': userId } }).then((r) => r.data),
    // Never queries a coins backend that is not configured (production builds; specs/008 FR-008).
    enabled: coinsEnabled && userId !== undefined,
  })
}

export function useTopUpCoins() {
  const session = useSession()
  const userId = session.data?.user.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (amount: number) =>
      coinsHttp
        .post<CoinTransactionResult>('/coins/topup', { amount }, { headers: { 'X-User-Id': userId } })
        .then((r) => r.data),
    onSuccess: (data) => {
      if (userId) queryClient.setQueryData(balanceKey(userId), { userId: data.userId, balance: data.balance })
    },
  })
}

/**
 * Imperative (not a hook) — called directly from checkout's submit handler, which already runs
 * outside React's render cycle by the time it needs this. Throws `InsufficientCoinsError` on a
 * `409`; otherwise rethrows the raw Axios error for the caller's own `isApiError`-style handling.
 */
export async function debitCoins(userId: string, amount: number, orderRef?: string): Promise<CoinTransactionResult> {
  try {
    const { data } = await coinsHttp.post<CoinTransactionResult>(
      '/coins/debit',
      { amount, orderRef },
      { headers: { 'X-User-Id': userId } },
    )
    return data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      const balance = (error.response.data as { balance?: number })?.balance ?? 0
      throw new InsufficientCoinsError(balance)
    }
    throw error
  }
}

/** Best-effort compensation for a debit whose order creation failed afterward (FR-009). */
export async function refundCoins(userId: string, amount: number, orderRef?: string): Promise<CoinTransactionResult> {
  const { data } = await coinsHttp.post<CoinTransactionResult>(
    '/coins/refund',
    { amount, orderRef },
    { headers: { 'X-User-Id': userId } },
  )
  return data
}
