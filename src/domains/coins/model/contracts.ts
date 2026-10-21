import Decimal from 'decimal.js'

export interface CoinBalance {
  userId: string
  balance: number
}

export interface CoinTransactionResult extends CoinBalance {
  transactionId: string
}

/** Fixed, single conversion rate used for every pay-with-coins purchase (spec.md FR-006). */
export const ETH_TO_COINS_RATE = 1000

/** Converts an order's ETH total into a whole-coin amount, always rounding up (never undercharge). */
export function toCoinsAmount(totalEth: string): number {
  return new Decimal(totalEth).times(ETH_TO_COINS_RATE).ceil().toNumber()
}
