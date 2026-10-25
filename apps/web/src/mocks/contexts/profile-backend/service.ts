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
