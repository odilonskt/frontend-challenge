import { expect, test } from '@playwright/test'
import { signIn, VIEWPORTS } from './helpers'

test.use({ viewport: VIEWPORTS.desktop })

test('profile screen matches the visual baseline at 1440 px', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('main').getByRole('navigation', { name: 'Minha conta' })).toBeVisible()
  // The username and e-mail of the throw-away account differ on every run: mask them, compare the rest.
  await expect(page).toHaveScreenshot('profile-1440.png', {
    fullPage: true,
    mask: [page.getByRole('region', { name: 'Dados da conta', exact: true }).getByRole('textbox')],
  })
})
