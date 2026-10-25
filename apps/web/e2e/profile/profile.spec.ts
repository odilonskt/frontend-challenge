import { expect, test, type Page } from '@playwright/test'
import {
  apiGet,
  createOrderViaApi,
  hasNoHorizontalScroll,
  runAxe,
  selectScenario,
  SESSION_KEY,
  signIn,
  VIEWPORTS,
} from '../design-system/helpers'

// specs/014-user-profile: the collector profile (name, bio, ENS, wallet nickname, photo) lives in the real
// service (answered by the MSW profile mock here), apart from the account (username, e-mail, password).

const accountSection = (page: Page) => page.getByRole('region', { name: 'Dados da conta', exact: true })
const profileSection = (page: Page) => page.getByRole('region', { name: 'Perfil', exact: true })

interface ProfileFields {
  displayName?: string
  bio?: string
  ensName?: string
  ensTld?: '.eth' | '.xyz' | '.art'
  walletNickname?: string
}

/** Fills the "Perfil" section; only the given fields change. */
async function fillProfile(page: Page, values: ProfileFields) {
  const profile = profileSection(page)
  if (values.displayName !== undefined) await profile.getByRole('textbox', { name: 'Nome de exibição' }).fill(values.displayName)
  if (values.bio !== undefined) await profile.getByRole('textbox', { name: 'Bio' }).fill(values.bio)
  if (values.ensTld !== undefined) await profile.getByRole('combobox', { name: 'Domínio ENS' }).selectOption(values.ensTld)
  if (values.ensName !== undefined) await profile.getByRole('textbox', { name: 'Nome ENS' }).fill(values.ensName)
  if (values.walletNickname !== undefined) await profile.getByRole('textbox', { name: 'Apelido da carteira' }).fill(values.walletNickname)
}

async function saveProfile(page: Page) {
  await profileSection(page).getByRole('button', { name: 'Salvar perfil' }).click()
}

interface BackendAnswer {
  status: number
  json: { error?: { code?: string; fields?: Record<string, string> }; [key: string]: unknown } | null
}

/**
 * Calls the (mocked) real service as the signed-in user, the way the site does: token for the owner id first,
 * then the request. Lets the tests read what was really stored and probe the service's validation directly.
 */
async function backendCall(page: Page, method: string, path: string, body?: unknown): Promise<BackendAnswer> {
  return page.evaluate(
    async ([verb, route, payload, key]) => {
      const sessionResponse = await fetch('/api/session', { headers: { Authorization: `Bearer ${localStorage.getItem(key)}` } })
      const { user } = (await sessionResponse.json()) as { user: { id: string } }
      const tokenResponse = await fetch('/backend/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: user.id }),
      })
      const { token } = (await tokenResponse.json()) as { token: string }
      const response = await fetch(`/backend${route}`, {
        method: verb,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: payload === null ? undefined : JSON.stringify(payload),
      })
      return { status: response.status, json: (await response.json().catch(() => null)) as BackendAnswer['json'] }
    },
    [method, path, body ?? null, SESSION_KEY] as const,
  )
}

const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

test('the page has two sections, each with its own fields and its own button', async ({ page }) => {
  await signIn(page)
  const account = accountSection(page)
  const profile = profileSection(page)

  for (const name of ['Nome de usuário', 'E-mail']) await expect(account.getByRole('textbox', { name })).toBeVisible()
  for (const label of ['Senha atual', 'Nova senha', 'Confirmar nova senha']) {
    await expect(account.getByLabel(label, { exact: true })).toBeVisible()
  }
  await expect(account.getByRole('button', { name: 'Salvar dados da conta' })).toBeVisible()

  for (const name of ['Nome de exibição', 'Bio', 'Nome ENS', 'Apelido da carteira']) {
    await expect(profile.getByRole('textbox', { name })).toBeVisible()
  }
  await expect(profile.getByRole('combobox', { name: 'Domínio ENS' })).toBeVisible()
  await expect(profile.getByRole('button', { name: 'Salvar perfil' })).toBeVisible()

  // Account fields are not in the profile section, and the other way around (FR-016).
  await expect(profile.getByRole('textbox', { name: 'E-mail' })).toHaveCount(0)
  await expect(account.getByRole('textbox', { name: 'Bio' })).toHaveCount(0)
})

test('saving the profile confirms it and the values survive a reload', async ({ page }) => {
  await signIn(page)
  const profile = profileSection(page)

  // A profile never saved starts with the account name and empty fields (FR-008).
  await expect(profile.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Teste Design')
  await expect(profile.getByRole('textbox', { name: 'Bio' })).toHaveValue('')

  await fillProfile(page, {
    displayName: 'Maria Exibida',
    bio: 'Colecionadora de arte generativa.',
    ensTld: '.xyz',
    ensName: 'mariaexibida',
    walletNickname: 'Carteira principal',
  })
  await saveProfile(page)
  await expect(profile.getByText('Alterações salvas.')).toBeVisible()

  await page.reload()
  await expect(profile.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Maria Exibida')
  await expect(profile.getByRole('textbox', { name: 'Bio' })).toHaveValue('Colecionadora de arte generativa.')
  await expect(profile.getByRole('combobox', { name: 'Domínio ENS' })).toHaveValue('.xyz')
  await expect(profile.getByRole('textbox', { name: 'Nome ENS' })).toHaveValue('mariaexibida')
  await expect(profile.getByRole('textbox', { name: 'Apelido da carteira' })).toHaveValue('Carteira principal')
})

test('an invalid field shows its message, nothing is saved and the other fields keep what was typed', async ({ page }) => {
  await signIn(page)
  const profile = profileSection(page)

  // A known good profile first, so "nothing was saved" has something to be compared with (SC-004).
  await fillProfile(page, { displayName: 'Nome Salvo', bio: 'bio salva', ensName: 'salvo', ensTld: '.eth', walletNickname: 'Salva' })
  await saveProfile(page)
  await expect(profile.getByText('Alterações salvas.')).toBeVisible()
  const saved = (await backendCall(page, 'GET', '/profile')).json

  const cases: { label: string; values: ProfileFields; message: string }[] = [
    { label: 'name with 2 characters', values: { displayName: 'ab' }, message: 'Informe pelo menos 3 caracteres.' },
    { label: 'name with 61 characters', values: { displayName: 'a'.repeat(61) }, message: 'Use no máximo 60 caracteres.' },
    { label: 'bio with 281 characters', values: { bio: 'b'.repeat(281) }, message: 'Use no máximo 280 caracteres.' },
    { label: 'ENS name in capitals', values: { ensName: 'AB' }, message: 'Use de 3 a 40 letras minúsculas, números ou hífen.' },
    { label: 'ENS name with an underscore', values: { ensName: 'a_b' }, message: 'Use de 3 a 40 letras minúsculas, números ou hífen.' },
    { label: 'nickname with 41 characters', values: { walletNickname: 'n'.repeat(41) }, message: 'Use no máximo 40 caracteres.' },
  ]
  for (const { label, values, message } of cases) {
    await fillProfile(page, { displayName: 'Nome Digitado', bio: 'bio digitada', ensName: 'digitado', walletNickname: 'Digitada', ...values })
    await saveProfile(page)
    await expect(profile.getByText(message), label).toBeVisible()
    // The fields that were valid keep what the user typed.
    const untouched = Object.keys(values).includes('displayName') ? 'bio digitada' : 'Nome Digitado'
    const fieldName = Object.keys(values).includes('displayName') ? 'Bio' : 'Nome de exibição'
    await expect(profile.getByRole('textbox', { name: fieldName }), label).toHaveValue(untouched)
  }

  const after = (await backendCall(page, 'GET', '/profile')).json
  expect(after, 'no invalid save changed the stored profile').toEqual(saved)
})

test('an empty ENS name and an empty nickname are accepted, and spaces at the ends are removed', async ({ page }) => {
  await signIn(page)
  const profile = profileSection(page)

  await fillProfile(page, { displayName: '  Ana Souza  ', bio: '  oi  ', ensName: '', walletNickname: '   ' })
  await saveProfile(page)
  await expect(profile.getByText('Alterações salvas.')).toBeVisible()

  await page.reload()
  await expect(profile.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Ana Souza')
  await expect(profile.getByRole('textbox', { name: 'Bio' })).toHaveValue('oi')
  await expect(profile.getByRole('textbox', { name: 'Nome ENS' })).toHaveValue('')
  await expect(profile.getByRole('textbox', { name: 'Apelido da carteira' })).toHaveValue('')
})

test('the account section saves username and e-mail, and the name from sign-up is not touched', async ({ page }) => {
  await signIn(page)
  const account = accountSection(page)
  const id = unique()

  await account.getByRole('textbox', { name: 'Nome de usuário' }).fill(`novo_${id}`)
  await account.getByRole('textbox', { name: 'E-mail' }).fill(`novo_${id}@nft.dev`)
  await account.getByRole('button', { name: 'Salvar dados da conta' }).click()
  await expect(account.getByText('Alterações salvas.')).toBeVisible()

  const session = await apiGet<{ user: { name: string; username: string; email: string } }>(page, '/session')
  expect(session.user.username).toBe(`novo_${id}`)
  expect(session.user.email).toBe(`novo_${id}@nft.dev`)
  expect(session.user.name, 'the sign-up name is not editable any more').toBe('Teste Design')
})

test('an e-mail or username already in use is refused on its field', async ({ page }) => {
  await signIn(page)
  const account = accountSection(page)

  await account.getByRole('textbox', { name: 'E-mail' }).fill('ana@nft.dev')
  await account.getByRole('button', { name: 'Salvar dados da conta' }).click()
  await expect(account.getByText('Este e-mail já está em uso.')).toBeVisible()

  await account.getByRole('textbox', { name: 'Nome de usuário' }).fill('anasouza')
  await account.getByRole('button', { name: 'Salvar dados da conta' }).click()
  await expect(account.getByText('Este nome de usuário já está em uso.')).toBeVisible()
})

test('changing the password: a wrong current one is refused, the right one is accepted', async ({ page }) => {
  await signIn(page)
  const account = accountSection(page)

  await account.getByLabel('Senha atual', { exact: true }).fill('SenhaErrada1')
  await account.getByLabel('Nova senha', { exact: true }).fill('NovaSenha99')
  await account.getByLabel('Confirmar nova senha', { exact: true }).fill('NovaSenha99')
  await account.getByRole('button', { name: 'Salvar dados da conta' }).click()
  await expect(account.getByText('A senha atual está incorreta.')).toBeVisible()

  await account.getByLabel('Senha atual', { exact: true }).fill('Senha1234')
  await account.getByRole('button', { name: 'Salvar dados da conta' }).click()
  await expect(account.getByText('Alterações salvas.')).toBeVisible()
})

test('saving one section never calls the other one (FR-016)', async ({ page }) => {
  await signIn(page)
  const requests: string[] = []
  page.on('request', (request) => requests.push(`${request.method()} ${new URL(request.url()).pathname}`))

  requests.length = 0
  await accountSection(page).getByRole('textbox', { name: 'E-mail' }).fill(`so_conta_${unique()}@nft.dev`)
  await accountSection(page).getByRole('button', { name: 'Salvar dados da conta' }).click()
  await expect(accountSection(page).getByText('Alterações salvas.')).toBeVisible()
  // Positive control: the requests of this very save are visible to the test (the mock answers from a service worker).
  expect(requests, 'the account save is observable').toContain('PATCH /api/account')
  expect(requests.filter((r) => r.startsWith('PUT /backend/profile')), 'the account save sent nothing to the profile service').toEqual([])

  requests.length = 0
  await fillProfile(page, { displayName: 'So Perfil' })
  await saveProfile(page)
  await expect(profileSection(page).getByText('Alterações salvas.')).toBeVisible()
  expect(requests, 'the profile save is observable').toContain('PUT /backend/profile')
  expect(requests.filter((r) => r.includes('/api/account')), 'the profile save never touched the account').toEqual([])
})

test('two collectors each see only their own profile', async ({ page }) => {
  await signIn(page)
  await fillProfile(page, { displayName: 'Perfil da Primeira', bio: 'so da primeira' })
  await saveProfile(page)
  await expect(profileSection(page).getByText('Alterações salvas.')).toBeVisible()

  await signIn(page) // another account: the session changes
  const profile = profileSection(page)
  await expect(profile.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Teste Design')
  await expect(profile.getByRole('textbox', { name: 'Bio' })).toHaveValue('')
  const stored = (await backendCall(page, 'GET', '/profile')).json
  expect(stored?.displayName).toBe('')
  expect(stored?.updatedAt).toBeNull()
})

test('a visitor is sent to sign in and comes back to the profile afterwards', async ({ page }) => {
  await page.goto('/account/profile')
  await expect(page).toHaveURL(/\/login\?redirect=/)

  const id = unique()
  await page.getByRole('tab', { name: 'Criar conta' }).click()
  await page.getByLabel('Nome de usuário').fill(`user_${id}`)
  await page.getByLabel('E-mail').fill(`${id}@nft.dev`)
  await page.getByLabel(/^Senha/).fill('Senha1234')
  await page.getByLabel('Confirmar senha').fill('Senha1234')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/account/profile')
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
})

test('the navigation bar shows the display name as soon as it is saved, without reloading', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('link', { name: 'Conta de Teste Design' })).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __marker: number }).__marker = 1
  })

  await fillProfile(page, { displayName: 'Maria Exibida' })
  await saveProfile(page)
  await expect(page.getByRole('link', { name: 'Conta de Maria Exibida' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker), 'the page was not reloaded').toBe(1)

  // Another tab of the same browser opens the site and already shows the saved name.
  const other = await page.context().newPage()
  await other.goto('/')
  await expect(other.getByRole('link', { name: 'Conta de Maria Exibida' })).toBeVisible()
})

test('the simulated service answers the same codes as the real one', async ({ page }) => {
  await signIn(page)
  const valid = { displayName: 'Ana Souza', bio: '', ensName: '', ensTld: '.eth', walletNickname: '' }

  const fresh = await backendCall(page, 'GET', '/profile')
  expect(fresh.status).toBe(200)
  expect(fresh.json).toMatchObject({ displayName: '', ensTld: '.eth', avatarVersion: null, updatedAt: null })

  const cases: [string, object, Record<string, string>][] = [
    ['name too short', { displayName: 'ab' }, { displayName: 'too_short' }],
    ['name too long', { displayName: 'a'.repeat(61) }, { displayName: 'too_long' }],
    ['bio too long', { bio: 'b'.repeat(281) }, { bio: 'too_long' }],
    ['ENS name in capitals', { ensName: 'AnaSouza' }, { ensName: 'invalid_format' }],
    ['unknown TLD', { ensTld: '.com' }, { ensTld: 'invalid' }],
    ['nickname too long', { walletNickname: 'n'.repeat(41) }, { walletNickname: 'too_long' }],
    [
      'several at once',
      { displayName: 'a', bio: 'b'.repeat(281), ensName: 'X' },
      { displayName: 'too_short', bio: 'too_long', ensName: 'invalid_format' },
    ],
    ['an emoji and a letter (2 characters)', { displayName: '😀a' }, { displayName: 'too_short' }],
  ]
  for (const [label, patch, fields] of cases) {
    const answer = await backendCall(page, 'PUT', '/profile', { ...valid, ...patch })
    expect(answer.status, label).toBe(400)
    expect(answer.json?.error?.code, label).toBe('validation_error')
    expect(answer.json?.error?.fields, label).toEqual(fields)
  }

  const missing = await backendCall(page, 'PUT', '/profile', { displayName: 'Ana Souza' })
  expect(missing.json?.error?.fields).toEqual({ bio: 'invalid', ensName: 'invalid', ensTld: 'invalid', walletNickname: 'invalid' })

  const unauthenticated = await page.evaluate(async () => {
    const response = await fetch('/backend/profile')
    return { status: response.status, code: ((await response.json()) as { error: { code: string } }).error.code }
  })
  expect(unauthenticated).toEqual({ status: 401, code: 'missing_token' })
})

// --- Photo (US2) ---------------------------------------------------------------------------------------------

type ImageType = 'image/png' | 'image/jpeg' | 'image/webp'

/** A real, decodable image of the given type (the avatar only renders once the browser can decode it). */
async function makeImage(page: Page, type: ImageType): Promise<Buffer> {
  const base64 = await page.evaluate(async (mime) => {
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    const context = canvas.getContext('2d')
    if (!context) throw new Error('no 2d context')
    context.fillStyle = mime === 'image/png' ? '#d98b45' : mime === 'image/jpeg' ? '#4585d9' : '#45d98b'
    context.fillRect(0, 0, 8, 8)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime))
    if (!blob) throw new Error(`cannot encode ${mime}`)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })
    return btoa(binary)
  }, type)
  return Buffer.from(base64, 'base64')
}

const avatarImage = (page: Page) => profileSection(page).getByRole('img', { name: 'Seu avatar atual' })
const noAvatar = (page: Page) => profileSection(page).getByRole('img', { name: 'Nenhum avatar definido' })
const navbarPhoto = (page: Page) => page.getByRole('banner').getByRole('link', { name: /^Conta de/ }).locator('img')

async function upload(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  await profileSection(page).getByLabel('Selecionar imagem de avatar').setInputFiles(file)
}

test('PNG, JPEG and WebP photos are accepted, replace each other and survive a reload', async ({ page }) => {
  await signIn(page)
  await expect(noAvatar(page)).toBeVisible()

  let previous = ''
  for (const [type, extension] of [['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp']] as const) {
    await upload(page, { name: `foto.${extension}`, mimeType: type, buffer: await makeImage(page, type) })
    await expect(avatarImage(page)).toBeVisible()
    await expect(avatarImage(page)).toHaveAttribute('src', new RegExp(`^data:${type};base64,`))
    const src = await avatarImage(page).getAttribute('src')
    expect(src, `the ${type} replaced the previous photo`).not.toBe(previous)
    previous = src ?? ''
  }

  await page.reload()
  await expect(avatarImage(page)).toHaveAttribute('src', new RegExp('^data:image/webp;base64,'))
})

test('a photo that is not an image, has the wrong type or is over 1 MB is refused and the current one stays', async ({ page }) => {
  await signIn(page)
  await upload(page, { name: 'ok.png', mimeType: 'image/png', buffer: await makeImage(page, 'image/png') })
  await expect(avatarImage(page)).toBeVisible()
  const current = await avatarImage(page).getAttribute('src')
  const profile = profileSection(page)

  // Looks like a PNG by name and declared type, but the content is text: only the service can tell (FR-005).
  await upload(page, { name: 'falsa.png', mimeType: 'image/png', buffer: Buffer.from('isto nao e uma imagem') })
  await expect(profile.getByText('Envie uma imagem PNG, JPEG ou WebP.')).toBeVisible()
  await expect(avatarImage(page)).toHaveAttribute('src', current ?? '')

  // A type that is not accepted is refused before anything is sent.
  await upload(page, { name: 'bicho.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') })
  await expect(profile.getByText('Envie uma imagem PNG, JPEG ou WebP.')).toBeVisible()

  // One byte over 1 MB is refused with its own message.
  const png = await makeImage(page, 'image/png')
  const big = Buffer.concat([png, Buffer.alloc(1024 * 1024 + 1 - png.length)])
  await upload(page, { name: 'grande.png', mimeType: 'image/png', buffer: big })
  await expect(profile.getByText('A imagem deve ter no máximo 1 MB.')).toBeVisible()
  await expect(avatarImage(page)).toHaveAttribute('src', current ?? '')
})

test('removing the photo goes back to the default and stays that way; "Remover" is off without a photo', async ({ page }) => {
  await signIn(page)
  const profile = profileSection(page)
  await expect(profile.getByRole('button', { name: 'Remover' })).toBeDisabled()

  await upload(page, { name: 'ok.png', mimeType: 'image/png', buffer: await makeImage(page, 'image/png') })
  await expect(avatarImage(page)).toBeVisible()
  await profile.getByRole('button', { name: 'Remover' }).click()
  await expect(noAvatar(page)).toBeVisible()

  await page.reload()
  await expect(noAvatar(page)).toBeVisible()
  await expect(profile.getByRole('button', { name: 'Remover' })).toBeDisabled()
})

test('the navigation bar shows the photo as soon as it is saved or removed, without reloading', async ({ page }) => {
  await signIn(page)
  await expect(navbarPhoto(page)).toHaveCount(0)
  await page.evaluate(() => {
    ;(window as unknown as { __marker: number }).__marker = 1
  })

  await upload(page, { name: 'ok.png', mimeType: 'image/png', buffer: await makeImage(page, 'image/png') })
  await expect(navbarPhoto(page)).toBeVisible()
  await expect(navbarPhoto(page)).toHaveAttribute('src', /^data:image\/png;base64,/)
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker), 'the page was not reloaded').toBe(1)

  await profileSection(page).getByRole('button', { name: 'Remover' }).click()
  await expect(navbarPhoto(page)).toHaveCount(0)
})

test('saving the text keeps the photo and saving the photo keeps the text', async ({ page }) => {
  await signIn(page)
  const profile = profileSection(page)

  await fillProfile(page, { displayName: 'Texto Salvo', bio: 'bio salva' })
  await saveProfile(page)
  await expect(profile.getByText('Alterações salvas.')).toBeVisible()

  await upload(page, { name: 'ok.png', mimeType: 'image/png', buffer: await makeImage(page, 'image/png') })
  await expect(avatarImage(page)).toBeVisible()
  await page.reload()
  await expect(profile.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Texto Salvo')
  await expect(avatarImage(page)).toBeVisible()

  await fillProfile(page, { bio: 'bio nova' })
  await saveProfile(page)
  await expect(profile.getByText('Alterações salvas.')).toBeVisible()
  await page.reload()
  await expect(profile.getByRole('textbox', { name: 'Bio' })).toHaveValue('bio nova')
  await expect(avatarImage(page)).toBeVisible()
})

// --- First access, failures and repeated saves (US3) ---------------------------------------------------------

const LOAD_ERROR = 'Não foi possível carregar o perfil.'
const SAVE_ERROR = 'Não foi possível salvar o perfil. Tente novamente.'
// The profile query retries a transient failure twice (1 s, then 2 s) before the error shows.
const AFTER_RETRIES = { timeout: 15_000 }

/** Reopens the page with the profile service down (the scenario is kept in the browser's storage). */
async function reopenWithProfileDown(page: Page) {
  await selectScenario(page, 'profile-unavailable')
  await page.reload()
}

test('a collector who never saved a profile gets the form with the account name, and the first save creates it', async ({ page }) => {
  await signIn(page)
  const profile = profileSection(page)
  await expect(profile.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Teste Design')
  for (const name of ['Bio', 'Nome ENS', 'Apelido da carteira']) {
    await expect(profile.getByRole('textbox', { name })).toHaveValue('')
  }
  await expect(profile.getByText(/^Última alteração:/), 'nothing was saved yet').toHaveCount(0)

  await saveProfile(page)
  await expect(profile.getByText('Alterações salvas.')).toBeVisible()
  await expect(profile.getByText(/^Última alteração:/)).toBeVisible()

  const stored = (await backendCall(page, 'GET', '/profile')).json
  expect(stored?.displayName).toBe('Teste Design')
  expect(stored?.updatedAt).not.toBeNull()
})

test('with the service down on opening, the profile shows a clear message with "Tentar novamente" and no invented form', async ({ page }) => {
  await signIn(page)
  await reopenWithProfileDown(page)
  const profile = profileSection(page)

  await expect(profile.getByRole('alert').getByText(LOAD_ERROR)).toBeVisible(AFTER_RETRIES)
  await expect(profile.getByRole('button', { name: 'Tentar novamente' })).toBeVisible()
  await expect(profile.getByRole('textbox', { name: 'Nome de exibição' }), 'no form with made-up data').toHaveCount(0)
  // The account section keeps working while the profile service is down (FR-016).
  await expect(accountSection(page).getByRole('textbox', { name: 'E-mail' })).toBeVisible()

  await selectScenario(page, 'default')
  await profile.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(profile.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Teste Design')
})

test('with the service down while saving, the failure is shown, what was typed stays, and saving again works', async ({ page }) => {
  await signIn(page)
  await fillProfile(page, { displayName: 'Maria Digitada', bio: 'texto que não pode se perder' })
  await selectScenario(page, 'profile-unavailable')
  await saveProfile(page)

  const profile = profileSection(page)
  await expect(profile.getByText(SAVE_ERROR)).toBeVisible()
  await expect(profile.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Maria Digitada')
  await expect(profile.getByRole('textbox', { name: 'Bio' })).toHaveValue('texto que não pode se perder')

  await selectScenario(page, 'default')
  await saveProfile(page)
  await expect(profile.getByText('Alterações salvas.')).toBeVisible()
  const stored = (await backendCall(page, 'GET', '/profile')).json
  expect(stored?.displayName).toBe('Maria Digitada')
})

test('with the profile service down, the account still saves, and a failed profile save never changes the account', async ({ page }) => {
  await signIn(page)
  const before = await apiGet<{ user: { email: string } }>(page, '/session')
  await reopenWithProfileDown(page)
  await expect(profileSection(page).getByText(LOAD_ERROR)).toBeVisible(AFTER_RETRIES)

  const account = accountSection(page)
  const email = `conta_${unique()}@nft.dev`
  await account.getByRole('textbox', { name: 'E-mail' }).fill(email)
  await account.getByRole('button', { name: 'Salvar dados da conta' }).click()
  await expect(account.getByText('Alterações salvas.')).toBeVisible()
  const after = await apiGet<{ user: { email: string } }>(page, '/session')
  expect(after.user.email).toBe(email)
  expect(before.user.email).not.toBe(email)

  // The other way round: the profile fails, and the account stays as the collector left it.
  await selectScenario(page, 'default')
  await page.reload()
  await fillProfile(page, { displayName: 'Nao Salva' })
  await selectScenario(page, 'profile-unavailable')
  await saveProfile(page)
  await expect(profileSection(page).getByText(SAVE_ERROR)).toBeVisible()
  const unchanged = await apiGet<{ user: { email: string } }>(page, '/session')
  expect(unchanged.user.email).toBe(email)
})

test('with the profile service down the navigation bar keeps the account name and the default icon, without errors', async ({ page }) => {
  await signIn(page)
  await reopenWithProfileDown(page)
  await expect(profileSection(page).getByText(LOAD_ERROR)).toBeVisible(AFTER_RETRIES)

  const bar = page.getByRole('banner')
  await expect(bar.getByRole('link', { name: 'Conta de Teste Design' })).toBeVisible()
  await expect(navbarPhoto(page)).toHaveCount(0)
  await expect(bar.getByRole('alert')).toHaveCount(0)
  // Navigation is not blocked by it.
  await bar.getByRole('link', { name: 'Mercado' }).click()
  await expect(page).toHaveURL(/\/market/)
})

test('clicking "Salvar perfil" many times leaves the same profile as saving once', async ({ page }) => {
  await signIn(page)
  const profile = profileSection(page)
  await fillProfile(page, { displayName: 'Salva Varias Vezes', bio: 'uma só', ensName: 'varias', ensTld: '.art' })
  await profile.getByRole('button', { name: /^Salv/ }).click({ clickCount: 5, delay: 0 })
  await expect(profile.getByText('Alterações salvas.')).toBeVisible()

  const stored = (await backendCall(page, 'GET', '/profile')).json
  expect(stored).toMatchObject({ displayName: 'Salva Varias Vezes', bio: 'uma só', ensName: 'varias', ensTld: '.art', walletNickname: '' })
  await page.reload()
  await expect(profile.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Salva Varias Vezes')
})

test('when the same account saves twice, the last save wins and the page shows when it happened', async ({ page }) => {
  await signIn(page)
  const profile = profileSection(page)
  await fillProfile(page, { displayName: 'Primeiro Valor' })
  await saveProfile(page)
  await expect(profile.getByText('Alterações salvas.')).toBeVisible()

  // Another session of the same account saves a different value (the shared state of this browser stands in for it).
  const other = await backendCall(page, 'PUT', '/profile', {
    displayName: 'Segundo Valor',
    bio: 'da outra sessão',
    ensName: '',
    ensTld: '.eth',
    walletNickname: '',
  })
  expect(other.status).toBe(200)

  await page.reload()
  await expect(profile.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Segundo Valor')
  await expect(profile.getByRole('textbox', { name: 'Bio' })).toHaveValue('da outra sessão')
  await expect(profile.getByText(/^Última alteração:/)).toBeVisible()
  expect((await backendCall(page, 'GET', '/profile')).json?.updatedAt).toBe(other.json?.updatedAt)
})

test('an expired site session sends the collector to sign in and nothing is sent to the profile service', async ({ page }) => {
  await signIn(page)
  const profileWrites: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'PUT' && new URL(request.url()).pathname === '/backend/profile') profileWrites.push(request.url())
  })

  await fillProfile(page, { displayName: 'Nao Deve Salvar' })
  await page.evaluate(() => window.__nftMock?.expireSessions())
  await saveProfile(page)

  await expect(page).toHaveURL(/\/login\?redirect=/)
  expect(profileWrites, 'no write reached the profile service').toEqual([])

  // After signing in again the collector is back on the profile.
  const id = unique()
  await page.getByRole('tab', { name: 'Criar conta' }).click()
  await page.getByLabel('Nome de usuário').fill(`user_${id}`)
  await page.getByLabel('E-mail').fill(`${id}@nft.dev`)
  await page.getByLabel(/^Senha/).fill('Senha1234')
  await page.getByLabel('Confirmar senha').fill('Senha1234')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/account/profile')
})

test('changing the display name never rewrites orders or receipts already issued', async ({ page }) => {
  await signIn(page)
  const orderId = await createOrderViaApi(page)
  const before = await apiGet<{ collector: { fullName: string } }>(page, `/orders/${orderId}`)
  expect(before.collector.fullName).toBe('Teste E2E')

  await fillProfile(page, { displayName: 'Nome Novo Exibido' })
  await saveProfile(page)
  await expect(profileSection(page).getByText('Alterações salvas.')).toBeVisible()

  const after = await apiGet<{ collector: { fullName: string } }>(page, `/orders/${orderId}`)
  expect(after.collector.fullName, 'the receipt keeps what was recorded at checkout').toBe('Teste E2E')
})

test('the navigation bar reads the profile once per session and asks for the photo only when there is one', async ({ page }) => {
  const calls: string[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.startsWith('/backend/profile')) calls.push(`${request.method()} ${pathname}`)
  })

  await signIn(page) // a full load of /account/profile: the first (and only) read of the profile
  const bar = page.getByRole('banner')
  for (const [link, url] of [['Mercado', /\/market/], ['Criadores', /\/creators/]] as const) {
    await bar.getByRole('link', { name: link }).click()
    await expect(page).toHaveURL(url)
  }
  await bar.getByRole('link', { name: /^Conta de/ }).click()
  await expect(page).toHaveURL('/account/profile')
  await expect(profileSection(page).getByRole('textbox', { name: 'Nome de exibição' })).toBeVisible()

  expect(calls.filter((call) => call === 'GET /backend/profile'), 'the profile is read once, then served from the cache').toHaveLength(1)
  expect(calls.filter((call) => call.includes('/avatar')), 'no photo is requested when there is none').toEqual([])
})

test('the profile page has no critical accessibility violations', async ({ page }) => {
  await signIn(page)
  await expect(profileSection(page).getByRole('textbox', { name: 'Nome de exibição' })).toBeVisible()
  expect(await runAxe(page)).toEqual([])
})

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`${name} (${viewport.width}px)`, () => {
    test.use({ viewport })

    test('the profile page renders without horizontal scroll, accessibly, and matches its baseline', async ({ page }) => {
      await signIn(page)
      await expect(profileSection(page).getByRole('textbox', { name: 'Nome de exibição' })).toBeVisible()
      expect(await hasNoHorizontalScroll(page)).toBe(true)
      expect(await runAxe(page)).toEqual([])
      // The username and e-mail of the throw-away account differ on every run: mask them, compare the rest.
      await expect(page).toHaveScreenshot(`profile-${viewport.width}.png`, {
        fullPage: true,
        mask: [accountSection(page).getByRole('textbox')],
      })
    })

    test('the profile page with a photo renders accessibly and matches its baseline', async ({ page }) => {
      await signIn(page)
      await upload(page, { name: 'foto.png', mimeType: 'image/png', buffer: await makeImage(page, 'image/png') })
      await expect(avatarImage(page)).toBeVisible()
      await expect(navbarPhoto(page)).toBeVisible()
      expect(await hasNoHorizontalScroll(page)).toBe(true)
      expect(await runAxe(page)).toEqual([])
      await expect(page).toHaveScreenshot(`profile-photo-${viewport.width}.png`, {
        fullPage: true,
        mask: [accountSection(page).getByRole('textbox')],
      })
    })

    test('the profile page with the service down renders accessibly and matches its baseline', async ({ page }) => {
      await signIn(page)
      await reopenWithProfileDown(page)
      await expect(profileSection(page).getByText(LOAD_ERROR)).toBeVisible(AFTER_RETRIES)
      expect(await hasNoHorizontalScroll(page)).toBe(true)
      expect(await runAxe(page)).toEqual([])
      await expect(page).toHaveScreenshot(`profile-error-${viewport.width}.png`, {
        fullPage: true,
        mask: [accountSection(page).getByRole('textbox')],
      })
    })
  })
}
