import { backendRequest } from '@/shared/api/backend-client'
import { profileResponseSchema, type SaveProfileRequest } from '../model/contracts'

/** Keyed by the signed-in user (and, for the photo, by its version): one account never reads another's cache. */
export const profileKeys = {
  profile: (userId: string | undefined) => ['profile', userId] as const,
}

/** The profile in the real service, reached through `/backend` with a token of its own (see shared/api/backend-client). */
export const profileApi = {
  get: (ownerId: string, signal?: AbortSignal) =>
    backendRequest(ownerId, { method: 'GET', url: '/profile', signal }, profileResponseSchema),
  save: (ownerId: string, body: SaveProfileRequest) =>
    backendRequest(ownerId, { method: 'PUT', url: '/profile', data: body }, profileResponseSchema),
}
