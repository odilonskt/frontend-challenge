import type { AvatarContentType, AvatarRecord, ProfileRecord, SaveProfileInput } from "./contracts.js"

/**
 * Port of the profile domain: the service depends on this interface only, so its rules run without a database
 * (the in-memory adapter of `pnpm smoke-test:profile:local`) and Prisma stays inside the adapter.
 */
export interface ProfileRepository {
  /** The saved profile of the owner, or `null` when it never saved one. */
  getProfile(ownerId: string): Promise<ProfileRecord | null>

  /** Replaces the five text fields and returns the stored record; creates it on first use (last write wins). */
  saveProfile(ownerId: string, input: SaveProfileInput): Promise<ProfileRecord>

  /** Instant of the last photo change, or `null` without a photo. Never loads the image bytes. */
  getAvatarVersion(ownerId: string): Promise<Date | null>

  /** The stored photo (bytes included), or `null` without one. */
  getAvatar(ownerId: string): Promise<AvatarRecord | null>

  /** Replaces the photo (creating it on first use) and returns its new version. */
  saveAvatar(ownerId: string, avatar: { contentType: AvatarContentType; data: Uint8Array }): Promise<Date>

  /** Removes the photo. Idempotent: removing what is not there is not an error. */
  deleteAvatar(ownerId: string): Promise<void>
}
