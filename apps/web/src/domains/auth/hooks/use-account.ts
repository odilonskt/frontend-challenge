import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSessionToken } from '@/shared/api/session'
import { accountApi } from '../api/account'
import { sessionKeys } from '../api/queries'
import type { Session } from '../model/contracts'

/** Saves username and e-mail; the updated user goes straight into the session cache, so the whole app sees it. */
export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: accountApi.update,
    onSuccess: (user) => {
      queryClient.setQueryData<Session>(sessionKeys.all(getSessionToken()), (session) => session && { ...session, user })
    },
  })
}

export function useChangePassword() {
  return useMutation({ mutationFn: accountApi.changePassword })
}
