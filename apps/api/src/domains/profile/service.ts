import { ProfileValidationError, toProfileResponse, validateSaveProfile, type ProfileResponse } from "./contracts.js"
import { PrismaProfileRepository } from "./prismaProfileRepository.js"
import type { ProfileRepository } from "./repository.js"

// The service depends on the `ProfileRepository` port only; storage lives in the adapter. Rules (validation,
// the empty profile of an owner that never saved) live in contracts.ts as pure functions.
export function createProfileService(repository: ProfileRepository) {
  return {
    /** Never fails for an owner without a saved profile: it reads as empty values (`updatedAt: null`). */
    async getProfile(ownerId: string): Promise<ProfileResponse> {
      const [record, avatarVersion] = await Promise.all([
        repository.getProfile(ownerId),
        repository.getAvatarVersion(ownerId),
      ])
      return toProfileResponse(record, avatarVersion)
    },

    /** Replaces the five text fields (creating the profile on first use). Nothing is written if any field is invalid. */
    async saveProfile(ownerId: string, body: unknown): Promise<ProfileResponse> {
      const parsed = validateSaveProfile(body)
      if (!parsed.ok) throw new ProfileValidationError(parsed.fields)

      const record = await repository.saveProfile(ownerId, parsed.value)
      return toProfileResponse(record, await repository.getAvatarVersion(ownerId))
    },
  }
}

export type ProfileService = ReturnType<typeof createProfileService>

// The database client is created lazily on the first query, so building the default service is free.
export const profileService: ProfileService = createProfileService(new PrismaProfileRepository())
