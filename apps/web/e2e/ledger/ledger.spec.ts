import { expect, test, type Page } from '@playwright/test'

// Exercises the real `ledger` client (token session, schema validation, retry rules) in the browser
// against the MSW mock of apps/api. The real backend is never reached (constitution, Principle VII).

type Outcome = { ok: true; value: unknown } | { ok: false; status: number | null; code: string }

async function boot(page: Page) {
  await page.goto('/')
  // The app renders only after MSW is ready, so a visible header means the mocked backend is active.
  await page.getByRole('banner').waitFor()
}

/** Runs `ledgerRequest` inside the page and returns either the parsed value or the normalised error. */
async function call(
  page: Page,
  ownerId: string,
  config: { method: 'GET' | 'POST'; url: string; data?: unknown; params?: unknown },
  schema: 'balance' | 'transactions',
): Promise<Outcome> {
  return page.evaluate(
    async ([owner, cfg, schemaName]) => {
      const client = await import('/src/domains/ledger/api/client.ts')
      const contracts = await import('/src/domains/ledger/model/contracts.ts')
      const zodSchema = schemaName === 'balance' ? contracts.ledgerBalanceSchema : contracts.ledgerTransactionsSchema
      try {
        return { ok: true as const, value: await client.ledgerRequest(owner, cfg, zodSchema) }
      } catch (error) {
        const e = error as { status: number | null; code: string }
        return { ok: false as const, status: e.status, code: e.code }
      }
    },
    [ownerId, config, schema] as const,
  )
}

test.describe('ledger client (mocked apps/api)', () => {
  test('issues a token, tops up, debits and lists the history', async ({ page }) => {
    await boot(page)
    const owner = `usr_${Date.now().toString(36)}`

    const fresh = await call(page, owner, { method: 'GET', url: '/coins/balance' }, 'balance')
    expect(fresh).toMatchObject({ ok: true, value: { ownerId: owner, amount: 0, version: 0 } })

    const topped = await call(page, owner, { method: 'POST', url: '/coins/topup', data: { amount: 100 } }, 'balance')
    expect(topped).toMatchObject({ ok: true, value: { amount: 100, version: 1 } })

    const debited = await call(page, owner, { method: 'POST', url: '/coins/debit', data: { amount: 40 } }, 'balance')
    expect(debited).toMatchObject({ ok: true, value: { amount: 60, version: 2 } })

    const history = await call(page, owner, { method: 'GET', url: '/coins/transactions' }, 'transactions')
    expect(history).toMatchObject({ ok: true })
    const list = (history as { value: { transactions: { direction: string; amount: number }[] } }).value.transactions
    expect(list.map((t) => `${t.direction}:${t.amount}`)).toEqual(['debit:40', 'credit:100'])
  })

  test('rejects a debit above the balance with 402 and leaves the balance untouched', async ({ page }) => {
    await boot(page)
    const owner = `usr_${Date.now().toString(36)}b`
    await call(page, owner, { method: 'POST', url: '/coins/topup', data: { amount: 10 } }, 'balance')

    const rejected = await call(page, owner, { method: 'POST', url: '/coins/debit', data: { amount: 999 } }, 'balance')
    expect(rejected).toMatchObject({ ok: false, status: 402, code: 'insufficient_balance' })

    const after = await call(page, owner, { method: 'GET', url: '/coins/balance' }, 'balance')
    expect(after).toMatchObject({ ok: true, value: { amount: 10 } })
  })

  test('keeps owners isolated: each token only ever reaches its own data', async ({ page }) => {
    await boot(page)
    const stamp = Date.now().toString(36)
    const a = `usr_${stamp}a`
    const b = `usr_${stamp}c`
    await call(page, a, { method: 'POST', url: '/coins/topup', data: { amount: 500 } }, 'balance')

    const other = await call(page, b, { method: 'GET', url: '/coins/balance' }, 'balance')
    expect(other).toMatchObject({ ok: true, value: { ownerId: b, amount: 0 } })
  })

  test('validates input before it changes anything (400) and rejects a missing token (401)', async ({ page }) => {
    await boot(page)
    const owner = `usr_${Date.now().toString(36)}d`

    const invalid = await call(page, owner, { method: 'POST', url: '/coins/topup', data: { amount: -5 } }, 'balance')
    expect(invalid).toMatchObject({ ok: false, status: 400, code: 'invalid_amount' })

    const status = await page.evaluate(async () => (await fetch('/backend/coins/balance')).status)
    expect(status).toBe(401)
  })

  test('re-issues the token once when the cached one is rejected (401)', async ({ page }) => {
    await boot(page)
    const owner = `usr_${Date.now().toString(36)}e`

    const result = await page.evaluate(async (ownerId) => {
      const client = await import('/src/domains/ledger/api/client.ts')
      const contracts = await import('/src/domains/ledger/model/contracts.ts')
      await client.ledgerRequest(ownerId, { method: 'GET', url: '/coins/balance' }, contracts.ledgerBalanceSchema)
      // Simulate a server-side expiry: the next authenticated request carries an already-expired token
      // once; the client must notice the 401, re-issue a token and succeed on its own.
      let spoiled = false
      client.ledgerHttp.interceptors.request.use((config) => {
        if (!spoiled && config.url?.includes('/coins/')) {
          spoiled = true
          config.headers.set('Authorization', 'Bearer mock-ledger.broken.0')
        }
        return config
      })
      return client.ledgerRequest(ownerId, { method: 'GET', url: '/coins/balance' }, contracts.ledgerBalanceSchema)
    }, owner)

    expect(result).toMatchObject({ ownerId: owner })
  })

  test('mock health endpoint answers through the same /backend prefix', async ({ page }) => {
    await boot(page)
    const body = await page.evaluate(async () => (await fetch('/backend/health')).json())
    expect(body).toEqual({ status: 'ok' })
  })
})
