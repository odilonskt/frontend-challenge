import { HttpResponse, http } from 'msw'
import { NFT_CATEGORIES, type NftCategory } from '@/domains/catalog'
import { errors } from '../../http/errors'
import { field, readJson, route } from '../../http/route'
import { collect } from '../auth/validation'
import type { AuthService } from '../auth/service'
import { requireAdmin } from './guard'
import type { AdminService } from './service'

const DECIMAL = /^\d+(\.\d{1,18})?$/
const isCategory = (value: string): value is NftCategory => (NFT_CATEGORIES as readonly string[]).includes(value)

export function adminHandlers(api: string, admin: AdminService, auth: AuthService) {
  return [
    // --- Products ---------------------------------------------------------
    http.get(
      `${api}/admin/nfts`,
      route(({ request }) => {
        requireAdmin(auth, request)
        return HttpResponse.json(admin.listNfts())
      }),
    ),
    http.post(
      `${api}/admin/nfts`,
      route(async ({ request }) => {
        requireAdmin(auth, request)
        const body = await readJson(request)
        const name = field.string(body, 'name')
        const category = field.string(body, 'category')
        const description = field.string(body, 'description')
        const collection = field.string(body, 'collection')
        const edition = (body.edition ?? {}) as Record<string, unknown>
        const editionName = field.string(edition, 'name')
        const price = field.string(edition, 'price')
        const supply = field.number(edition, 'supply')
        const maxPerOrder = field.number(edition, 'maxPerOrder')

        const fieldErrors = collect({
          name: name.trim().length >= 3 && name.trim().length <= 60 ? null : 'Use de 3 a 60 caracteres.',
          category: isCategory(category) ? null : 'Categoria inválida.',
          'edition.name': editionName.trim().length > 0 ? null : 'Informe o nome da edição.',
          'edition.price': DECIMAL.test(price) ? null : 'Preço inválido.',
          'edition.supply': Number.isInteger(supply) && supply > 0 ? null : 'Estoque inválido.',
          'edition.maxPerOrder': Number.isInteger(maxPerOrder) && maxPerOrder > 0 ? null : 'Limite por pedido inválido.',
        })
        if (Object.keys(fieldErrors).length > 0) throw errors.validation(fieldErrors)

        const image = (body.image ?? {}) as Record<string, unknown>
        const nft = admin.createListing({
          name,
          category: category as NftCategory,
          description,
          collection,
          image: {
            src: field.string(image, 'src'),
            alt: field.string(image, 'alt'),
            width: field.number(image, 'width') || 600,
            height: field.number(image, 'height') || 600,
          },
          edition: { name: editionName, price, supply, maxPerOrder },
        })
        return HttpResponse.json(nft, { status: 201 })
      }),
    ),
    http.patch<{ nftId: string; editionId: string }>(
      `${api}/admin/nfts/:nftId/editions/:editionId`,
      route(async ({ request, params }) => {
        requireAdmin(auth, request)
        const body = await readJson(request)
        const change: { price?: string; available?: number } = {}
        if (typeof body.price === 'string') change.price = body.price
        if (typeof body.available === 'number') change.available = body.available
        return HttpResponse.json(admin.updateEdition(params.nftId, params.editionId, change))
      }),
    ),
    http.post<{ nftId: string }>(
      `${api}/admin/nfts/:nftId/delist`,
      route(({ request, params }) => {
        requireAdmin(auth, request)
        return HttpResponse.json(admin.delist(params.nftId))
      }),
    ),

    // --- Users --------------------------------------------------------------
    http.get(
      `${api}/admin/users`,
      route(({ request }) => {
        requireAdmin(auth, request)
        const q = new URL(request.url).searchParams.get('q') ?? undefined
        return HttpResponse.json(admin.listUsers(q))
      }),
    ),
    http.get<{ userId: string }>(
      `${api}/admin/users/:userId`,
      route(({ request, params }) => {
        requireAdmin(auth, request)
        return HttpResponse.json(admin.getUser(params.userId))
      }),
    ),
    http.post<{ userId: string }>(
      `${api}/admin/users/:userId/suspend`,
      route(({ request, params }) => {
        requireAdmin(auth, request)
        return HttpResponse.json(admin.suspendUser(params.userId))
      }),
    ),
    http.post<{ userId: string }>(
      `${api}/admin/users/:userId/reactivate`,
      route(({ request, params }) => {
        requireAdmin(auth, request)
        return HttpResponse.json(admin.reactivateUser(params.userId))
      }),
    ),
  ]
}
