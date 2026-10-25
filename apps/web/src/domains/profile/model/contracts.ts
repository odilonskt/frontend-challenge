import { z } from 'zod'
import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  ENS_NAME_PATTERN,
  ENS_TLDS,
  WALLET_NICKNAME_MAX,
  characters,
} from './limits'
import { PROFILE_MESSAGES } from './messages'

export { AVATAR_MAX_BYTES, AVATAR_TYPES, ENS_TLDS, type EnsTld } from './limits'

// --- What the real service answers (validated at the border, constitution Principle II) ---------------------

export const profileResponseSchema = z.object({
  displayName: z.string(),
  bio: z.string(),
  ensName: z.string(),
  ensTld: z.enum(ENS_TLDS),
  walletNickname: z.string(),
  /** Instant of the last photo change, or `null` without a photo; the image is cached by it. */
  avatarVersion: z.string().nullable(),
  /** Instant of the last save, or `null` when the collector never saved a profile. */
  updatedAt: z.string().nullable(),
})

export type ProfileResponse = z.infer<typeof profileResponseSchema>

export const avatarResponseSchema = z.object({
  dataUrl: z.string(),
  version: z.string(),
})

export type AvatarResponse = z.infer<typeof avatarResponseSchema>

// --- What the site sends ------------------------------------------------------------------------------------

export interface SaveProfileRequest {
  displayName: string
  bio: string
  ensName: string
  ensTld: (typeof ENS_TLDS)[number]
  walletNickname: string
}

export interface SaveAvatarRequest {
  /** `data:image/png|jpeg|webp;base64,...`, at most 1 MB once decoded. */
  dataUrl: string
}

// --- What the screens use -----------------------------------------------------------------------------------

/**
 * The profile as the page shows it. A collector that never saved one has an empty `displayName` in the service;
 * the view shows the name from the account instead (FR-008), and a photo only once it has been fetched.
 */
export interface ProfileView {
  displayName: string
  bio: string
  ensName: string
  ensTld: (typeof ENS_TLDS)[number]
  walletNickname: string
  /** `null` when the collector never saved the profile. */
  updatedAt: string | null
  avatarUrl: string | null
}

/** What the navigation bar needs; always defined for a signed-in user (it falls back to the account's name). */
export interface ProfileSummary {
  displayName: string
  avatarUrl: string | null
}

// --- Form rules (the same ones the service enforces; spec FR-003) --------------------------------------------

export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .refine((value) => characters(value) >= DISPLAY_NAME_MIN, PROFILE_MESSAGES.displayNameTooShort)
    .refine((value) => characters(value) <= DISPLAY_NAME_MAX, PROFILE_MESSAGES.displayNameTooLong),
  bio: z
    .string()
    .trim()
    .refine((value) => characters(value) <= BIO_MAX, PROFILE_MESSAGES.bioTooLong),
  // Optional: an empty label is valid; a filled one needs the ENS format.
  ensName: z.string().refine((value) => value === '' || ENS_NAME_PATTERN.test(value), PROFILE_MESSAGES.ensNameInvalid),
  ensTld: z.enum(ENS_TLDS),
  // Optional too: no minimum.
  walletNickname: z
    .string()
    .trim()
    .refine((value) => characters(value) <= WALLET_NICKNAME_MAX, PROFILE_MESSAGES.walletNicknameTooLong),
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>
