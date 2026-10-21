import { MarketIcon, ProfileIcon } from '@/shared/icons'
import { SideMenu, SideMenuItem } from './side-menu'

/**
 * Admin navigation shared by every `/admin/*` page (Produtos, Usuários). Purely presentational,
 * same pattern as `AccountSideMenu` — the active item is injected by the caller.
 */
export function AdminSideMenu({ active }: { active: 'products' | 'users' }) {
  return (
    <SideMenu title="Administração" aria-label="Administração">
      <SideMenuItem icon={MarketIcon} href="/admin/products" active={active === 'products'}>
        Produtos
      </SideMenuItem>
      <SideMenuItem icon={ProfileIcon} href="/admin/users" active={active === 'users'}>
        Usuários
      </SideMenuItem>
    </SideMenu>
  )
}
