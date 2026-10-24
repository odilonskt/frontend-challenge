import { expect, test, type Page } from '@playwright/test'
import { seedCartItem, signIn } from '../design-system/helpers'

// US3 — the production build must not depend on local infrastructure, must hide the coins feature
// (its backend, server/, cannot run on Vercel) and must run under the real security headers.

declare global {
  interface Window {
    __csp?: string[]
  }
}

async function watchCsp(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__csp = [...(window.__csp ?? []), `${event.violatedDirective} ${event.blockedURI}`]
    })
  })
}

test('coins are hidden and nothing calls localhost, across a full journey', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await watchCsp(page)

  await signIn(page)
  await seedCartItem(page)

  for (const path of ['/', '/nft/nft_001', '/cart', '/checkout', '/account/profile', '/account/wallets']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
  }

  // Wallets: no coins balance section.
  await page.goto('/account/wallets')
  await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Moedas da Kurio' })).toHaveCount(0)

  // Checkout: no payment-method picker, but the wallet/ETH purchase flow is intact.
  await page.goto('/checkout')
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeVisible()
  await expect(page.getByText('Forma de pagamento')).toHaveCount(0)
  await expect(page.getByLabel('Pagar com moedas da Kurio')).toHaveCount(0)

  // No request to the coins backend (port 4000) at any point.
  const coinsCalls = requests.filter((url) => new URL(url).port === '4000')
  expect(coinsCalls).toEqual([])

  // No Content-Security-Policy violation during the whole journey, except the known MSW WebSocket attempt
  // to ws://localhost/socket.io/ (see storefront.spec.ts): the CSP blocking it is the desired outcome.
  const violations = (await page.evaluate(() => window.__csp ?? [])).filter(
    (v) => !/^connect-src ws:\/\/localhost\/socket\.io\//.test(v),
  )
  expect(violations).toEqual([])
})
