import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Nft } from '@/domains/catalog'
import { api } from '@/shared/api/http'
import type {
  AdminUserDetail,
  AdminUserSummary,
  CreateListingRequest,
  UpdateEditionRequest,
} from '../model/contracts'

const adminNftsKey = ['admin', 'nfts'] as const
const adminUsersKey = (q?: string) => ['admin', 'users', q ?? ''] as const
const adminUserKey = (id: string) => ['admin', 'users', 'detail', id] as const

export function useAdminNfts() {
  return useQuery(queryOptions({ queryKey: adminNftsKey, queryFn: () => api.get<Nft[]>('/admin/nfts') }))
}

export function useCreateListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateListingRequest) => api.post<Nft, CreateListingRequest>('/admin/nfts', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminNftsKey }),
  })
}

export function useUpdateListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nftId, editionId, change }: { nftId: string; editionId: string; change: UpdateEditionRequest }) =>
      api.patch<Nft, UpdateEditionRequest>(`/admin/nfts/${nftId}/editions/${editionId}`, change),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminNftsKey }),
  })
}

export function useDelistNft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (nftId: string) => api.post<Nft>(`/admin/nfts/${nftId}/delist`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminNftsKey }),
  })
}

export function useAdminUsers(q?: string) {
  return useQuery(
    queryOptions({
      queryKey: adminUsersKey(q),
      queryFn: () => api.get<AdminUserSummary[]>('/admin/users', { params: q ? { q } : undefined }),
    }),
  )
}

export function useAdminUser(userId: string | null) {
  return useQuery(
    queryOptions({
      queryKey: adminUserKey(userId ?? ''),
      queryFn: () => api.get<AdminUserDetail>(`/admin/users/${userId}`),
      enabled: userId !== null,
    }),
  )
}

export function useSuspendUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.post<AdminUserDetail>(`/admin/users/${userId}/suspend`),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.setQueryData(adminUserKey(user.id), user)
    },
  })
}

export function useReactivateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.post<AdminUserDetail>(`/admin/users/${userId}/reactivate`),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.setQueryData(adminUserKey(user.id), user)
    },
  })
}
