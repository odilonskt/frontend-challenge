import { ImageUp } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { isApiError } from '@/shared/api/http'
import { Button } from '@/shared/ui/button'
import { useRemoveAvatar, useUpdateAvatar, type Profile } from '@/domains/profile'

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 1024 * 1024

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export function AvatarEditor({ avatarUrl }: Pick<Profile, 'avatarUrl'>) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string>()
  const update = useUpdateAvatar()
  const remove = useRemoveAvatar()
  const busy = update.isPending || remove.isPending

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!ACCEPTED.includes(file.type)) return setError('Envie uma imagem PNG, JPEG ou WebP.')
    if (file.size > MAX_BYTES) return setError('A imagem deve ter no máximo 1 MB.')
    setError(undefined)
    try {
      await update.mutateAsync({ dataUrl: await readAsDataUrl(file) })
    } catch (e) {
      setError(isApiError(e) ? (e.fields.avatar ?? e.message) : 'Não foi possível ler a imagem.')
    }
  }

  async function onRemove() {
    setError(undefined)
    try {
      await remove.mutateAsync()
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Não foi possível remover o avatar.')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span id="avatar-label" className="text-sm">
        Avatar
      </span>
      <div className="flex flex-wrap items-center gap-6" role="group" aria-labelledby="avatar-label">
        <div className="flex size-[50px] items-center justify-center overflow-hidden rounded-full bg-card text-primary">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Seu avatar atual" className="size-full object-cover" />
          ) : (
            <ImageUp aria-label="Nenhum avatar definido" role="img" size={22} />
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPTED.join(',')}
          onChange={onFile}
          className="sr-only"
          tabIndex={-1}
          aria-label="Selecionar imagem de avatar"
        />
        <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {update.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy || !avatarUrl} onClick={onRemove} className="px-0">
          Remover
        </Button>
      </div>
      <p role="status" className="sr-only">
        {update.isSuccess ? 'Avatar atualizado.' : remove.isSuccess ? 'Avatar removido.' : ''}
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
