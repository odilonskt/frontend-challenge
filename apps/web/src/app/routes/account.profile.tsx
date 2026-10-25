import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '@/domains/auth'
import { ProfilePage } from '@/pages/profile'

export const Route = createFileRoute('/account/profile')({
  // A visitor is sent to sign-in and comes back here afterwards (spec 014, FR-007). Without the guard the profile
  // query stays disabled (no token) and the page would sit on its loading skeleton forever.
  beforeLoad: ({ location }) => requireSession(location.href),
  component: ProfilePage,
})
