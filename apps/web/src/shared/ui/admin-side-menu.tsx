import { MarketIcon, ProfileIcon, WalletIcon } from '@/shared/icons'
import { SideMenu, SideMenuItem } from './side-menu'

/**
 * Admin navigation shared by every `/admin/*` page (Produtos, Usuários, Moedas). Purely presentational,
 * same pattern as `AccountSideMenu` — the active item is injected by the caller. "Moedas" belongs to another
 * context (the real coins administrator, its own sign-in): the menu only links, each route guards itself.
 */
export function AdminSideMenu({ active }: { active: 'products' | 'users' | 'coins' }) {
  return (
    <SideMenu title="Administração" aria-label="Administração">
      <SideMenuItem icon={MarketIcon} href="/admin/products" active={active === 'products'}>
        Produtos
      </SideMenuItem>
      <SideMenuItem icon={ProfileIcon} href="/admin/users" active={active === 'users'}>
        Usuários
      </SideMenuItem>
      <SideMenuItem icon={WalletIcon} href="/admin/coins" active={active === 'coins'}>
        Moedas
      </SideMenuItem>
    </SideMenu>
  )
}
