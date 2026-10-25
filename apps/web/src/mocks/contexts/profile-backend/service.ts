import { LocalStoragePersistence, Store } from '../../infra/store'

// Simulation of the collector profile of the REAL service (`apps/api`, specs/014-user-profile). It enforces the
// same rules and answers the same codes as `apps/api/src/domains/profile/contracts.ts` on purpose, written
// independently of the site's form, so a form that lets something through is still caught here, exactly as the real
// service would. State lives under a key of its own (not in the site's `store`): the account and the profile are
// different services, and this one has to survive a reload like a server would.

const ENS_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/
const ENS_TLDS = ['.eth', '.xyz', '.art'] as const
const AVATAR_MAX_BYTES = 1_048_576
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

type EnsTld = (typeof ENS_TLDS)[number]
type AvatarType = (typeof AVATAR_TYPES)[number]

interface ProfileRow {
  displayName: string
  bio: string
  ensName: string
  ensTld: EnsTld
  walletNickname: string
  updatedAt: string
}

interface AvatarRow {
  contentType: AvatarType
  dataUrl: string
  updatedAt: string
}

interface ProfileBackendState {
  profiles: Record<string, ProfileRow>
  avatars: Record<string, AvatarRow>
}

const emptyState = (): ProfileBackendState => ({ profiles: {}, avatars: {} })

/** What `GET/PUT /profile` answers (contracts/profile-endpoints.md). */
export interface ProfileBody {
  displayName: string
  bio: string
  ensName: string
  ensTld: EnsTld
  walletNickname: string
  avatarVersion: string | null
  updatedAt: string | null
}

/** Error carrying the real API's `{ error: { code, message, fields? } }` contract. */
export class ProfileBackendError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

const validationFailed = (fields: Record<string, string>) =>
  new ProfileBackendError(400, 'validation_error', 'Invalid profile.', fields)

/** Characters as the real service counts them (code points). */
const characters = (value: string) => Array.from(value).length

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

interface Validated {
  displayName: string
  bio: string
  ensName: string
  ensTld: EnsTld
  walletNickname: string
}

/** All invalid fields at once, like the real service; a missing or mistyped field is `invalid`. */
function validate(input: unknown): Validated {
  const source = isRecord(input) ? input : {}
  const fields: Record<string, string> = {}

  const text = (name: string): string | undefined => {
    const value = source[name]
    if (typeof value === 'string') return value
    fields[name] = 'invalid'
    return undefined
  }

  const displayName = text('displayName')?.trim()
  if (displayName !== undefined) {
    if (characters(displayName) < 3) fields.displayName = 'too_short'
    else if (characters(displayName) > 60) fields.displayName = 'too_long'
  }

  const bio = text('bio')?.trim()
  if (bio !== undefined && characters(bio) > 280) fields.bio = 'too_long'

  const ensName = text('ensName')
  if (ensName !== undefined && ensName !== '' && !ENS_NAME_PATTERN.test(ensName)) fields.ensName = 'invalid_format'

  const ensTld = text('ensTld')
  const knownTld = ENS_TLDS.find((tld) => tld === ensTld)
  if (ensTld !== undefined && knownTld === undefined) fields.ensTld = 'invalid'

  const walletNickname = text('walletNickname')?.trim()
  if (walletNickname !== undefined && characters(walletNickname) > 40) fields.walletNickname = 'too_long'

  if (Object.keys(fields).length > 0) throw validationFailed(fields)
  // Every field is a valid string here (an invalid one threw above).
  return {
    displayName: displayName ?? '',
    bio: bio ?? '',
    ensName: ensName ?? '',
    ensTld: knownTld ?? '.eth',
    walletNickname: walletNickname ?? '',
  }
}

/** Image type from the first bytes (never from a file name or the declared type), like the real service. */
function detectImageType(bytes: Uint8Array): AvatarType | null {
  const startsWith = (signature: number[], offset = 0) =>
    bytes.length >= offset + signature.length && signature.every((byte, index) => bytes[offset + index] === byte)

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  return null
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

/**
 * Checks the photo of `PUT /profile/avatar`: data URL of PNG/JPEG/WebP, at most 1 MiB DECODED, and the bytes really
 * are that image. The size comes from the base64 length before decoding, so an oversized payload is never decoded.
 */
function parseAvatar(input: unknown): { contentType: AvatarType; dataUrl: string } {
  const invalid = () => validationFailed({ avatar: 'invalid_format' })
  if (typeof input !== 'string') throw invalid()

  const declared = AVATAR_TYPES.find((type) => input.startsWith(`data:${type};base64,`))
  if (declared === undefined) throw invalid()

  const payload = input.slice(`data:${declared};base64,`.length)
  if (payload.length === 0 || payload.length % 4 !== 0 || !BASE64.test(payload)) throw invalid()

  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  if ((payload.length / 4) * 3 - padding > AVATAR_MAX_BYTES) throw validationFailed({ avatar: 'too_large' })

  const binary = atob(payload)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  if (detectImageType(bytes) !== declared) throw invalid()
  return { contentType: declared, dataUrl: input }
}

export class ProfileBackendService {
  private readonly store: Store<ProfileBackendState>
  private readonly now: () => number

  constructor(
    now: () => number = Date.now,
    store: Store<ProfileBackendState> = new Store(
      new LocalStoragePersistence<ProfileBackendState>('nft-mock:backend-profile', 1),
      emptyState,
    ),
  ) {
    this.now = now
    this.store = store
  }

  reset() {
    this.store.reset()
  }

  /** An owner that never saved reads empty values and `updatedAt: null`; never an error. */
  get(ownerId: string): ProfileBody {
    return this.store.read((state) => this.toBody(state, ownerId))
  }

  /** Replaces the five text fields (creating the profile on first use). Nothing is written if any is invalid. */
  save(ownerId: string, input: unknown): ProfileBody {
    const value = validate(input)
    return this.store.write((state) => {
      state.profiles[ownerId] = { ...value, updatedAt: new Date(this.now()).toISOString() }
      return this.toBody(state, ownerId)
    })
  }

  /** The photo and its version, or `404 no_avatar`. */
  getAvatar(ownerId: string): { dataUrl: string; version: string } {
    const avatar = this.store.read((state) => state.avatars[ownerId])
    if (!avatar) throw new ProfileBackendError(404, 'no_avatar', 'This owner has no profile photo.')
    return { dataUrl: avatar.dataUrl, version: avatar.updatedAt }
  }

  /** Replaces the photo after checking format, size and real content; a refused photo leaves the current one. */
  saveAvatar(ownerId: string, input: unknown): ProfileBody {
    const { contentType, dataUrl } = parseAvatar(isRecord(input) ? input.dataUrl : undefined)
    return this.store.write((state) => {
      // A version is the instant of the change: strictly increasing, so a replacement is always a new cache key.
      const previous = Date.parse(state.avatars[ownerId]?.updatedAt ?? '')
      const at = Number.isNaN(previous) ? this.now() : Math.max(this.now(), previous + 1)
      state.avatars[ownerId] = { contentType, dataUrl, updatedAt: new Date(at).toISOString() }
      return this.toBody(state, ownerId)
    })
  }

  /** Idempotent: with or without a photo the owner ends without one. */
  deleteAvatar(ownerId: string): ProfileBody {
    return this.store.write((state) => {
      delete state.avatars[ownerId]
      return this.toBody(state, ownerId)
    })
  }

  private toBody(state: ProfileBackendState, ownerId: string): ProfileBody {
    const profile = state.profiles[ownerId]
    return {
      displayName: profile?.displayName ?? '',
      bio: profile?.bio ?? '',
      ensName: profile?.ensName ?? '',
      ensTld: profile?.ensTld ?? '.eth',
      walletNickname: profile?.walletNickname ?? '',
      avatarVersion: state.avatars[ownerId]?.updatedAt ?? null,
      updatedAt: profile?.updatedAt ?? null,
    }
  }
}

export { AVATAR_MAX_BYTES, AVATAR_TYPES }
export type { AvatarType, ProfileBackendState }
