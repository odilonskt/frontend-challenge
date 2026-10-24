import { coinsEnabled, useCoinsBalance } from '@/domains/coins'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group'
import { Skeleton } from '@/shared/ui/skeleton'

export type PaymentMethod = 'wallet' | 'coins'

/**
 * Only the "which currency pays" choice — a connected wallet is still selected separately and
 * unconditionally elsewhere on the page, since the purchased NFT needs a receiving wallet
 * regardless of which currency settled the payment (`CreateOrderRequest.walletId` is always
 * required).
 */
export function PaymentMethodPicker({
  method,
  onMethodChange,
  coinsRequired,
}: {
  method: PaymentMethod
  onMethodChange: (method: PaymentMethod) => void
  coinsRequired: number
}) {
  const coinsBalance = useCoinsBalance()
  const insufficientCoins = coinsBalance.data !== undefined && coinsBalance.data.balance < coinsRequired

  // No coins backend in this build (production): the page keeps its default `wallet` method and shows
  // no picker at all, since a single option would be a choice that is not one.
  if (!coinsEnabled) return null

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-title font-bold">Forma de pagamento</h2>

      <RadioGroup value={method} onValueChange={(value) => onMethodChange(value as PaymentMethod)} aria-label="Forma de pagamento">
        <label htmlFor="payment-wallet" className="flex cursor-pointer items-center gap-3 rounded-sm border border-border p-3 text-body">
          <RadioGroupItem id="payment-wallet" value="wallet" />
          Pagar com a carteira conectada (ETH)
        </label>
        <label htmlFor="payment-coins" className="flex cursor-pointer items-center gap-3 rounded-sm border border-border p-3 text-body">
          <RadioGroupItem id="payment-coins" value="coins" />
          Pagar com moedas da Kurio
        </label>
      </RadioGroup>

      {method === 'coins' && (
        <div className="flex flex-col gap-2 rounded-sm border border-border p-3">
          {coinsBalance.isPending && <Skeleton className="h-6 w-32" />}
          {coinsBalance.data && (
            <p aria-live="polite">
              Saldo atual: <strong>{coinsBalance.data.balance} moedas</strong> · Custo desta compra:{' '}
              <strong>{coinsRequired} moedas</strong>
            </p>
          )}
          {insufficientCoins && (
            <p role="alert" className="text-destructive">
              Saldo de moedas insuficiente para esta compra. Recarregue em Carteiras ou escolha pagar com a carteira.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
