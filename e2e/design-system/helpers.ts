import { createRequire } from 'node:module'
import { expect, type Page } from '@playwright/test'

export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const

const SESSION_KEY = 'nft-session:token'

/** Creates a throw-away collector through the mocked API and stores its session token, like a real login would. */
export async function signIn(page: Page) {
  await page.goto('/')
  // The app renders only after MSW is ready, so a visible header means the mocked API is active.
  await page.getByRole('banner').waitFor()
  const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const token = await page.evaluate(async (id) => {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Teste Design', username: `user_${id}`, email: `${id}@nft.dev`, password: 'Senha1234' }),
    })
    return ((await response.json()) as { token: string }).token
  }, unique)
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [SESSION_KEY, token])
  await page.goto('/account/profile')
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
}

export async function hasNoHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
}

interface AxeViolation {
  id: string
  impact: string
  nodes: { target: string[] }[]
}

/** axe-core is injected into the page; resolved from the dependency tree. */
export async function runAxe(page: Page) {
  const require = createRequire(import.meta.url)
  let path: string
  try {
    path = require.resolve('axe-core/axe.min.js')
  } catch {
    path = require.resolve('axe-core/axe.min.js', { paths: [`${process.cwd()}/node_modules/.pnpm/node_modules`] })
  }
  await page.addScriptTag({ path })
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<{ violations: AxeViolation[] }> } }).axe
    const results = await axe.run(document, { resultTypes: ['violations'] })
    return results.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target.join(' ')) }))
  })
}
