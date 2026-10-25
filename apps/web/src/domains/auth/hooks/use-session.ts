import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { useMergeGuestCart } from '@/domains/cart'
import { getSessionToken, setSessionToken, subscribeSessionToken } from '@/shared/api/session'
import { authApi, sessionKeys, sessionQueryOptions } from '../api/queries'
import type { Session } from '../model/contracts'

/** Reactive read of the session token, so components re-render (and re-query) right after login/logout. */
function useSessionToken() {
  return useSyncExternalStore(subscribeSessionToken, getSessionToken, getSessionToken)
}

export function useSession() {
  const token = useSessionToken()
  return useQuery(sessionQueryOptions(token))
}

/**
 * Confirms with the server that the site session is still alive, bypassing the cache. For writes to a service that
 * does not know the site session (the real profile service trusts the owner id of its own token): an expired
 * session answers 401, which triggers the app-wide redirect to sign-in (`use-auth-error-redirect`) and rejects here,
 * so nothing is sent to that service.
 */
export function useEnsureSession() {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.fetchQuery({ ...sessionQueryOptions(getSessionToken()), staleTime: 0 })
  }
}

function useOpenSession() {
  const queryClient = useQueryClient()
  const mergeGuestCartIfAny = useMergeGuestCart()

  return (session: Session) => {
    setSessionToken(session.token)
    queryClient.setQueryData(sessionKeys.all(session.token), session)
    mergeGuestCartIfAny()
  }
}

export function useLogin() {
  const openSession = useOpenSession()
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: openSession,
  })
}

export function useSignup() {
  const openSession = useOpenSession()
  return useMutation({
    mutationFn: authApi.signup,
    onSuccess: openSession,
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      setSessionToken(null)
      queryClient.clear()
    },
  })
}
