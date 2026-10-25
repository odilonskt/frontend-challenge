import { z } from "zod"

// Collector profile (specs/014-user-profile). Pure rules and shapes: no Express, no Prisma. The same Zod schemas
// validate the requests and feed the OpenAPI document (single source, like the coins contracts).

export const DISPLAY_NAME_MIN = 3
export const DISPLAY_NAME_MAX = 60
export const BIO_MAX = 280
export const WALLET_NICKNAME_MAX = 40
/** ENS label without the TLD; an empty label is allowed (the field is optional). */
export const ENS_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/
export const ENS_TLDS = [".eth", ".xyz", ".art"] as const
export type EnsTld = (typeof ENS_TLDS)[number]

export const AVATAR_MAX_BYTES = 1_048_576
export const AVATAR_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const
export type AvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number]

/**
 * Lengths count code points, not UTF-16 units, so they agree with Postgres `char_length` (the CHECKs of the
 * `1_profile` migration): a value the service accepts can never be refused by the database.
 */
const length = (value: string): number => Array.from(value).length

// --- Request: PUT /profile ----------------------------------------------------------------------------------
// The refinement messages ARE the per-field problem codes of the `validation_error` response.

export const saveProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .refine((value) => length(value) >= DISPLAY_NAME_MIN, { error: "too_short" })
    .refine((value) => length(value) <= DISPLAY_NAME_MAX, { error: "too_long" })
    .describe(`${DISPLAY_NAME_MIN} to ${DISPLAY_NAME_MAX} characters after trimming.`),
  bio: z
    .string()
    .trim()
    .refine((value) => length(value) <= BIO_MAX, { error: "too_long" })
    .describe(`Up to ${BIO_MAX} characters after trimming; may be empty.`),
  ensName: z
    .string()
    .refine((value) => value === "" || ENS_NAME_PATTERN.test(value), { error: "invalid_format" })
    .describe("ENS label without the TLD: empty, or 3 to 40 lowercase letters, digits or hyphens (not leading)."),
  ensTld: z.enum(ENS_TLDS),
  walletNickname: z
    .string()
    .trim()
    .refine((value) => length(value) <= WALLET_NICKNAME_MAX, { error: "too_long" })
    .describe(`Up to ${WALLET_NICKNAME_MAX} characters after trimming; may be empty.`),
})

export type SaveProfileInput = z.infer<typeof saveProfileSchema>

/** Request body of `PUT /profile/avatar`; the data URL itself is checked by {@link parseAvatarDataUrl}. */
export const saveAvatarSchema = z.object({
  dataUrl: z
    .string()
    .describe(`\`data:image/(png|jpeg|webp);base64,...\`, at most ${AVATAR_MAX_BYTES} bytes once decoded.`),
})

export type SaveAvatarRequest = z.infer<typeof saveAvatarSchema>

// --- Responses ----------------------------------------------------------------------------------------------

export const profileResponseSchema = z.object({
  displayName: z.string(),
  bio: z.string(),
  ensName: z.string(),
  ensTld: z.enum(ENS_TLDS),
  walletNickname: z.string(),
  /** Instant of the last photo change, or `null` without a photo; the client caches the image by it. */
  avatarVersion: z.string().datetime().nullable(),
  /** Instant of the last profile save, or `null` when the owner never saved one. */
  updatedAt: z.string().datetime().nullable(),
})

export type ProfileResponse = z.infer<typeof profileResponseSchema>

export const avatarResponseSchema = z.object({
  dataUrl: z.string(),
  version: z.string().datetime(),
})

export type AvatarResponse = z.infer<typeof avatarResponseSchema>

// --- Records (what the repository port stores and returns) --------------------------------------------------

export interface ProfileRecord extends SaveProfileInput {
  ownerId: string
  updatedAt: Date
}

export interface AvatarRecord {
  contentType: AvatarContentType
  data: Uint8Array
  updatedAt: Date
}

// --- Validation ---------------------------------------------------------------------------------------------

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; fields: Record<string, string> }

/** Thrown by the service when a request fails validation; the route turns it into `400 validation_error`. */
export class ProfileValidationError extends Error {
  readonly fields: Record<string, string>

  constructor(fields: Record<string, string>) {
    super("Invalid profile.")
    this.fields = fields
  }
}

/** Thrown by the service when the owner has no photo; the route turns it into `404 no_avatar`. */
export class AvatarNotFoundError extends Error {
  constructor() {
    super("This owner has no profile photo.")
  }
}

/**
 * Validates a `PUT /profile` body. Every invalid field comes back at once (`fields`), nothing is saved when any
 * fails. A refinement reports its own code; a missing field, a wrong type or an unknown TLD is `invalid`.
 */
export function validateSaveProfile(input: unknown): ValidationResult<SaveProfileInput> {
  const source = typeof input === "object" && input !== null ? input : {}
  const parsed = saveProfileSchema.safeParse(source)
  if (parsed.success) return { ok: true, value: parsed.data }

  const fields: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "body")
    if (!(field in fields)) fields[field] = issue.code === "custom" ? issue.message : "invalid"
  }
  return { ok: false, fields }
}

/** Image type from the first bytes (never from a file name or a declared type). */
export function detectImageType(bytes: Uint8Array): AvatarContentType | null {
  const startsWith = (signature: number[], offset = 0) =>
    bytes.length >= offset + signature.length && signature.every((byte, index) => bytes[offset + index] === byte)

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg"
  // RIFF <4-byte size> WEBP
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"
  return null
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

/**
 * Parses and checks the photo of `PUT /profile/avatar`: format, size and real content. The decoded size comes
 * from the base64 length BEFORE decoding, so an oversized payload is refused without being decoded.
 * Problem codes (`fields.avatar`): `invalid_format` | `too_large`.
 */
export function parseAvatarDataUrl(input: unknown): ValidationResult<{ contentType: AvatarContentType; data: Uint8Array }> {
  const invalid = { ok: false, fields: { avatar: "invalid_format" } } as const
  if (typeof input !== "string") return invalid

  const declared = AVATAR_CONTENT_TYPES.find((type) => input.startsWith(`data:${type};base64,`))
  if (declared === undefined) return invalid

  const payload = input.slice(`data:${declared};base64,`.length)
  if (payload.length === 0 || payload.length % 4 !== 0 || !BASE64.test(payload)) return invalid

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0
  const decodedBytes = (payload.length / 4) * 3 - padding
  if (decodedBytes > AVATAR_MAX_BYTES) return { ok: false, fields: { avatar: "too_large" } }

  const data = new Uint8Array(Buffer.from(payload, "base64"))
  if (detectImageType(data) !== declared) return invalid
  return { ok: true, value: { contentType: declared, data } }
}

/** `data:<type>;base64,...` for a stored photo. */
export function toDataUrl(avatar: Pick<AvatarRecord, "contentType" | "data">): string {
  return `data:${avatar.contentType};base64,${Buffer.from(avatar.data).toString("base64")}`
}

/** An owner without a saved profile reads as empty values and `updatedAt: null`; never as an error. */
export function toProfileResponse(record: ProfileRecord | null, avatarVersion: Date | null): ProfileResponse {
  return {
    displayName: record?.displayName ?? "",
    bio: record?.bio ?? "",
    ensName: record?.ensName ?? "",
    ensTld: record?.ensTld ?? ".eth",
    walletNickname: record?.walletNickname ?? "",
    avatarVersion: avatarVersion?.toISOString() ?? null,
    updatedAt: record?.updatedAt.toISOString() ?? null,
  }
}
