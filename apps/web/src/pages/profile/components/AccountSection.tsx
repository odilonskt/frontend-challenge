import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, type Path } from 'react-hook-form'
import { z } from 'zod'
import { useChangePassword, useSession, useUpdateAccount, type SessionUser } from '@/domains/auth'
import { isApiError } from '@/shared/api/http'
import { Button } from '@/shared/ui/button'
import { Field } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { PasswordInput } from '@/shared/ui/password-input'

// The account's own data (the login identity): username, e-mail and password. It lives in the site's simulated
// account and is saved on its own, never together with the profile (specs/014-user-profile, FR-012, FR-016).

const schema = z
  .object({
    username: z.string().regex(/^[a-z0-9_]{3,20}$/, 'Use de 3 a 20 caracteres: letras minúsculas, números ou _.'),
    email: z.email('Informe um e-mail válido.'),
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    const changing = v.currentPassword || v.newPassword || v.confirmPassword
    if (!changing) return
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (!v.currentPassword) issue('currentPassword', 'Informe a senha atual.')
    if (v.newPassword.length < 8) issue('newPassword', 'A senha precisa de pelo menos 8 caracteres.')
    else if (!/[A-Za-z]/.test(v.newPassword) || !/\d/.test(v.newPassword)) issue('newPassword', 'Use letras e números na senha.')
    if (v.confirmPassword !== v.newPassword) issue('confirmPassword', 'As senhas não coincidem.')
  })

type FormValues = z.infer<typeof schema>

const PASSWORD_FIELDS = { currentPassword: '', newPassword: '', confirmPassword: '' }

const toValues = (user: Pick<SessionUser, 'username' | 'email'>): FormValues => ({
  username: user.username,
  email: user.email,
  ...PASSWORD_FIELDS,
})

function AccountForm({ user }: { user: SessionUser }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toValues(user) })
  const updateAccount = useUpdateAccount()
  const changePassword = useChangePassword()
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string }>()
  const saving = updateAccount.isPending || changePassword.isPending

  /** Maps API field errors (422/409) onto the form; returns whether any field matched. */
  function applyApiErrors(error: unknown) {
    if (!isApiError(error)) return setStatus({ kind: 'error', message: 'Não foi possível salvar. Tente novamente.' })
    const known = Object.entries(error.fields).filter(([name]) => name in schema.shape)
    known.forEach(([name, message]) => setError(name as Path<FormValues>, { type: 'server', message }))
    if (known.length > 0) setFocus(known[0][0] as Path<FormValues>)
    setStatus({ kind: 'error', message: known.length > 0 ? 'Corrija os campos destacados.' : error.message })
  }

  async function onSubmit(values: FormValues) {
    setStatus(undefined)
    try {
      const saved = await updateAccount.mutateAsync({ username: values.username, email: values.email })
      if (values.currentPassword) {
        await changePassword.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword })
      }
      reset(toValues(saved))
      setStatus({ kind: 'success', message: 'Alterações salvas.' })
    } catch (error) {
      applyApiErrors(error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
      <div className="grid gap-x-12 gap-y-6 md:grid-cols-2">
        <Field label="Nome de usuário" required error={errors.username?.message}>
          <Input autoComplete="username" {...register('username')} />
        </Field>
        <Field label="E-mail" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-6 md:max-w-[calc(50%-1.5rem)]">
        <legend className="mb-6 text-body font-bold">Alterar senha</legend>
        <Field label="Senha atual" error={errors.currentPassword?.message}>
          <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
        </Field>
        <Field label="Nova senha" error={errors.newPassword?.message}>
          <PasswordInput autoComplete="new-password" {...register('newPassword')} />
        </Field>
        <Field label="Confirmar nova senha" error={errors.confirmPassword?.message}>
          <PasswordInput autoComplete="new-password" {...register('confirmPassword')} />
        </Field>
      </fieldset>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar dados da conta'}
        </Button>
        <p
          role={status?.kind === 'error' ? 'alert' : 'status'}
          className={status?.kind === 'error' ? 'text-body text-destructive' : 'text-body text-success'}
        >
          {status?.message}
        </p>
      </div>
    </form>
  )
}

export function AccountSection() {
  const session = useSession()

  return (
    <section aria-labelledby="account-title" className="flex flex-col gap-6">
      <h2 id="account-title" className="text-title font-bold">
        Dados da conta
      </h2>
      {session.data ? <AccountForm key={session.data.user.id} user={session.data.user} /> : null}
    </section>
  )
}
