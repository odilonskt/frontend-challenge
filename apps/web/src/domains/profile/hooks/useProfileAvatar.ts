import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEnsureSession, useSession } from '@/domains/auth'
import { BackendError, retryTransientBackend } from '@/shared/api/backend-client'
import { profileApi, profileKeys } from '../api/profile'
import type { AvatarResponse, SaveAvatarRequest } from '../model/contracts'

const unauthenticated = () =>
  new BackendError({ status: 401, code: 'UNAUTHENTICATED', message: 'Faça login para continuar.' })

/**
 * The photo as a data URL, or `null` without one (or while it loads, or when the service cannot be reached: a missing
 * photo never breaks a screen). The image is fetched apart from the profile and cached by its version, which
 * is why the profile response carries only `avatarVersion` (research D4).
 */
export function useProfileAvatar(version: string | null): string | null {
  const session = useSession()
  const userId = session.data?.user.id

  const query = useQuery({
    queryKey: profileKeys.avatar(userId, version),
    queryFn: ({ signal }) => profileApi.getAvatar(userId as string, signal),
    enabled: userId !== undefined && version !== null,
    // The version is part of the key, so a cached image can never be stale.
    staleTime: Infinity,
    retry: retryTransientBackend,
  })

  return version === null ? null : (query.data?.dataUrl ?? null)
}

/**
 * Replaces the photo. Like every write to this service, it confirms the site session first (see `useSaveProfile`). The service answers the profile with the new version; the image we just sent is written under
 * that version, so every screen (and the navigation bar) shows it at once without fetching it again.
 */
export function useUpdateAvatar() {
  const queryClient = useQueryClient()
  const session = useSession()
  const ensureSession = useEnsureSession()
  const userId = session.data?.user.id

  return useMutation({
    mutationFn: async (body: SaveAvatarRequest) => {
      await ensureSession()
      if (userId === undefined) throw unauthenticated()
      return profileApi.saveAvatar(userId, body)
    },
    onSuccess: (profile, body) => {
      queryClient.setQueryData(profileKeys.profile(userId), profile)
      if (profile.avatarVersion !== null) {
        const stored: AvatarResponse = { dataUrl: body.dataUrl, version: profile.avatarVersion }
        queryClient.setQueryData(profileKeys.avatar(userId, profile.avatarVersion), stored)
      }
    },
  })
}

/** Removes the photo (idempotent in the service); the profile answer has no version, so the image disappears everywhere. */
export function useRemoveAvatar() {
  const queryClient = useQueryClient()
  const session = useSession()
  const ensureSession = useEnsureSession()
  const userId = session.data?.user.id

  return useMutation({
    mutationFn: async () => {
      await ensureSession()
      if (userId === undefined) throw unauthenticated()
      return profileApi.removeAvatar(userId)
    },
    onSuccess: (profile) => queryClient.setQueryData(profileKeys.profile(userId), profile),
  })
}
