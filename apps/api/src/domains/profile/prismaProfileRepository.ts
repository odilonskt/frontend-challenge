import { z } from "zod"
import type { Profile } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/db.js"
import { ENS_TLDS, type ProfileRecord, type SaveProfileInput } from "./contracts.js"
import type { ProfileRepository } from "./repository.js"

// Prisma adapter of the profile port (constitution 1.6.0). Reads use the typed client; the write is ONE
// `INSERT ... ON CONFLICT` statement: the Neon HTTP adapter has no transactions, and a single statement is atomic
// anyway, so two concurrent saves end in one complete row (the last one), never a mix. Prisma types never leave
// this file: the domain only sees the records from contracts.ts.

const ensTld = z.enum(ENS_TLDS)

// timestamptz arrives as a Date from $queryRaw: coerce at the boundary (Principle II).
const savedRowSchema = z.object({
  owner_id: z.string(),
  display_name: z.string(),
  bio: z.string(),
  ens_name: z.string(),
  ens_tld: ensTld,
  wallet_nickname: z.string(),
  updated_at: z.coerce.date(),
})

function toRecord(row: Profile): ProfileRecord {
  return {
    ownerId: row.ownerId,
    displayName: row.displayName,
    bio: row.bio,
    ensName: row.ensName,
    ensTld: ensTld.parse(row.ensTld),
    walletNickname: row.walletNickname,
    updatedAt: row.updatedAt,
  }
}

export class PrismaProfileRepository implements ProfileRepository {
  async getProfile(ownerId: string): Promise<ProfileRecord | null> {
    const row = await prisma().profile.findUnique({ where: { ownerId } })
    return row === null ? null : toRecord(row)
  }

  async saveProfile(ownerId: string, input: SaveProfileInput): Promise<ProfileRecord> {
    const rows = await prisma().$queryRaw`
      INSERT INTO profiles (owner_id, display_name, bio, ens_name, ens_tld, wallet_nickname, updated_at)
      VALUES (${ownerId}, ${input.displayName}, ${input.bio}, ${input.ensName}, ${input.ensTld},
              ${input.walletNickname}, CURRENT_TIMESTAMP)
      ON CONFLICT (owner_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        bio = EXCLUDED.bio,
        ens_name = EXCLUDED.ens_name,
        ens_tld = EXCLUDED.ens_tld,
        wallet_nickname = EXCLUDED.wallet_nickname,
        updated_at = CURRENT_TIMESTAMP
      RETURNING owner_id, display_name, bio, ens_name, ens_tld, wallet_nickname, updated_at`

    const row = savedRowSchema.parse(z.array(z.unknown()).length(1).parse(rows)[0])
    return {
      ownerId: row.owner_id,
      displayName: row.display_name,
      bio: row.bio,
      ensName: row.ens_name,
      ensTld: row.ens_tld,
      walletNickname: row.wallet_nickname,
      updatedAt: row.updated_at,
    }
  }

  async getAvatarVersion(ownerId: string): Promise<Date | null> {
    const row = await prisma().profileAvatar.findUnique({ where: { ownerId }, select: { updatedAt: true } })
    return row?.updatedAt ?? null
  }
}
