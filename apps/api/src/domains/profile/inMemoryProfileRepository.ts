import type { AvatarContentType, AvatarRecord, ProfileRecord, SaveProfileInput } from "./contracts.js"
import type { ProfileRepository } from "./repository.js"

/**
 * In-memory adapter of the profile port. It exists ONLY for local verification (`pnpm smoke-test:profile:local`,
 * which runs the real Express app over it, no database) and for exercising the service's rules; production wires
 * the Prisma adapter (service.ts). Not imported by anything that ships to Vercel.
 */
export class InMemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<string, ProfileRecord>()
  private readonly avatars = new Map<string, AvatarRecord>()
  private readonly now: () => Date

  constructor(now: () => Date = () => new Date()) {
    this.now = now
  }

  getProfile(ownerId: string): Promise<ProfileRecord | null> {
    return Promise.resolve(this.profiles.get(ownerId) ?? null)
  }

  saveProfile(ownerId: string, input: SaveProfileInput): Promise<ProfileRecord> {
    const record: ProfileRecord = { ownerId, ...input, updatedAt: this.now() }
    this.profiles.set(ownerId, record)
    return Promise.resolve(record)
  }

  getAvatarVersion(ownerId: string): Promise<Date | null> {
    return Promise.resolve(this.avatars.get(ownerId)?.updatedAt ?? null)
  }

  getAvatar(ownerId: string): Promise<AvatarRecord | null> {
    return Promise.resolve(this.avatars.get(ownerId) ?? null)
  }

  saveAvatar(ownerId: string, avatar: { contentType: AvatarContentType; data: Uint8Array }): Promise<Date> {
    const updatedAt = this.now()
    this.avatars.set(ownerId, { contentType: avatar.contentType, data: avatar.data, updatedAt })
    return Promise.resolve(updatedAt)
  }

  deleteAvatar(ownerId: string): Promise<void> {
    this.avatars.delete(ownerId)
    return Promise.resolve()
  }
}
