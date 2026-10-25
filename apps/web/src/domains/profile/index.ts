// Public API of the `profile` domain: the collector's profile in the real service (specs/014-user-profile).
// Other layers import ONLY from here. The account's own data (username, e-mail, password) is in `auth`.
export * from './model/contracts'
export * from './model/messages'
export * from './hooks/useProfile'
export { useRemoveAvatar, useUpdateAvatar } from './hooks/useProfileAvatar'
