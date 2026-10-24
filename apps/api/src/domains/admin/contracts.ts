import { z } from "zod"

export const adminUserSchema = z.object({
  /** sha256 of the normalised e-mail; also the `sub` claim of the admin's tokens. */
  id: z.string().min(1),
  email: z.string().email(),
  role: z.literal("admin"),
  /** `scrypt$<salt>$<key>` — never the password itself. */
  passwordHash: z.string().min(1),
  createdAt: z.string().datetime(),
})

export type AdminUser = z.infer<typeof adminUserSchema>

/** What the API may return about an admin: never the hash. */
export type AdminPublic = Pick<AdminUser, "id" | "email" | "role">

export const loginRequestSchema = z.object({
  email: z.string().trim().max(254).email(),
  password: z.string().min(1).max(256),
})

/** Owner ids end up inside Blob pathnames, so they must not contain `/` (it would alias another owner's prefix). */
export const ownerIdParamSchema = z.string().regex(/^[A-Za-z0-9_.-]{1,128}$/)
