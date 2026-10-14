import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ActivityIcon,
  DownloadIcon,
  HeartIcon,
  LogoutIcon,
  OffersIcon,
  ProfileIcon,
  SupportIcon,
  WalletIcon,
  type IconComponent,
} from '@/shared/icons'
import { api } from '@/shared/api/http'
import { setAuthToken } from '@/shared/api/auth-token'
import { SideMenu, SideMenuItem } from '@/shared/ui/side-menu'

/** Sections outside the challenge scope are shown as in the layout, but are inert and announced as unavailable. */
const UNAVAILABLE: { label: string; icon: IconComponent }[] = [
  { label: 'Atividade', icon: ActivityIcon },
  { label: 'Lista de interesse', icon: HeartIcon },
  { label: 'Ofertas', icon: OffersIcon },
  { label: 'Arquivos baixados', icon: DownloadIcon },
  { label: 'Suporte', icon: SupportIcon },
]

export function ProfileSidebar() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // The local session is dropped regardless; an expired token has nothing left to revoke.
    }
    setAuthToken(null)
    queryClient.clear()
    await navigate({ to: '/' })
  }

  return (
    <SideMenu title="Meu perfil" aria-label="Minha conta">
      <SideMenuItem icon={ProfileIcon} href="/account/profile" active>
        Dados do perfil
      </SideMenuItem>
      <SideMenuItem icon={WalletIcon} href="/account/wallets">
        Carteiras
      </SideMenuItem>
      {UNAVAILABLE.map(({ label, icon }) => (
        <SideMenuItem key={label} icon={icon} disabled title="Em breve">
          {label}
          <span className="sr-only"> (indisponível)</span>
        </SideMenuItem>
      ))}
      <SideMenuItem icon={LogoutIcon} separated onClick={logout} className="font-bold">
        Sair
      </SideMenuItem>
    </SideMenu>
  )
}
