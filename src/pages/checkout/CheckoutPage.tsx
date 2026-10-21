import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSession } from '@/domains/auth'
import { cartQueries, useCartQuote } from '@/domains/cart'
import { idempotencyKeyFor } from '@/domains/checkout'
import { debitCoins, InsufficientCoinsError, refundCoins, toCoinsAmount } from '@/domains/coins'
import { useCreateOrder } from '@/domains/orders'
import type { Network } from '@/domains/wallets'
import { isApiError } from '@/shared/api/http'
import { Button } from '@/shared/ui/button'
import { PageContainer } from '@/shared/ui/page-container'
import { Skeleton } from '@/shared/ui/skeleton'
import { CheckoutLoadError } from './components/CheckoutLoadError'
import { CollectorForm, useCollectorForm, type CollectorFormValues } from './components/CollectorForm'
import { OrderSummary } from './components/OrderSummary'
import { PaymentMethodPicker, type PaymentMethod } from './components/PaymentMethodPicker'
import { WalletPicker } from './components/WalletPicker'

const FALLBACK_NETWORK: Network = 'ethereum'

export function CheckoutPage() {
  const navigate = useNavigate()
  const session = useSession()
  const cart = useQuery(cartQueries.view())
  const form = useCollectorForm()
  const network = (form.watch('network') || FALLBACK_NETWORK) as Network
  const quote = useCartQuote(network)
  const [walletId, setWalletId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet')
  const createOrder = useCreateOrder()

  useEffect(() => {
    if (cart.data && cart.data.items.length === 0) void navigate({ to: '/cart' })
  }, [cart.data, navigate])

  async function onSubmit(values: CollectorFormValues) {
    if (!quote.data) return
    if (!quote.data.purchasable) {
      toast.error('Revise seu carrinho: alguns itens não podem ser finalizados.')
      return
    }
    if (!walletId) {
      toast.error('Selecione ou adicione uma carteira para continuar.')
      return
    }

    const fresh = await quote.refetch()
    if (!fresh.data?.purchasable || fresh.data.signature !== quote.data.signature) {
      toast.error('Os valores do pedido mudaram. Revise e confirme novamente.')
      return
    }

    const idempotencyKey = idempotencyKeyFor(fresh.data.signature)

    // Paying with coins hits a second, independent (real, not mocked) system before the order
    // itself is created — see specs/006-platform-coins/research.md D5. If the debit succeeds but
    // the order then fails, the coins are refunded best-effort (FR-009); there is no shared
    // transaction across the two systems, by design.
    let coinsAmount: number | null = null
    if (paymentMethod === 'coins') {
      const userId = session.data?.user.id
      if (!userId) return // unreachable on a protected route, but keeps the branch exhaustive
      coinsAmount = toCoinsAmount(fresh.data.total)
      try {
        await debitCoins(userId, coinsAmount, idempotencyKey)
      } catch (error) {
        if (error instanceof InsufficientCoinsError) {
          toast.error(error.message)
        } else {
          toast.error('Não foi possível debitar as moedas. Tente novamente.')
        }
        return
      }
    }

    try {
      const order = await createOrder.mutateAsync({
        quoteSignature: fresh.data.signature,
        network,
        walletId,
        collector: { fullName: values.fullName, email: values.email, country: 'BR', note: values.note },
        idempotencyKey,
      })
      void navigate({ to: '/orders/$orderId', params: { orderId: order.id } })
    } catch (error) {
      if (paymentMethod === 'coins' && coinsAmount !== null) {
        const userId = session.data?.user.id
        if (userId) {
          try {
            await refundCoins(userId, coinsAmount, idempotencyKey)
          } catch {
            // Best-effort compensation (research.md D5) — surfaced to the console, not re-thrown,
            // since the order-creation failure below is the error the collector needs to see.
            console.error('[coins] refund after failed order creation did not complete')
          }
        }
      }
      toast.error(isApiError(error) ? error.message : 'Não foi possível confirmar a compra.')
      // A stale-quote rejection (price/stock changed server-side) must update what's on screen,
      // not just the toast — otherwise the user "reviews" a total that's already wrong.
      void quote.refetch()
    }
  }

  if (cart.isError || quote.isError) {
    return (
      <CheckoutLoadError
        onRetry={() => {
          void cart.refetch()
          void quote.refetch()
        }}
      />
    )
  }

  return (
    <PageContainer className="py-8">
      <h1 className="mb-8 text-title font-bold">Pagamento</h1>
      {/* Not a <form>: WalletPicker can render its own nested wallet-creation form, and HTML forbids nested forms. */}
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-10">
          <CollectorForm form={form} />
          <WalletPicker selectedWalletId={walletId} onSelect={setWalletId} />
          {quote.data && (
            <PaymentMethodPicker method={paymentMethod} onMethodChange={setPaymentMethod} coinsRequired={toCoinsAmount(quote.data.total)} />
          )}
        </div>

        <div className="flex flex-col gap-4">
          {quote.isPending && <Skeleton className="h-96 w-full" />}
          {quote.data && <OrderSummary quote={quote.data} />}
          <Button type="button" size="lg" disabled={createOrder.isPending || quote.isPending} onClick={form.handleSubmit(onSubmit)}>
            {createOrder.isPending ? 'Confirmando…' : 'Confirmar compra'}
          </Button>
        </div>
      </div>
    </PageContainer>
  )
}
