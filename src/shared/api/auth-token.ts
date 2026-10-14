const KEY = 'nft.session-token'

/** Single place that knows where the session token lives; the Axios interceptor reads it from here. */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable (private mode): the session just won't survive a refresh.
  }
}
