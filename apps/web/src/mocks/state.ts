import type { Nft } from '@/domains/catalog'
import type { Order } from '@/domains/orders'
import type { UserAccountStatus } from '@/domains/admin'
import type { UserRole } from '@/domains/auth'
import type { Wallet } from '@/domains/wallets'
import type { EthAmount } from '@/shared/lib/eth'
import { buildNftFixtures } from './fixtures/nfts'
import { buildUserFixtures } from './fixtures/users'
import { LocalStoragePersistence, Store } from './infra/store'

export interface UserRecord {
  id: string
  name: string
  username: string
  email: string
  passwordSalt: string
  passwordHash: string
  updatedAt: string
  role: UserRole
  status: UserAccountStatus
}

export interface SessionRecord {
  token: string
  userId: string
  createdAt: number
  expiresAt: number
}

export interface CartLineRecord {
  nftId: string
  editionId: string
  quantity: number
  acknowledgedUnitPrice: EthAmount
}

export interface CartRecord {
  /** `user:<userId>` or `guest:<uuid>` */
  id: string
  lines: CartLineRecord[]
  couponCode: string | null
  updatedAt: string
}

export interface OrderRecord extends Order {
  userId: string
  idempotencyKey: string
  requestFingerprint: string
  /** Timestamp at which the simulated payment settles. */
  settleAt: number
  outcome: 'confirmed' | 'declined'
}

export interface MockState {
  users: UserRecord[]
  sessions: SessionRecord[]
  nfts: Nft[]
  /** NFTs removed from the public storefront by an admin (FR-007) — kept in `nfts` for order history. */
  delistedNftIds: string[]
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  wallets: Record<string, Wallet[]>
  orders: Record<string, OrderRecord>
  /** `${userId}:${idempotencyKey}` → orderId */
  idempotency: Record<string, string>
  eventSequence: number
}

export function createInitialState(): MockState {
  const { users, wallets, favorites } = buildUserFixtures()
  return {
    users,
    sessions: [],
    nfts: buildNftFixtures(),
    delistedNftIds: [],
    favorites,
    carts: {},
    wallets,
    orders: {},
    idempotency: {},
    eventSequence: 0,
  }
}

const SCHEMA_VERSION = 1

/**
 * The catalog fixtures are only the INITIAL state: a browser that already saved its state keeps the NFTs it had and
 * would never receive a collection added later (specs/016-brazilian-fauna-nfts, research D2). This adds, by id, the
 * fixture NFTs a saved state lacks, and touches nothing else: an NFT that is already there keeps its stock, its
 * editions and its flags, and users, sessions, carts, wallets, orders and favorites are untouched. Idempotent. It is
 * done here and not by bumping `SCHEMA_VERSION`, which would discard every demo user's cart, orders and favorites.
 * (Admin-created NFTs have random ids, so they never collide with the fixture ids.)
 */
export function addMissingCatalogNfts(state: MockState): MockState {
  const known = new Set(state.nfts.map((nft) => nft.id))
  const missing = buildNftFixtures().filter((nft) => !known.has(nft.id))
  return missing.length === 0 ? state : { ...state, nfts: [...state.nfts, ...missing] }
}

export const store = new Store<MockState>(
  new LocalStoragePersistence<MockState>('nft-mock:state', SCHEMA_VERSION),
  createInitialState,
  addMissingCatalogNfts,
)
