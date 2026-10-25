import {
  AvatarNotFoundError,
  ProfileValidationError,
  parseAvatarDataUrl,
  saveAvatarSchema,
  toDataUrl,
  toProfileResponse,
  validateSaveProfile,
  type AvatarResponse,
  type ProfileResponse,
} from "./contracts.js"
import { PrismaProfileRepository } from "./prismaProfileRepository.js"
import type { ProfileRepository } from "./repository.js"

// The service depends on the `ProfileRepository` port only; storage lives in the adapter. Rules (validation,
// the empty profile of an owner that never saved, the photo checks) live in contracts.ts as pure functions.
export function createProfileService(repository: ProfileRepository) {
  /** Never fails for an owner without a saved profile: it reads as empty values (`updatedAt: null`). */
  async function getProfile(ownerId: string): Promise<ProfileResponse> {
    const [record, avatarVersion] = await Promise.all([
      repository.getProfile(ownerId),
      repository.getAvatarVersion(ownerId),
    ])
    return toProfileResponse(record, avatarVersion)
  }

  return {
    getProfile,

    /** Replaces the five text fields (creating the profile on first use). Nothing is written if any field is invalid. */
    async saveProfile(ownerId: string, body: unknown): Promise<ProfileResponse> {
      const parsed = validateSaveProfile(body)
      if (!parsed.ok) throw new ProfileValidationError(parsed.fields)

      const record = await repository.saveProfile(ownerId, parsed.value)
      return toProfileResponse(record, await repository.getAvatarVersion(ownerId))
    },

    /** The photo as a data URL plus its version; `AvatarNotFoundError` when the owner has none. */
    async getAvatar(ownerId: string): Promise<AvatarResponse> {
      const avatar = await repository.getAvatar(ownerId)
      if (avatar === null) throw new AvatarNotFoundError()
      return { dataUrl: toDataUrl(avatar), version: avatar.updatedAt.toISOString() }
    },

    /** Replaces the photo after checking format, size and real content; a refused photo leaves the current one. */
    async saveAvatar(ownerId: string, body: unknown): Promise<ProfileResponse> {
      const shape = saveAvatarSchema.safeParse(body)
      const parsed = parseAvatarDataUrl(shape.success ? shape.data.dataUrl : undefined)
      if (!parsed.ok) throw new ProfileValidationError(parsed.fields)

      await repository.saveAvatar(ownerId, parsed.value)
      return getProfile(ownerId)
    },

    /** Idempotent: with or without a photo the owner ends without one. */
    async deleteAvatar(ownerId: string): Promise<ProfileResponse> {
      await repository.deleteAvatar(ownerId)
      return getProfile(ownerId)
    },
  }
}

export type ProfileService = ReturnType<typeof createProfileService>

// The database client is created lazily on the first query, so building the default service is free.
export const profileService: ProfileService = createProfileService(new PrismaProfileRepository())
