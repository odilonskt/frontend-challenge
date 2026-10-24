import * as blobStore from "../../lib/blobStore.js"
import { getDummyHash, hashPassword, verifyPassword } from "../../lib/password.js"
import type { AdminPublic, AdminUser } from "./contracts.js"

const MIN_PASSWORD_LENGTH = 8

function toPublic(user: AdminUser): AdminPublic {
  return { id: user.id, email: user.email, role: user.role }
}

/** Creates the admin, or replaces its password if the e-mail already exists (used by the seed script). */
export async function upsertAdmin(
  email: string,
  password: string,
): Promise<{ admin: AdminPublic; created: boolean }> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Admin password must have at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  const normalized = blobStore.normalizeEmail(email)
  const existing = await blobStore.readAdminUser(normalized)
  const user: AdminUser = {
    id: blobStore.adminIdFor(normalized),
    email: normalized,
    role: "admin",
    passwordHash: await hashPassword(password),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }
  await blobStore.writeAdminUser(user)
  return { admin: toPublic(user), created: existing === null }
}

/**
 * Returns the admin when the credentials are valid, otherwise `null` — never says *which* part was
 * wrong. A hash is verified even for an unknown e-mail so both failures take the same time.
 */
export async function authenticateAdmin(email: string, password: string): Promise<AdminPublic | null> {
  const user = await blobStore.readAdminUser(email)
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()))
  return user && valid ? toPublic(user) : null
}

export function listOwners(limit: number, cursor?: string) {
  return blobStore.listOwners(limit, cursor)
}
