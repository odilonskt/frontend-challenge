/**
 * The three editions every catalog NFT can have: price multiplier (over the NFT's base price), supply and the
 * maximum units per order. Shared by the 48 abstract NFTs (`nfts.ts`) and the Fauna Brasileira collection (`fauna.ts`).
 */
export const EDITION_TEMPLATES = [
  { suffix: 'standard', name: 'Standard', multiplier: '1', supply: 25, maxPerOrder: 5 },
  { suffix: 'rare', name: 'Rare', multiplier: '2.5', supply: 8, maxPerOrder: 2 },
  { suffix: 'legendary', name: 'Legendary', multiplier: '6', supply: 1, maxPerOrder: 1 },
] as const
