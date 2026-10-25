// Generates the artwork of the "Fauna Brasileira" collection (specs/016-brazilian-fauna-nfts, see
// src/mocks/fixtures/fauna.ts): three views per animal, `public/art/nft-049…060-{1,2,3}.svg`, and the avatar of the
// creator "Fauna Viva", `public/art/artist-9.svg`. Deterministic: running it twice leaves the files byte-identical.
// `scripts/generate-art.mjs` (the 48 abstract NFTs, nft-001…048) is separate and never touches these files.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FAUNA, faunaTile } from '../src/mocks/infra/fauna-art.mjs'
import { avatar } from '../src/mocks/infra/placeholder-art.mjs'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'art')
mkdirSync(OUT_DIR, { recursive: true })

/** The first fauna NFT is nft_049: the 48 abstract ones come before it. */
const FIRST_FAUNA_NFT = 49
const VIEWS = [1, 2, 3]
/** The 8 existing creators use seeds 90_001…90_008; "Fauna Viva" is the 9th. */
const FAUNA_VIVA_AVATAR_SEED = 90_009

FAUNA.forEach((animal, index) => {
  const id = String(FIRST_FAUNA_NFT + index).padStart(3, '0')
  for (const view of VIEWS) {
    writeFileSync(join(OUT_DIR, `nft-${id}-${view}.svg`), faunaTile(animal.slug, view))
  }
})

writeFileSync(join(OUT_DIR, 'artist-9.svg'), avatar(FAUNA_VIVA_AVATAR_SEED, 'FV'))

console.log(`Generated ${FAUNA.length * VIEWS.length} fauna images and 1 creator avatar in ${OUT_DIR}`)
