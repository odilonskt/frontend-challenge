import { useState } from 'react'
import { toast } from 'sonner'
import { coinsEnabled, useCoinsBalance, useTopUpCoins } from '@/domains/coins'
import { isApiError } from '@/shared/api/http'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'

export function CoinsBalanceSection() {
  const balance = useCoinsBalance()
  const topUp = useTopUpCoins()
  const [amount, setAmount] = useState('')

  // After the hooks (their order must not change): no coins backend in this build => no section.
  if (!coinsEnabled) return null

  function onTopUp() {
    const parsed = Number(amount)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      toast.error('Informe um valor inteiro positivo de moedas.')
      return
    }
    topUp.mutate(parsed, {
      onSuccess: () => {
        toast.success(`${parsed} moedas adicionadas ao seu saldo.`)
        setAmount('')
      },
      onError: (error) => toast.error(isApiError(error) ? error.message : 'Não foi possível recarregar as moedas.'),
    })
  }

  return (
    <section aria-labelledby="coins-balance-title" className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h2 id="coins-balance-title" className="text-title font-bold">
          Moedas da Kurio
        </h2>
        <p className="text-muted-foreground">Uma moeda alternativa à carteira para comprar NFTs na plataforma.</p>
      </div>

      {balance.isPending && <Skeleton className="h-10 w-32" />}
      {balance.isError && <p className="text-destructive">Não foi possível carregar seu saldo de moedas.</p>}
      {balance.data && (
        <p className="text-title font-bold text-primary" aria-live="polite">
          {balance.data.balance} moedas
        </p>
      )}

      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="coins-topup-amount" className="text-body">
            Recarregar moedas
          </label>
          <Input
            id="coins-topup-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32"
          />
        </div>
        <Button type="button" disabled={topUp.isPending} onClick={onTopUp}>
          {topUp.isPending ? 'Recarregando…' : 'Recarregar'}
        </Button>
      </div>
    </section>
  )
}
