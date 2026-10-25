import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import {
  apiGet,
  createOrderViaApi,
  hasNoHorizontalScroll,
  promoteCurrentUserToAdmin,
  runAxe,
  seedCartItem,
  signIn,
  SESSION_KEY,
  VIEWPORTS,
} from '../design-system/helpers'

// specs/016-brazilian-fauna-nfts: the "Fauna Brasileira" collection, 12 NFTs of Brazilian animals (nft_049 … nft_060),
// appended after the 48 abstract ones, by a creator of its own ("Fauna Viva").

/** SHA-256 of the JSON of `GET /api/nfts/nft_001 … nft_048`, captured BEFORE the collection existed (task T002). */
const OLD_CATALOG_SHA256 = 'b17c7b5bee628a3c6bd0b28954b28462b8717bfd988babb9c8e4f3e4a4831222'

const FAUNA_NAMES = [
  'Onça-Pintada',
  'Arara-Azul',
  'Boto-Cor-de-Rosa',
  'Mico-Leão-Dourado',
  'Tamanduá-Bandeira',
  'Lobo-Guará',
  'Tucano-Toco',
  'Capivara',
  'Bicho-Preguiça',
  'Jacaré-do-Pantanal',
  'Peixe-Boi-da-Amazônia',
  'Ararajuba',
] as const

const FAUNA_IDS = FAUNA_NAMES.map((_, index) => `nft_${String(49 + index).padStart(3, '0')}`)
const ALL_IDS = Array.from({ length: 60 }, (_, index) => `nft_${String(index + 1).padStart(3, '0')}`)

interface Summary {
  id: string
  name: string
  category: string
  priceFrom: string
  totalAvailable: number
  featured: boolean
  image: { src: string }
}
interface CatalogPage {
  items: Summary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
interface Detail extends Summary {
  description: string
  gallery: { src: string; alt: string }[]
  editions: { id: string; name: string; available: number; supply: number; maxPerOrder: number }[]
}

/** Reads the simulated API from inside the page (the catalog is answered by MSW in the browser). */
async function api<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(async (url) => (await (await fetch(url)).json()) as unknown, `/api${path}`) as Promise<T>
}

/**
 * Several reads at once, from inside the page. The simulated API adds a latency (80 to 220 ms) to every call, so reading
 * 60 NFTs one by one takes seconds; together they take one round. The order of the results is the order of `paths`.
 */
async function apiAll<T>(page: Page, paths: string[]): Promise<T[]> {
  return page.evaluate(
    async (urls) => Promise.all(urls.map(async (url) => (await (await fetch(url)).json()) as unknown)),
    paths.map((path) => `/api${path}`),
  ) as Promise<T[]>
}

const catalog = (page: Page, query: string) => api<CatalogPage>(page, `/nfts?${query}`)
const withoutAccents = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('banner').waitFor()
})

test('the first page of the catalog is exactly the 12 animals, newest first, and the page shows them', async ({ page }) => {
  const first = await catalog(page, 'sort=recent&pageSize=12&page=1')
  expect(first.items.map((item) => item.id)).toEqual(FAUNA_IDS)
  expect(first.items.map((item) => item.name)).toEqual([...FAUNA_NAMES])

  for (const name of FAUNA_NAMES) await expect(page.getByText(name, { exact: true }).first(), name).toBeVisible()
})

test('the catalog has 60 NFTs in 5 pages of 12, with no repeated or missing NFT', async ({ page }) => {
  const seen: string[] = []
  for (let number = 1; number <= 5; number++) {
    const result = await catalog(page, `sort=recent&pageSize=12&page=${number}`)
    expect(result.totalPages).toBe(5)
    expect(result.total).toBe(60)
    expect(result.items, `page ${number} is full`).toHaveLength(12)
    seen.push(...result.items.map((item) => item.id))
  }
  expect(new Set(seen).size, '60 distinct NFTs').toBe(60)
  expect([...seen].sort()).toEqual(ALL_IDS)

  // The pager the collector sees: a page 5, and no page 6.
  await expect(page.getByRole('button', { name: 'Página 5' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Página 6' })).toHaveCount(0)
})

test('searching an animal by its name, with or without accents and in capitals, finds it; the collection name finds all 12', async ({ page }) => {
  const searches = FAUNA_NAMES.flatMap((name, index) =>
    [name, withoutAccents(name), name.toUpperCase(), withoutAccents(name).toLowerCase()].map((term) => ({ term, name, id: FAUNA_IDS[index] })),
  )
  const results = await apiAll<CatalogPage>(page, searches.map(({ term }) => `/nfts?pageSize=48&q=${encodeURIComponent(term)}`))
  results.forEach((found, index) => {
    const { term, name, id } = searches[index]!
    expect(found.items.map((item) => item.id), `"${term}" finds ${name}`).toContain(id)
  })

  const byCollection = await catalog(page, `pageSize=48&q=${encodeURIComponent('Fauna Brasileira')}`)
  expect(byCollection.items.map((item) => item.id).sort()).toEqual([...FAUNA_IDS].sort())
  const byCreator = await catalog(page, `pageSize=48&q=${encodeURIComponent('Fauna Viva')}`)
  expect(byCreator.items.map((item) => item.id).sort()).toEqual([...FAUNA_IDS].sort())
})

test('the Market shows the Onça-Pintada in "Em alta" and the collection in "Coleções", which leads to the catalog filtered by it', async ({ page }) => {
  await page.goto('/market')
  const trending = page.getByRole('region', { name: 'Em alta' })
  await expect(trending.getByText('Onça-Pintada').first()).toBeVisible()
  // Each card has two links (image and name): count the distinct NFTs, not the links. (Read them only after the
  // rail has loaded: `evaluateAll` does not wait.)
  const hrefs = await trending.getByRole('link').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))])
  expect(hrefs, '"Em alta" shows 4 distinct NFTs').toHaveLength(4)
  expect(hrefs).toContain('/nft/nft_049')

  await page.getByRole('button', { name: /Fauna Brasileira/ }).click()
  await expect(page).toHaveURL(/q=Fauna/)
  for (const name of FAUNA_NAMES) await expect(page.getByText(name, { exact: true }).first(), name).toBeVisible()
})

test('the hero of the home page is unchanged', async ({ page }) => {
  await expect(page.getByRole('img', { name: 'Destaque do catálogo Kurio' })).toHaveAttribute('src', '/art/nft-001-1.svg')
})

test('only the Onça-Pintada is featured, and the animals answer to the catalog filters and sorts like any NFT', async ({ page }) => {
  const featured = await api<Summary[]>(page, '/nfts/featured')
  expect(featured.map((item) => item.id)).toEqual(['nft_001', 'nft_002', 'nft_003', 'nft_049'])

  const q = `q=${encodeURIComponent('Fauna Brasileira')}&pageSize=48`
  const art = await catalog(page, `${q}&category=art`)
  expect(art.items.map((item) => item.id).sort()).toEqual(['nft_049', 'nft_051', 'nft_053', 'nft_055', 'nft_057', 'nft_059'])
  const collectibles = await catalog(page, `${q}&category=collectibles`)
  expect(collectibles.items).toHaveLength(6)

  const cheapest = await catalog(page, `${q}&sort=price_asc`)
  const prices = cheapest.items.map((item) => Number(item.priceFrom))
  expect(prices).toEqual([...prices].sort((a, b) => a - b))
  const byName = await catalog(page, `${q}&sort=name_asc`)
  const names = byName.items.map((item) => item.name)
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  const available = await catalog(page, `${q}&availability=available`)
  expect(available.items, 'every animal opens available').toHaveLength(12)
})

test('no image of the catalog fails to load (60 NFTs with 3 images each, and the creators avatars)', async ({ page }) => {
  const sources = new Set<string>()
  const details = await apiAll<Detail>(page, ALL_IDS.map((id) => `/nfts/${id}`))
  for (const detail of details) {
    sources.add(detail.image.src)
    detail.gallery.forEach((image) => sources.add(image.src))
  }
  const creators = await api<{ avatarUrl: string }[]>(page, '/creators')
  creators.forEach((creator) => sources.add(creator.avatarUrl))
  expect(sources.size, '60 x 3 images and 9 avatars').toBe(189)

  const answers = await page.evaluate(
    async (urls) =>
      Promise.all(
        urls.map(async (url) => {
          const response = await fetch(url)
          return { url, status: response.status, type: response.headers.get('content-type') ?? '' }
        }),
      ),
    [...sources],
  )
  for (const { url, status, type } of answers) {
    expect(status, url).toBe(200)
    expect(type, url).toContain('image/svg+xml')
  }
})

test('the 48 original NFTs are identical to what they were before the collection', async ({ page }) => {
  const originals = await apiAll<Detail>(page, ALL_IDS.slice(0, 48).map((id) => `/nfts/${id}`))
  const hash = createHash('sha256').update(JSON.stringify(originals)).digest('hex')
  expect(hash).toBe(OLD_CATALOG_SHA256)
})

test('the descriptions of the animals never claim a real blockchain registration', async ({ page }) => {
  const details = await apiAll<Detail>(page, FAUNA_IDS.map((id) => `/nfts/${id}`))
  details.forEach((detail, index) => {
    expect(detail.description.length, FAUNA_IDS[index]).toBeGreaterThan(30)
    expect(detail.description, FAUNA_IDS[index]).not.toMatch(/on-?chain|blockchain/i)
  })
})

test('a browser that already saved the catalog receives the collection and loses nothing it had', async ({ page }) => {
  await signIn(page)
  await seedCartItem(page, { nftId: 'nft_005', editionId: 'nft_005_standard', quantity: 2 })

  // The saved state of an older build: without the 12 animals, and with a stock the collector's activity changed.
  // It is written BEFORE the page starts (an init script, once per tab): changing localStorage under a live page is a
  // race, because any background request renews the session and writes the whole in-memory state back over it.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('older-build-state')) return
    sessionStorage.setItem('older-build-state', '1')
    const raw = localStorage.getItem('nft-mock:state')
    if (!raw) return
    const saved = JSON.parse(raw) as { state: { nfts: { id: string; editions: { available: number }[] }[] } }
    saved.state.nfts = saved.state.nfts.filter((nft) => !/^nft_0(49|5\d|60)$/.test(nft.id))
    const original = saved.state.nfts.find((nft) => nft.id === 'nft_001')
    if (original?.editions[0]) original.editions[0].available = 3
    localStorage.setItem('nft-mock:state', JSON.stringify(saved))
  })
  await page.reload()
  await page.getByRole('banner').waitFor()

  const found = await catalog(page, `pageSize=48&q=${encodeURIComponent('Fauna Brasileira')}`)
  expect(found.items.map((item) => item.id).sort(), 'the 12 animals came back').toEqual([...FAUNA_IDS].sort())

  const original = await api<Detail>(page, '/nfts/nft_001')
  expect(original.editions[0]?.available, 'a stock that was changed is not restored').toBe(3)

  const token = await page.evaluate(() => localStorage.getItem('nft-session:token'))
  const cart = await page.evaluate(
    async (authToken) =>
      (await (await fetch('/api/cart', { headers: { Authorization: `Bearer ${authToken}` } })).json()) as { items: unknown[] },
    token,
  )
  expect(cart.items, 'the cart is still there').toHaveLength(1)
  const session = await page.evaluate(
    async (authToken) => (await fetch('/api/session', { headers: { Authorization: `Bearer ${authToken}` } })).status,
    token,
  )
  expect(session, 'the signed-in user is still signed in').toBe(200)
})

test('with the service unavailable the catalog shows its usual error state, not a broken collection', async ({ page }) => {
  await page.goto('/?scenario=service-unavailable')
  await expect(page.getByText('Não foi possível carregar o catálogo')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible()
})

// --- US2: knowing an animal and buying an edition -----------------------------------------------------------------

const media = (page: Page) => page.getByRole('img', { name: /^Onça-Pintada/ })

test('the detail of an animal shows its name, creator, collection, description, 3 images and 3 editions with their limits', async ({ page }) => {
  await page.goto('/nft/nft_049')
  await expect(page.getByRole('heading', { level: 1, name: 'Onça-Pintada' })).toBeVisible()
  await expect(page.getByText('Por Fauna Viva')).toBeVisible()
  await expect(page.getByText('Fauna Brasileira').first()).toBeVisible()
  await expect(page.getByText('O maior felino das Américas', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Pantanal', { exact: true })).toBeVisible()

  // The gallery: 3 images, with their own alternative texts, by click and by keyboard.
  await expect(page.getByRole('button', { name: /^Ver imagem \d de 3$/ })).toHaveCount(3)
  await expect(media(page).first()).toHaveAttribute('alt', 'Onça-Pintada, obra digital de Fauna Viva')
  await page.getByRole('button', { name: 'Ver imagem 2 de 3' }).click()
  await expect(page.getByRole('img', { name: 'Onça-Pintada, detalhe do rosto' })).toBeVisible()
  const third = page.getByRole('button', { name: 'Ver imagem 3 de 3' })
  await third.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('img', { name: 'Onça-Pintada ao entardecer' })).toBeVisible()

  // The three editions, and the limit per order of each (5, 2 and 1).
  for (const [edition, limit] of [['Standard', 5], ['Rare', 2], ['Legendary', 1]] as const) {
    await page.getByRole('radio', { name: new RegExp(edition) }).check({ force: true })
    // The quantity is kept between editions and clamped to the limit of the one selected: start each from 1.
    const less = page.getByRole('button', { name: 'Diminuir quantidade' })
    while (await less.isEnabled()) await less.click()
    const more = page.getByRole('button', { name: 'Aumentar quantidade' })
    for (let step = 1; step < limit; step++) await more.click()
    await expect(more, `${edition} stops at ${limit}`).toBeDisabled()
  }

  // The total availability is the sum of the editions (18 + 5 + 1).
  await expect(page.getByText('24 unidade(s)')).toBeVisible()
})

test('all 12 detail pages open, with 3 images that load and 3 editions', async ({ page }) => {
  for (const [index, id] of FAUNA_IDS.entries()) {
    await page.goto(`/nft/${id}`)
    await expect(page.getByRole('heading', { level: 1, name: FAUNA_NAMES[index] }), id).toBeVisible()
    await expect(page.getByRole('button', { name: /^Ver imagem \d de 3$/ }), id).toHaveCount(3)
    await expect(page.getByRole('radio'), id).toHaveCount(3)
    // Wait for the image to decode (an SVG with a 600 px width reports naturalWidth 600): reading `complete` right away
    // races the download, and loses it when the machine is busy.
    await expect(page.getByRole('img', { name: new RegExp(`^${FAUNA_NAMES[index]}`) }).first(), `${id}: the main image is decoded`).toHaveJSProperty(
      'naturalWidth',
      600,
    )
  }
})

test('buying an edition uses the usual cart: the animal, its edition and its limit are there', async ({ page }) => {
  await page.goto('/nft/nft_049')
  await page.getByRole('radio', { name: /Rare/ }).check({ force: true })
  await page.getByRole('button', { name: 'Comprar' }).click()
  await expect(page.getByText('Onça-Pintada adicionado ao carrinho.')).toBeVisible()

  await page.goto('/cart')
  await expect(page.getByText('Onça-Pintada').first()).toBeVisible()
  await expect(page.getByText('nft_049_rare')).toBeVisible()
  await expect(page.getByText('máx. 2')).toBeVisible()
})

test('buying the single Legendary edition makes it sold out for everyone, and only it', async ({ page }) => {
  await signIn(page)
  type Editions = { editions: { id: string; available: number; status: string }[] }
  const before = await api<Editions>(page, '/nfts/nft_049')
  expect(before.editions.map((edition) => edition.available)).toEqual([18, 5, 1])

  await createOrderViaApi(page, { nftId: 'nft_049', editionId: 'nft_049_legendary' })

  const after = await api<Editions>(page, '/nfts/nft_049')
  const byId = Object.fromEntries(after.editions.map((edition) => [edition.id, edition]))
  expect(byId.nft_049_legendary).toMatchObject({ available: 0, status: 'sold_out' })
  expect(byId.nft_049_standard?.available, 'the other editions are untouched').toBe(18)
  expect(byId.nft_049_rare?.available).toBe(5)

  await page.goto('/nft/nft_049')
  await expect(page.getByRole('radio', { name: /Legendary/ })).toBeDisabled()
  await expect(page.getByText('Legendary · Esgotada')).toBeVisible()
  await expect(page.getByRole('radio', { name: /Standard/ })).toBeEnabled()
  await expect(page.getByRole('radio', { name: /Rare/ })).toBeEnabled()
})

test('a receipt keeps what was recorded at the purchase, even after the edition price changes', async ({ page }) => {
  await signIn(page)
  const orderId = await createOrderViaApi(page, { nftId: 'nft_050', editionId: 'nft_050_standard' })
  type Receipt = { lines: { name: string; editionName: string; unitPrice: string }[]; total: string }
  const before = await apiGet<Receipt>(page, `/orders/${orderId}`)
  expect(before.lines[0]).toMatchObject({ name: 'Arara-Azul', editionName: 'Standard' })

  await promoteCurrentUserToAdmin(page)
  const changed = await page.evaluate(
    async ([key]) => {
      const token = localStorage.getItem(key)
      const response = await fetch('/api/admin/nfts/nft_050/editions/nft_050_standard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ price: '9.5' }),
      })
      return response.status
    },
    [SESSION_KEY] as const,
  )
  expect(changed).toBe(200)
  const catalogNow = await api<{ editions: { price: string }[] }>(page, '/nfts/nft_050')
  expect(Number(catalogNow.editions[0]?.price), 'the catalog price did change').toBe(9.5)

  const after = await apiGet<Receipt>(page, `/orders/${orderId}`)
  expect(after.lines[0]?.unitPrice, 'the receipt did not').toBe(before.lines[0]?.unitPrice)
  expect(after.total).toBe(before.total)
})

test('the favorite button of an animal works and is kept after a reload', async ({ page }) => {
  await signIn(page)
  await page.goto('/nft/nft_052')
  await page.getByRole('button', { name: 'Favoritar' }).click()
  await expect(page.getByRole('button', { name: 'Favoritado' })).toHaveAttribute('aria-pressed', 'true')
  // The button updates optimistically: wait until the service really has it before reloading, or the reload can
  // abort the request in flight and the test would be checking a race.
  await expect.poll(async () => JSON.stringify(await apiGet<unknown>(page, '/favorites')).includes('nft_052')).toBe(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Favoritado' })).toBeVisible()
})

test('long animal names fit the grid and the detail on a narrow screen', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile)
  await page.goto('/')
  await expect(page.getByText('Peixe-Boi-da-Amazônia', { exact: true }).first()).toBeVisible()
  expect(await hasNoHorizontalScroll(page)).toBe(true)
  for (const id of ['nft_059', 'nft_058']) {
    await page.goto(`/nft/${id}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await hasNoHorizontalScroll(page), id).toBe(true)
  }
})

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`${name} (${viewport.width}px)`, () => {
    test.use({ viewport })

    test('the detail of the Onça-Pintada renders without horizontal scroll, accessibly, and matches its baseline', async ({ page }) => {
      await page.goto('/nft/nft_049')
      await expect(page.getByRole('heading', { level: 1, name: 'Onça-Pintada' })).toBeVisible()
      await expect(media(page).first()).toBeVisible()
      expect(await hasNoHorizontalScroll(page)).toBe(true)
      expect(await runAxe(page)).toEqual([])
      await expect(page).toHaveScreenshot(`fauna-detail-${viewport.width}.png`, { fullPage: true })
    })
  })
}

// --- US3: knowing the creator of the collection -------------------------------------------------------------------

/** The 8 creators before the collection (task T002): every one had 6 NFTs, 48 in all. */
const OLD_CREATOR_IDS = [
  'art_orbitian',
  'art_moondancer',
  'art_nebulakid',
  'art_animakid',
  'art_robotica',
  'art_keepitreal',
  'art_dishamodi',
  'art_ghiblier',
]

interface CreatorSummary {
  id: string
  name: string
  avatarUrl: string
  nftCount: number
}

test('the creators list has 9 creators: Fauna Viva with 12 NFTs, and the 8 before it with the same 6 each', async ({ page }) => {
  const creators = await api<CreatorSummary[]>(page, '/creators')
  expect(creators).toHaveLength(9)
  const byId = Object.fromEntries(creators.map((creator) => [creator.id, creator]))
  expect(byId.art_faunaviva).toMatchObject({ name: 'Fauna Viva', avatarUrl: '/art/artist-9.svg', nftCount: 12 })
  for (const id of OLD_CREATOR_IDS) expect(byId[id]?.nftCount, id).toBe(6)
  expect(OLD_CREATOR_IDS.reduce((sum, id) => sum + (byId[id]?.nftCount ?? 0), 0), 'the old creators still own 48').toBe(48)

  await page.goto('/creators')
  const card = page.getByRole('link', { name: /Fauna Viva/ })
  await expect(card).toBeVisible()
  await expect(card).toContainText('12 NFTs')
})

test('the page of Fauna Viva lists the 12 animals, each leading to its own detail', async ({ page }) => {
  await page.goto('/creators/art_faunaviva')
  await expect(page.getByRole('heading', { level: 1, name: 'Fauna Viva' })).toBeVisible()
  await expect(page.getByText('12 NFTs listados')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'NFTs deste criador' })).toBeVisible()

  for (const name of FAUNA_NAMES) await expect(page.getByText(name, { exact: true }).first(), name).toBeVisible()
  const hrefs = await page.getByRole('main').getByRole('link').evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  for (const id of FAUNA_IDS) expect(hrefs, id).toContain(`/nft/${id}`)

  await page.getByText('Onça-Pintada', { exact: true }).first().click()
  await expect(page).toHaveURL(/\/nft\/nft_049$/)
})

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`creators (${name}, ${viewport.width}px)`, () => {
    test.use({ viewport })

    test('the page of Fauna Viva has no horizontal scroll and no critical accessibility violations', async ({ page }) => {
      await page.goto('/creators/art_faunaviva')
      await expect(page.getByRole('heading', { level: 1, name: 'Fauna Viva' })).toBeVisible()
      await expect(page.getByText('Onça-Pintada', { exact: true }).first()).toBeVisible()
      expect(await hasNoHorizontalScroll(page)).toBe(true)
      expect(await runAxe(page)).toEqual([])
    })
  })
}
