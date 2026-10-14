import { expect, test } from '@playwright/test'
import { hasNoHorizontalScroll, runAxe, seedCartItem, SESSION_KEY, signIn, VIEWPORTS } from '../design-system/helpers'

test('blocks submission while required fields are invalid', async ({ page }) => {
  await signIn(page)
  await seedCartItem(page)
  await page.goto('/checkout')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByText('Informe o nome completo.')).toBeVisible()
  await expect(page).toHaveURL('/checkout')
})

test('completes checkout and reaches order confirmation', async ({ page }) => {
  await signIn(page)
  await seedCartItem(page)
  await page.goto('/checkout')

  await page.getByLabel('Nome de exibição').fill('Ana Colecionadora')
  await page.getByLabel('E-mail').fill('ana@nft.dev')
  await page.getByLabel('Rede').selectOption('ethereum')
  await page.getByLabel('Apelido da carteira').fill('Minha carteira')
  await page.getByLabel('Tipo de carteira').selectOption('metamask')
  await page.getByPlaceholder('Endereço 0x da carteira').fill(`0x${'1'.repeat(40)}`)
  await page.getByLabel('Ethereum').check()
  await page.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(page.getByLabel(/Minha carteira/)).toBeVisible()
  await page.getByLabel(/Minha carteira/).check()

  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/orders\//, { timeout: 10_000 })
})

test('retrying the same idempotency key never creates a duplicate order', async ({ page }) => {
  await signIn(page)
  await seedCartItem(page)
  const token = await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)

  const [firstOrderId, secondOrderId] = await page.evaluate(async (authToken) => {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }
    const wallet = await (
      await fetch('/api/wallets', {
        method: 'POST',
        headers,
        body: JSON.stringify({ slot: 'primary', label: 'Carteira', provider: 'metamask', address: `0x${'2'.repeat(40)}`, networks: ['ethereum'] }),
      })
    ).json()
    const quote = await (await fetch('/api/cart/quote?network=ethereum', { headers })).json()
    const idempotencyKey = crypto.randomUUID()
    const payload = JSON.stringify({
      quoteSignature: quote.signature,
      network: 'ethereum',
      walletId: wallet.id,
      collector: { fullName: 'Retry Tester', email: 'retry@nft.dev', country: 'BR' },
    })
    const first = await (await fetch('/api/orders', { method: 'POST', headers: { ...headers, 'Idempotency-Key': idempotencyKey }, body: payload })).json()
    // Simulates the client retrying after a timeout: same key, same payload.
    const second = await (await fetch('/api/orders', { method: 'POST', headers: { ...headers, 'Idempotency-Key': idempotencyKey }, body: payload })).json()
    return [first.id, second.id]
  }, token)

  expect(firstOrderId).toBe(secondOrderId)
})

test('checkout has no critical accessibility violations', async ({ page }) => {
  await signIn(page)
  await seedCartItem(page)
  await page.goto('/checkout')
  await expect(page.getByRole('heading', { name: 'Pagamento' })).toBeVisible()
  expect(await runAxe(page)).toEqual([])
})

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`${name} (${viewport.width}px)`, () => {
    test.use({ viewport })

    test('checkout renders without horizontal scroll and matches its baseline', async ({ page }) => {
      await signIn(page)
      await seedCartItem(page)
      await page.goto('/checkout')
      await expect(page.getByRole('heading', { name: 'Pagamento' })).toBeVisible()
      expect(await hasNoHorizontalScroll(page)).toBe(true)
      await expect(page).toHaveScreenshot(`checkout-${viewport.width}.png`, { fullPage: true })
    })
  })
}
