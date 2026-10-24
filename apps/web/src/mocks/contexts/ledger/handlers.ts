import { HttpResponse, http } from 'msw'
import { LedgerMockError, type LedgerService } from './service'

const MAX_LIMIT = 200

/** `base` is the app's `/backend` prefix, which Vite/vercel.json map to the real API's `/api`. */
export function ledgerHandlers(base: string, ledger: LedgerService) {
  const run = (fn: () => Response | Promise<Response>) => async () => {
    try {
      return await fn()
    } catch (error) {
      if (error instanceof LedgerMockError) {
        return HttpResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
      }
      throw error
    }
  }

  const bodyOf = async (request: Request): Promise<Record<string, unknown>> => {
    const parsed: unknown = await request.json().catch(() => ({}))
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  }

  const ownerOf = (request: Request) => ledger.authenticate(request.headers.get('authorization'))

  return [
    http.get(`${base}/health`, () => HttpResponse.json({ status: 'ok' })),

    http.post(
      `${base}/auth/token`,
      ({ request }) => run(async () => HttpResponse.json(ledger.issueToken((await bodyOf(request)).ownerId)))(),
    ),

    http.get(`${base}/coins/balance`, ({ request }) =>
      run(() => HttpResponse.json(ledger.getBalance(ownerOf(request))))(),
    ),

    http.get(`${base}/coins/transactions`, ({ request }) =>
      run(() => {
        const ownerId = ownerOf(request)
        const raw = new URL(request.url).searchParams.get('limit')
        const limit = raw === null ? 50 : Number(raw)
        if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
          throw new LedgerMockError(400, 'invalid_limit', 'limit MUST be an integer between 1 and 200.')
        }
        return HttpResponse.json({ ownerId, transactions: ledger.listTransactions(ownerId, limit) })
      })(),
    ),

    http.post(`${base}/coins/topup`, ({ request }) =>
      run(async () => {
        const ownerId = ownerOf(request)
        return HttpResponse.json(ledger.topUp(ownerId, (await bodyOf(request)).amount))
      })(),
    ),

    http.post(`${base}/coins/debit`, ({ request }) =>
      run(async () => {
        const ownerId = ownerOf(request)
        return HttpResponse.json(ledger.debit(ownerId, (await bodyOf(request)).amount))
      })(),
    ),
  ]
}
