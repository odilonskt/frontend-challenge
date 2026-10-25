import Decimal from 'decimal.js'
import type { Artist, Nft, NftCategory, NftEdition } from '@/domains/catalog'
import { derivePricing } from '../contexts/catalog/pricing'
import { EDITION_TEMPLATES } from './edition-templates'

// The "Fauna Brasileira" collection (specs/016-brazilian-fauna-nfts): 12 curated NFTs of Brazilian animals, appended
// after the 48 abstract ones by `buildNftFixtures()`. Everything here is explicit data (no random generator), so the
// catalog is reproducible and the original 48 are untouched. The artwork is drawn by `scripts/generate-fauna-art.mjs`
// into `public/art/nft-049…060-{1,2,3}.svg`, in the order of this list.

const FAUNA_VIVA: Artist = { id: 'art_faunaviva', name: 'Fauna Viva', avatarUrl: '/art/artist-9.svg' }
const COLLECTION = 'Fauna Brasileira'
/** The 48 abstract NFTs come first: the first animal is `nft_049`. */
const FIRST_FAUNA_NFT = 49
/** Newer than the newest of the 48 (2026-01-15), so the collection leads "Mais recentes"; each next animal is 1 h older. */
const NEWEST_CREATED_AT = Date.UTC(2026, 0, 16, 12)
const HOUR_MS = 3600 * 1000

interface FaunaEntry {
  name: string
  category: NftCategory
  /** Price of the Standard edition, in ETH; Rare and Legendary multiply it (see EDITION_TEMPLATES). */
  basePrice: string
  /** Units still available of Standard, Rare and Legendary (supplies are 25, 8 and 1). */
  available: readonly [number, number, number]
  tags: readonly [string, string]
  description: string
  /** Only the flagship is featured: it feeds the Market's "Em alta" and "Coleções" rails (research D4). */
  featured?: true
}

// Descriptions: short, only well-established facts, no population numbers, no claim of a real on-chain registration.
const FAUNA: readonly FaunaEntry[] = [
  {
    name: 'Onça-Pintada',
    category: 'art',
    basePrice: '1.2',
    available: [18, 5, 1],
    tags: ['fauna', 'Pantanal'],
    description:
      "O maior felino das Américas é símbolo do Pantanal e da Amazônia. A obra a mostra à beira d'água, com as rosetas que distinguem cada indivíduo.",
    featured: true,
  },
  {
    name: 'Arara-Azul',
    category: 'collectibles',
    basePrice: '0.75',
    available: [22, 6, 1],
    tags: ['fauna', 'Pantanal'],
    description:
      'A arara-azul-grande é o maior papagaio voador do mundo e vive no Pantanal e no Cerrado. A obra destaca o amarelo em volta do bico e dos olhos.',
  },
  {
    name: 'Boto-Cor-de-Rosa',
    category: 'art',
    basePrice: '0.5',
    available: [25, 8, 1],
    tags: ['fauna', 'Amazônia'],
    description:
      'O boto-cor-de-rosa vive nos rios da Amazônia e é o maior golfinho de rio do mundo. A obra o mostra com o focinho comprido que o distingue.',
  },
  {
    name: 'Mico-Leão-Dourado',
    category: 'collectibles',
    basePrice: '0.33',
    available: [14, 3, 1],
    tags: ['fauna', 'Mata Atlântica'],
    description:
      'Símbolo da Mata Atlântica, o mico-leão-dourado tem pelagem alaranjada e uma juba que lhe deu o nome. Só existe no Brasil.',
  },
  {
    name: 'Tamanduá-Bandeira',
    category: 'art',
    basePrice: '0.25',
    available: [20, 7, 1],
    tags: ['fauna', 'Cerrado'],
    description:
      'O tamanduá-bandeira, dos campos e cerrados, tem focinho longo, língua comprida e uma cauda peluda que parece uma bandeira.',
  },
  {
    name: 'Lobo-Guará',
    category: 'collectibles',
    basePrice: '0.5',
    available: [17, 4, 1],
    tags: ['fauna', 'Cerrado'],
    description: 'O maior canídeo da América do Sul tem pernas longas, orelhas grandes e vive nos campos e no Cerrado.',
  },
  {
    name: 'Tucano-Toco',
    category: 'art',
    basePrice: '0.33',
    available: [23, 5, 1],
    tags: ['fauna', 'Cerrado'],
    description:
      'O maior dos tucanos tem o bico alaranjado de ponta preta, quase do tamanho do corpo, e vive no Cerrado e em áreas abertas.',
  },
  {
    name: 'Capivara',
    category: 'collectibles',
    basePrice: '0.15',
    available: [25, 8, 1],
    tags: ['fauna', 'Pantanal'],
    description: 'A capivara é o maior roedor do mundo. Vive em bandos, sempre perto da água, em grande parte do Brasil.',
  },
  {
    name: 'Bicho-Preguiça',
    category: 'art',
    basePrice: '0.12',
    available: [21, 6, 1],
    tags: ['fauna', 'Mata Atlântica'],
    description:
      'Lento e silencioso, o bicho-preguiça passa a vida nas árvores das florestas brasileiras, quase sempre pendurado nos galhos.',
  },
  {
    name: 'Jacaré-do-Pantanal',
    category: 'collectibles',
    basePrice: '0.25',
    available: [19, 5, 1],
    tags: ['fauna', 'Pantanal'],
    description:
      "Típico do Pantanal, o jacaré-do-pantanal vive em rios, lagoas e baías, com o focinho e o dorso à flor d'água.",
  },
  {
    name: 'Peixe-Boi-da-Amazônia',
    category: 'art',
    basePrice: '0.33',
    available: [16, 4, 1],
    tags: ['fauna', 'Amazônia'],
    description:
      'Mamífero aquático e herbívoro, o peixe-boi-da-amazônia vive nos rios amazônicos e se alimenta de plantas aquáticas.',
  },
  {
    name: 'Ararajuba',
    category: 'collectibles',
    basePrice: '0.75',
    available: [24, 7, 1],
    tags: ['fauna', 'Amazônia'],
    description: 'A ararajuba é uma ave da Amazônia de plumagem amarelo-dourada e asas verdes.',
  },
]

const pad = (n: number) => String(n).padStart(3, '0')

/** The 12 animals of the collection, as catalog `Nft`s (`nft_049` … `nft_060`), newest first. */
export function buildFaunaFixtures(): Nft[] {
  return FAUNA.map((entry, index) => {
    const number = FIRST_FAUNA_NFT + index
    const id = `nft_${pad(number)}`

    const editions: NftEdition[] = EDITION_TEMPLATES.map((template, editionIndex) => ({
      id: `${id}_${template.suffix}`,
      name: template.name,
      price: new Decimal(entry.basePrice).times(template.multiplier).toFixed(18),
      supply: template.supply,
      available: entry.available[editionIndex] ?? 0,
      maxPerOrder: template.maxPerOrder,
      status: 'available',
    }))

    const view = (n: number, alt: string) => ({ src: `/art/nft-${pad(number)}-${n}.svg`, alt, width: 600, height: 600 })
    const image = view(1, `${entry.name}, obra digital de ${FAUNA_VIVA.name}`)

    const nft: Nft = {
      id,
      name: entry.name,
      artist: FAUNA_VIVA,
      category: entry.category,
      image,
      featured: entry.featured === true,
      createdAt: new Date(NEWEST_CREATED_AT - index * HOUR_MS).toISOString(),
      version: 1,
      description: entry.description,
      collection: COLLECTION,
      tags: [...entry.tags],
      gallery: [image, view(2, `${entry.name}, detalhe do rosto`), view(3, `${entry.name} ao entardecer`)],
      editions,
      priceFrom: '0',
      totalAvailable: 0,
    }
    return { ...nft, ...derivePricing(nft.editions) }
  })
}
