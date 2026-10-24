import type { EthAmount } from '@/shared/lib/eth'
import type { NftCategory, NftImage } from '@/domains/catalog'
import type { UserRole } from '@/domains/auth'

export type UserAccountStatus = 'active' | 'suspended'

export interface CreateListingRequest {
  name: string
  category: NftCategory
  description: string
  collection: string
  image: NftImage
  edition: {
    name: string
    price: EthAmount
    supply: number
    maxPerOrder: number
  }
}

export interface UpdateEditionRequest {
  price?: EthAmount
  available?: number
}

export interface AdminUserSummary {
  id: string
  name: string
  email: string
  username: string
  role: UserRole
  status: UserAccountStatus
}

export interface AdminUserDetail extends AdminUserSummary {
  bio: string
  avatarUrl: string | null
  updatedAt: string
}
