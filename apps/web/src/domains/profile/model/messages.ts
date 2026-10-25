import { BackendError } from '@/shared/api/backend-client'
import { BIO_MAX, DISPLAY_NAME_MAX, DISPLAY_NAME_MIN, WALLET_NICKNAME_MAX } from './limits'

/** The messages the profile page has always shown; the form schema and the API's field codes share them. */
export const PROFILE_MESSAGES = {
  displayNameTooShort: `Informe pelo menos ${DISPLAY_NAME_MIN} caracteres.`,
  displayNameTooLong: `Use no máximo ${DISPLAY_NAME_MAX} caracteres.`,
  bioTooLong: `Use no máximo ${BIO_MAX} caracteres.`,
  ensNameInvalid: 'Use de 3 a 40 letras minúsculas, números ou hífen.',
  ensTldInvalid: 'Domínio ENS inválido.',
  walletNicknameTooLong: `Use no máximo ${WALLET_NICKNAME_MAX} caracteres.`,
  avatarInvalidFormat: 'Envie uma imagem PNG, JPEG ou WebP.',
  avatarTooLarge: 'A imagem deve ter no máximo 1 MB.',
  load: 'Não foi possível carregar o perfil.',
  save: 'Não foi possível salvar o perfil. Tente novamente.',
  avatarSave: 'Não foi possível salvar a foto. Tente novamente.',
  avatarRemove: 'Não foi possível remover a foto. Tente novamente.',
  avatarRead: 'Não foi possível ler a imagem.',
  invalidField: 'Valor inválido.',
} as const

/** Per-field problem codes of the service's `validation_error` (contracts/profile-endpoints.md) → page messages. */
const FIELD_MESSAGES: Record<string, Record<string, string>> = {
  displayName: { too_short: PROFILE_MESSAGES.displayNameTooShort, too_long: PROFILE_MESSAGES.displayNameTooLong },
  bio: { too_long: PROFILE_MESSAGES.bioTooLong },
  ensName: { invalid_format: PROFILE_MESSAGES.ensNameInvalid },
  ensTld: { invalid: PROFILE_MESSAGES.ensTldInvalid },
  walletNickname: { too_long: PROFILE_MESSAGES.walletNicknameTooLong },
  avatar: { invalid_format: PROFILE_MESSAGES.avatarInvalidFormat, too_large: PROFILE_MESSAGES.avatarTooLarge },
}

export function profileFieldMessage(field: string, code: string): string {
  return FIELD_MESSAGES[field]?.[code] ?? PROFILE_MESSAGES.invalidField
}

/** Messages of the invalid fields of a service answer, keyed by field; empty when the error carries none. */
export function profileFieldMessages(error: unknown): Record<string, string> {
  if (!(error instanceof BackendError)) return {}
  return Object.fromEntries(Object.entries(error.fields).map(([field, code]) => [field, profileFieldMessage(field, code)]))
}
