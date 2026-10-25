import { useRef, useState, type ChangeEvent } from 'react'
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  PROFILE_MESSAGES,
  profileFieldMessage,
  useRemoveAvatar,
  useUpdateAvatar,
} from '@/domains/profile'
import { BackendError } from '@/shared/api/backend-client'
import { isApiError } from '@/shared/api/http'
import { AvatarIcon } from '@/shared/icons'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

const isAcceptedType = (type: string) => (AVATAR_TYPES as readonly string[]).includes(type)

/**
 * The photo of the profile. It saves on its own and at once (no "save" button), apart from the text fields, so it
 * sits outside the form: its buttons are `type="button"` and can never submit it.
 */
export function AvatarEditor({ avatarUrl }: { avatarUrl: string | null }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string>()
  const update = useUpdateAvatar()
  const remove = useRemoveAvatar()
  const busy = update.isPending || remove.isPending

  /** The service's per-field answer for the photo; an expired site session redirects to sign-in by itself. */
  function messageFor(failure: unknown, fallback: string) {
    if (isApiError(failure) && failure.isAuthError) return undefined
    if (failure instanceof BackendError && failure.isValidation) {
      return profileFieldMessage('avatar', failure.fields.avatar ?? '')
    }
    return fallback
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    // Obvious mistakes never leave the browser; the service still checks the real content (FR-005).
    if (!isAcceptedType(file.type)) return setError(PROFILE_MESSAGES.avatarInvalidFormat)
    if (file.size > AVATAR_MAX_BYTES) return setError(PROFILE_MESSAGES.avatarTooLarge)
    setError(undefined)
    let dataUrl: string
    try {
      dataUrl = await readAsDataUrl(file)
    } catch {
      return setError(PROFILE_MESSAGES.avatarRead)
    }
    try {
      await update.mutateAsync({ dataUrl })
    } catch (failure) {
      setError(messageFor(failure, PROFILE_MESSAGES.avatarSave))
    }
  }

  async function onRemove() {
    setError(undefined)
    try {
      await remove.mutateAsync()
    } catch (failure) {
      setError(messageFor(failure, PROFILE_MESSAGES.avatarRemove))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span id="avatar-label" className="text-body">
        Avatar
      </span>
      <div className="flex flex-wrap items-center gap-6" role="group" aria-labelledby="avatar-label">
        <Avatar className="size-[50px] bg-card text-primary">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="Seu avatar atual" /> : null}
          <AvatarFallback className="bg-card text-primary">
            <AvatarIcon strokeWidth={1.5} size={22} role="img" aria-label="Nenhum avatar definido" />
          </AvatarFallback>
        </Avatar>
        <input
          ref={input}
          type="file"
          accept={AVATAR_TYPES.join(',')}
          onChange={onFile}
          className="sr-only"
          tabIndex={-1}
          aria-label="Selecionar imagem de avatar"
        />
        <Button type="button" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {update.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy || !avatarUrl} onClick={onRemove} className="px-0">
          Remover
        </Button>
      </div>
      <p role="status" className="sr-only">
        {update.isSuccess ? 'Avatar atualizado.' : remove.isSuccess ? 'Avatar removido.' : ''}
      </p>
      {error && (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
