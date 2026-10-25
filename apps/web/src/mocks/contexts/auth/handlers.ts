import { HttpResponse, http } from 'msw'
import { bearerToken } from '../../http/identity'
import { field, readJson, route } from '../../http/route'
import type { AuthService } from './service'

export function authHandlers(api: string, auth: AuthService) {
  return [
    http.post(
      `${api}/auth/signup`,
      route(async ({ request }) => {
        const body = await readJson(request)
        const session = await auth.signup({
          name: field.string(body, 'name'),
          username: field.string(body, 'username'),
          email: field.string(body, 'email'),
          password: field.string(body, 'password'),
        })
        return HttpResponse.json(session, { status: 201 })
      }),
    ),

    http.post(
      `${api}/auth/login`,
      route(async ({ request }) => {
        const body = await readJson(request)
        return HttpResponse.json(
          await auth.login({ email: field.string(body, 'email'), password: field.string(body, 'password') }),
        )
      }),
    ),

    http.get(
      `${api}/session`,
      route(({ request }) => HttpResponse.json(auth.currentSession(auth.authenticate(bearerToken(request))))),
    ),

    // The account's own data (specs/014-user-profile, contracts/account-endpoints.md). Never touches the profile
    // service: that one lives under `/backend` (`contexts/profile-backend`).
    http.patch(
      `${api}/account`,
      route(async ({ request }) => {
        const { userId } = auth.authenticate(bearerToken(request))
        const body = await readJson(request)
        return HttpResponse.json(
          auth.updateAccount(userId, { username: field.string(body, 'username'), email: field.string(body, 'email') }),
        )
      }),
    ),

    http.post(
      `${api}/account/password`,
      route(async ({ request }) => {
        const { userId } = auth.authenticate(bearerToken(request))
        const body = await readJson(request)
        await auth.changePassword(userId, field.string(body, 'currentPassword'), field.string(body, 'newPassword'))
        return new HttpResponse(null, { status: 204 })
      }),
    ),

    http.post(
      `${api}/auth/logout`,
      route(({ request }) => {
        const token = bearerToken(request)
        if (token) auth.logout(token)
        return new HttpResponse(null, { status: 204 })
      }),
    ),
  ]
}
