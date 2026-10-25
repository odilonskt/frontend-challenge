// Review tool for the "Fauna Brasileira" illustrations (specs/016-brazilian-fauna-nfts): renders the three views of each
// animal side by side in Chromium (the Playwright one the repo already installs) and writes a PNG, so the art can be
// LOOKED AT before it is accepted: each animal must be recognisable without a caption, and the 3 views must be the same
// animal. The animal's name is written outside the drawing, never inside it.
//   pnpm fauna:contact-sheet                                   # all 12 animals
//   pnpm fauna:contact-sheet -- --only=onca-pintada,capivara   # only these
//   pnpm fauna:contact-sheet -- --size=420 --out=test-results/x.png
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { FAUNA, faunaTile } from '../src/mocks/infra/fauna-art.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback

const only = option('only', '')
const size = Number(option('size', '300'))
const out = resolve(root, option('out', 'test-results/fauna-contact-sheet.png'))
const selected = only ? FAUNA.filter((animal) => only.split(',').includes(animal.slug)) : FAUNA
if (selected.length === 0) throw new Error(`No animal matches --only=${only}`)

const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

const rows = selected
  .map(
    (animal) => `<section>
      <h2>${animal.slug} (${animal.biome})</h2>
      <div>${[1, 2, 3].map((view) => `<img width="${size}" height="${size}" src="${dataUri(faunaTile(animal.slug, view))}" alt="">`).join('')}</div>
    </section>`,
  )
  .join('')

const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; padding: 12px; background: #fff; font: 14px system-ui, sans-serif; }
  h2 { margin: 10px 0 4px; font-size: 14px; }
  div { display: flex; gap: 8px; }
  img { display: block; border: 1px solid #ccc; }
</style>${rows}`

mkdirSync(dirname(out), { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: size * 3 + 48, height: 800 } })
  await page.setContent(html)
  await page.waitForLoadState('load')
  await page.screenshot({ path: out, fullPage: true })
} finally {
  await browser.close()
}
console.log(`Contact sheet of ${selected.length} animal(s) written to ${out}`)
