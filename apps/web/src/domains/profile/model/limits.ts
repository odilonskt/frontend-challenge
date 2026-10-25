// Rules of the profile (specs/014-user-profile, data-model.md). The real service (`apps/api`) and its simulation
// (`mocks/contexts/profile-backend`) enforce the same ones; the form checks them first so most mistakes never
// leave the browser. Lengths count characters (code points), like the service and the database.

export const ENS_TLDS = ['.eth', '.xyz', '.art'] as const
export type EnsTld = (typeof ENS_TLDS)[number]

export const DISPLAY_NAME_MIN = 3
export const DISPLAY_NAME_MAX = 60
export const BIO_MAX = 280
export const WALLET_NICKNAME_MAX = 40

/** ENS label without the TLD; an empty label is allowed (the field is optional). */
export const ENS_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/

export const AVATAR_MAX_BYTES = 1024 * 1024
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Characters as the service counts them (code points, not UTF-16 units). */
export const characters = (value: string): number => Array.from(value).length
