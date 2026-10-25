import { api } from '@/shared/api/http'
import type { ChangePasswordRequest, SessionUser, UpdateAccountRequest } from '../model/contracts'

/** The account's own data and password, in the site's simulated account (MSW `/api/account*`). */
export const accountApi = {
  update: (body: UpdateAccountRequest) => api.patch<SessionUser, UpdateAccountRequest>('/account', body),
  changePassword: (body: ChangePasswordRequest) => api.post<void, ChangePasswordRequest>('/account/password', body),
}
