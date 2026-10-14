import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  Download,
  Heart,
  LineChart,
  LogOut,
  MapPin,
  ShoppingCart,
  User,
  type LucideIcon,
} from 'lucide-react'
import { api } from '@/shared/api/http'
import { setAuthToken } from '@/shared/api/auth-token'
import { cn } from '@/shared/lib/cn'

const itemClass = 'flex h-[45px] items-center gap-3 border-l-[6px] border-transparent px-[10px] text-sm text-primary'

/** Sections outside the challenge scope are shown as in the layout, but are inert and announced as unavailable. */
const UNAVAILABLE: { label: string; icon: LucideIcon }[] = [
  { label: 'Atividade', icon: ShoppingCart },
  { label: 'Lista de interesse', icon: Heart },
  { label: 'Ofertas', icon: LineChart },
  { label: 'Arquivos baixados', icon: Download },
  { label: 'Suporte', icon: AlertTriangle },
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
    <nav aria-label="Minha conta" className="bg-card">
      <h2 className="px-[10px] pb-2 pt-4 text-lg font-bold">Meu perfil</h2>
      <ul>
        <li>
          <a href="/account/profile" aria-current="page" className={cn(itemClass, 'border-primary bg-background/40')}>
            <User aria-hidden="true" size={16} />
            Dados do perfil
          </a>
        </li>
        <li>
          <a href="/account/wallets" className={itemClass}>
            <MapPin aria-hidden="true" size={16} />
            Carteiras
          </a>
        </li>
        {UNAVAILABLE.map(({ label, icon: Icon }) => (
          <li key={label}>
            <button
              type="button"
              disabled
              title="Em breve"
              className={cn(itemClass, 'w-full cursor-not-allowed text-left')}
            >
              <Icon aria-hidden="true" size={16} />
              {label}
              <span className="sr-only"> (indisponível)</span>
            </button>
          </li>
        ))}
        <li className="border-t border-border">
          <button type="button" onClick={logout} className={cn(itemClass, 'w-full text-left font-bold')}>
            <LogOut aria-hidden="true" size={16} />
            Sair
          </button>
        </li>
      </ul>
    </nav>
  )
}
