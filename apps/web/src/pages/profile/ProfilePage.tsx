import { useNavigate } from '@tanstack/react-router'
import { useLogout, useSession } from '@/domains/auth'
import { AccountSideMenu } from '@/shared/ui/account-side-menu'
import { PageContainer } from '@/shared/ui/page-container'
import { AccountSection } from './components/AccountSection'
import { ProfileSection } from './components/ProfileSection'

export function ProfilePage() {
  const logout = useLogout()
  const session = useSession()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout.mutateAsync()
    } catch {
      // The local session is dropped regardless (useLogout's onSettled); an expired token has nothing left to revoke.
    }
    await navigate({ to: '/' })
  }

  return (
    <PageContainer className="grid gap-8 py-8 lg:grid-cols-[310px_1fr]">
      <AccountSideMenu active="profile" onLogout={handleLogout} showAdmin={session.data?.user.role === 'admin'} />
      <section aria-labelledby="profile-title" className="flex flex-col gap-12">
        <h1 id="profile-title" className="text-title font-bold">
          Perfil do colecionador
        </h1>
        {/* Two independent sections: the account (site) and the profile (real service). Each saves on its own. */}
        <AccountSection />
        <ProfileSection />
      </section>
    </PageContainer>
  )
}
