import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, type Path } from 'react-hook-form'
import {
  ENS_TLDS,
  PROFILE_MESSAGES,
  profileFieldMessages,
  profileFormSchema,
  useProfile,
  useSaveProfile,
  type ProfileFormValues,
  type ProfileResponse,
  type ProfileView,
} from '@/domains/profile'
import { BackendError } from '@/shared/api/backend-client'
import { isApiError } from '@/shared/api/http'
import { AlertIcon } from '@/shared/icons'
import { Button } from '@/shared/ui/button'
import { Field } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { AvatarEditor } from './AvatarEditor'

// The collector's profile (display name, bio, ENS name, wallet nickname): it lives in the real service and is saved
// on its own, never together with the account (specs/014-user-profile, FR-001, FR-016).

const toValues = (profile: Pick<ProfileView | ProfileResponse, 'displayName' | 'bio' | 'ensName' | 'ensTld' | 'walletNickname'>): ProfileFormValues => ({
  displayName: profile.displayName,
  bio: profile.bio,
  ensName: profile.ensName,
  ensTld: profile.ensTld,
  walletNickname: profile.walletNickname,
})

function FormSkeleton() {
  return (
    <div role="status" aria-label="Carregando perfil" className="grid gap-x-12 gap-y-6 md:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="h-[68px] animate-shimmer rounded-sm bg-[linear-gradient(90deg,var(--card)_25%,var(--border)_50%,var(--card)_75%)] bg-[length:200%_100%]"
        />
      ))}
    </div>
  )
}

/** "Última alteração" as the collector's browser formats it. */
const formatSavedAt = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function ProfileForm({ profile }: { profile: ProfileView }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileFormSchema), defaultValues: toValues(profile) })
  const save = useSaveProfile()
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string }>()

  /** Puts the service's per-field answers on the form; any other failure keeps what was typed and says so. */
  function applyServiceErrors(error: unknown) {
    // An expired site session redirects to sign-in on its own; there is nothing to show here.
    if (isApiError(error) && error.isAuthError) return
    if (error instanceof BackendError && error.isValidation) {
      const known = Object.entries(profileFieldMessages(error)).filter(([name]) => name in profileFormSchema.shape)
      known.forEach(([name, message]) => setError(name as Path<ProfileFormValues>, { type: 'server', message }))
      if (known.length > 0) {
        setFocus(known[0][0] as Path<ProfileFormValues>)
        return setStatus({ kind: 'error', message: 'Corrija os campos destacados.' })
      }
    }
    setStatus({ kind: 'error', message: PROFILE_MESSAGES.save })
  }

  async function onSubmit(values: ProfileFormValues) {
    setStatus(undefined)
    try {
      const saved = await save.mutateAsync(values)
      reset(toValues(saved))
      setStatus({ kind: 'success', message: 'Alterações salvas.' })
    } catch (error) {
      applyServiceErrors(error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
      <div className="grid gap-x-12 gap-y-6 md:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName?.message}>
          <Input autoComplete="name" {...register('displayName')} />
        </Field>
        <div className="flex flex-col gap-2">
          <Label id="ens-label" htmlFor="ens-name">
            Nome ENS
          </Label>
          <div className="flex gap-2" role="group" aria-labelledby="ens-label">
            <Select aria-label="Domínio ENS" className="w-[92px] shrink-0" {...register('ensTld')}>
              {ENS_TLDS.map((tld) => (
                <option key={tld} value={tld}>
                  {tld}
                </option>
              ))}
            </Select>
            <Input
              id="ens-name"
              aria-invalid={errors.ensName ? true : undefined}
              aria-describedby={errors.ensName ? 'ens-error' : undefined}
              {...register('ensName')}
            />
          </div>
          {errors.ensName && (
            <p id="ens-error" role="alert" className="flex items-start gap-1 text-caption text-destructive">
              <AlertIcon aria-hidden="true" strokeWidth={1.5} size={14} className="mt-0.5 shrink-0" />
              {errors.ensName.message}
            </p>
          )}
        </div>
        <Field label="Apelido da carteira" error={errors.walletNickname?.message}>
          <Input {...register('walletNickname')} />
        </Field>
        <Field label="Bio" error={errors.bio?.message} className="md:col-span-2">
          <Textarea rows={3} {...register('bio')} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Salvando…' : 'Salvar perfil'}
        </Button>
        <p
          role={status?.kind === 'error' ? 'alert' : 'status'}
          className={status?.kind === 'error' ? 'text-body text-destructive' : 'text-body text-success'}
        >
          {status?.message}
        </p>
        {profile.updatedAt && (
          <p className="text-caption text-muted-foreground">Última alteração: {formatSavedAt(profile.updatedAt)}</p>
        )}
      </div>
    </form>
  )
}

export function ProfileSection() {
  const profile = useProfile()

  return (
    <section aria-labelledby="profile-section-title" className="flex flex-col gap-6">
      <h2 id="profile-section-title" className="text-title font-bold">
        Perfil
      </h2>
      {profile.isPending && !profile.isError ? <FormSkeleton /> : null}
      {profile.data && (
        <>
          <AvatarEditor avatarUrl={profile.data.avatarUrl} />
          <ProfileForm profile={profile.data} />
        </>
      )}
      {profile.isError && (
        // The form is NOT shown with invented data; the account section above keeps working (FR-011, FR-016).
        <div role="alert" className="flex flex-col items-start gap-4">
          <p>{PROFILE_MESSAGES.load}</p>
          <Button onClick={() => profile.refetch()}>Tentar novamente</Button>
        </div>
      )}
    </section>
  )
}
