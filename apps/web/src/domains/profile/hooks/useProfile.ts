import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useEnsureSession, useSession } from '@/domains/auth'
import { BackendError, retryTransientBackend } from '@/shared/api/backend-client'
import { profileApi, profileKeys } from '../api/profile'
import type { ProfileResponse, ProfileSummary, ProfileView, SaveProfileRequest } from '../model/contracts'

/** The profile is read at most once per 5 minutes per session; saves write their answer straight into the cache. */
const PROFILE_STALE_MS = 5 * 60_000

const unauthenticated = () =>
  new BackendError({ status: 401, code: 'UNAUTHENTICATED', message: 'Faça login para continuar.' })

function toView(response: ProfileResponse, accountName: string, avatarUrl: string | null): ProfileView {
  return {
    // A collector that never saved a profile has an empty display name: show the name from the account (FR-008).
    displayName: response.displayName === '' ? accountName : response.displayName,
    bio: response.bio,
    ensName: response.ensName,
    ensTld: response.ensTld,
    walletNickname: response.walletNickname,
    updatedAt: response.updatedAt,
    avatarUrl,
  }
}

export interface ProfileState {
  data: ProfileView | undefined
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: () => void
}

/** The signed-in collector's profile from the real service, as the page shows it. */
export function useProfile(): ProfileState {
  const session = useSession()
  const userId = session.data?.user.id
  const accountName = session.data?.user.name ?? ''

  const query = useQuery({
    queryKey: profileKeys.profile(userId),
    // `signal` lets TanStack Query cancel a stale request (constitution, Principle III).
    queryFn: ({ signal }) => profileApi.get(userId as string, signal),
    enabled: userId !== undefined,
    staleTime: PROFILE_STALE_MS,
    retry: retryTransientBackend,
  })

  const data = useMemo(
    () => (query.data ? toView(query.data, accountName, null) : undefined),
    [query.data, accountName],
  )

  return { data, isPending: query.isPending, isError: query.isError, error: query.error, refetch: () => void query.refetch() }
}

/**
 * Saves the five text fields. The site session is confirmed first (`useEnsureSession`): the real service does not
 * know it, so without this a collector whose session expired could still save. An expired session redirects to
 * sign-in and nothing is sent. The answer is written into the cache, so every screen shows it at once.
 */
export function useSaveProfile() {
  const queryClient = useQueryClient()
  const session = useSession()
  const ensureSession = useEnsureSession()
  const userId = session.data?.user.id

  return useMutation({
    mutationFn: async (body: SaveProfileRequest) => {
      await ensureSession()
      if (userId === undefined) throw unauthenticated()
      return profileApi.save(userId, body)
    },
    onSuccess: (response) => queryClient.setQueryData(profileKeys.profile(userId), response),
  })
}

/**
 * What the navigation bar shows. Never throws and never shows an error: while the profile loads, when the service
 * is down, or when the collector never saved one, it falls back to the account's name (FR-017).
 */
export function useProfileSummary(): ProfileSummary | null {
  const session = useSession()
  const profile = useProfile()
  if (!session.data) return null
  return {
    displayName: profile.data?.displayName ?? session.data.user.name,
    avatarUrl: profile.data?.avatarUrl ?? null,
  }
}
