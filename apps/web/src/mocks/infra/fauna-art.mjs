// Stylised illustrations of the "Fauna Brasileira" collection (specs/016-brazilian-fauna-nfts), drawn by code.
// Same pattern as `placeholder-art.mjs`: one drawing module shared by a generator script
// (`scripts/generate-fauna-art.mjs` writes `public/art/nft-049…060-{1,2,3}.svg`), plain JS so plain `node` runs it.
//
// Every animal is a few geometric shapes on a 600x600 canvas, over a scene of its biome. The three views of an NFT
// are the SAME scene: 1 = whole scene, 2 = the same scene cropped on the animal's face (the SVG stays 600x600, so the
// detail is vector-sharp), 3 = the same scene at dusk. Nothing here is random: regenerating gives identical files.
// The colours are artwork, not interface chrome, so they live here and not in the design tokens.

/** Tiny deterministic PRNG (mulberry32), seeded per animal, so the scenery never changes between runs. */
function prng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedOf(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const n = (value) => String(Math.round(value * 10) / 10)

// --- Drawing helpers: each returns an SVG fragment (a string) ---------------------------------------------------

export const ellipse = (cx, cy, rx, ry, fill, extra = '') =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" ${extra}/>`
export const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" ${extra}/>`
export const rect = (x, y, w, h, fill, extra = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" ${extra}/>`
export const poly = (points, fill, extra = '') =>
  `<polygon points="${points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="${fill}" ${extra}/>`
export const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`
export const stroke = (d, color, width, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n(width)}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`
export const group = (content, transform = '') => `<g${transform ? ` transform="${transform}"` : ''}>${content.join('')}</g>`

// --- Biomes: sky, light and ground, by day and at dusk ----------------------------------------------------------

/** `horizon` is where the ground or the water starts; `water` marks a biome whose floor is a river or a flooded plain. */
export const BIOMES = {
  pantanal: {
    horizon: 380,
    water: true,
    day: { skyTop: '#6fc3e8', skyBottom: '#e6f6ee', sun: '#fff4b8', sunX: 470, sunY: 120, far: '#7da35b', ground: '#5f8a3c', water: '#3e93ad', waterLight: '#7cc4d6' },
    dusk: { skyTop: '#3d2f6b', skyBottom: '#f2a35c', sun: '#ffd27a', sunX: 470, sunY: 330, far: '#4c5f46', ground: '#3f5a33', water: '#2b5d7a', waterLight: '#e0a06a' },
  },
  amazonia: {
    horizon: 360,
    water: true,
    day: { skyTop: '#58b6d9', skyBottom: '#dff3e7', sun: '#fff7c4', sunX: 130, sunY: 110, far: '#2f7a46', ground: '#2a6b3d', water: '#3a6a66', waterLight: '#8ab8aa' },
    dusk: { skyTop: '#2f2a5e', skyBottom: '#e98a55', sun: '#ffc46e', sunX: 130, sunY: 320, far: '#1f4a35', ground: '#1f4a35', water: '#2a4a52', waterLight: '#d9946a' },
  },
  cerrado: {
    horizon: 400,
    water: false,
    day: { skyTop: '#74b9e8', skyBottom: '#f6efcf', sun: '#fff1a8', sunX: 480, sunY: 110, far: '#b9a35a', ground: '#c8a752', groundDark: '#a98a3c', waterLight: '#e6d28a' },
    dusk: { skyTop: '#47346f', skyBottom: '#f09a52', sun: '#ffc86a', sunX: 480, sunY: 320, far: '#7d6a43', ground: '#8f7338', groundDark: '#6e5a2c', waterLight: '#f0b46a' },
  },
  'mata-atlantica': {
    horizon: 410,
    water: false,
    day: { skyTop: '#8fd0c7', skyBottom: '#e8f4d8', sun: '#fff3b8', sunX: 480, sunY: 100, far: '#2f7d4a', ground: '#3b8a4b', groundDark: '#2a6b3a', waterLight: '#9bd29a' },
    dusk: { skyTop: '#3a2f63', skyBottom: '#f0955f', sun: '#ffc474', sunX: 480, sunY: 300, far: '#1f4a37', ground: '#2a5f3a', groundDark: '#1c4a2c', waterLight: '#e0a06a' },
  },
}

const BACKDROP = {
  pantanal: (b, rand, horizon) => [
    ellipse(120, horizon - 6, 200, 34, b.far),
    ellipse(470, horizon - 2, 220, 26, b.far),
    ...Array.from({ length: 5 }, (_, i) => {
      const x = 60 + i * 120 + rand() * 30
      return stroke(`M${n(x)} ${horizon} q${n(rand() * 14 - 7)} -40 ${n(rand() * 10 - 5)} -78`, b.far, 4)
    }),
  ],
  amazonia: (b, rand, horizon) =>
    Array.from({ length: 9 }, (_, i) => {
      const x = 20 + i * 70 + rand() * 24
      const r = 46 + rand() * 30
      return circle(x, horizon - 30 - rand() * 36, r, b.far) + rect(x - 5, horizon - 40, 10, 44, b.ground)
    }),
  cerrado: (b, rand, horizon) => [
    ellipse(110, horizon - 4, 220, 30, b.far),
    ellipse(480, horizon - 2, 240, 22, b.far),
    // a twisted cerrado tree: low crown on a crooked trunk
    stroke(`M500 ${horizon} q-18 -50 6 -86 q14 -26 -6 -50`, '#6e4a2a', 9),
    ellipse(500, horizon - 150, 56, 26, '#6f8a3a'),
  ],
  'mata-atlantica': (b, rand, horizon) =>
    Array.from({ length: 7 }, (_, i) => {
      const x = 30 + i * 92 + rand() * 20
      return rect(x - 8, horizon - 190 - rand() * 40, 16, 240, '#5a4630') + ellipse(x, horizon - 200 - rand() * 40, 62, 40, b.far)
    }),
}

function ground(biomeKey, b, rand) {
  const { horizon, water } = BIOMES[biomeKey]
  if (water) {
    const ripples = Array.from({ length: 9 }, () =>
      ellipse(40 + rand() * 520, horizon + 24 + rand() * (560 - horizon), 26 + rand() * 40, 3, b.waterLight, 'opacity=".55"'),
    )
    return [rect(0, horizon, 600, 600 - horizon, b.water), ...ripples]
  }
  const tufts = Array.from({ length: 14 }, () => {
    const x = 20 + rand() * 560
    const y = horizon + 20 + rand() * (570 - horizon)
    return stroke(`M${n(x)} ${n(y)} l-6 -22 M${n(x)} ${n(y)} l2 -26 M${n(x)} ${n(y)} l9 -20`, b.groundDark, 3)
  })
  return [rect(0, horizon, 600, 600 - horizon, b.ground), rect(0, horizon + 140, 600, 600 - horizon - 140, b.groundDark, 'opacity=".35"'), ...tufts]
}

/** Sky, sun, backdrop and ground of a biome, for `mood` = 'day' | 'dusk'. */
function scene(biomeKey, mood, rand) {
  const b = BIOMES[biomeKey][mood]
  return [
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b.skyTop}"/><stop offset="1" stop-color="${b.skyBottom}"/></linearGradient></defs>`,
    rect(0, 0, 600, 600, 'url(#sky)'),
    circle(b.sunX, b.sunY, 46, b.sun, 'opacity=".9"'),
    ...BACKDROP[biomeKey](b, rand, BIOMES[biomeKey].horizon),
    ...ground(biomeKey, b, rand),
  ]
}

// --- The animals -------------------------------------------------------------------------------------------------
// Order = data-model.md (Onça-Pintada is nft_049 … Ararajuba is nft_060). `focus` is the crop of view 2.

const INK = '#241812'
const shadow = (cx, cy, rx) => ellipse(cx, cy, rx, 13, '#000', 'opacity=".2"')

/** Onça-pintada: golden body, dark rosettes with a lighter centre, broad head, long tail. Faces left. */
function drawOnca() {
  const gold = '#d99a2b'
  const cream = '#f3dca2'
  const rosette = (cx, cy, r) => [circle(cx, cy, r, INK), circle(cx, cy, r * 0.56, gold), circle(cx + r * 0.12, cy, r * 0.2, INK)]
  const leg = (x, y, w, h) => [rect(x, y, w, h, gold, 'rx="13"'), ellipse(x + w / 2, y + h, w * 0.62, 10, cream)]
  const dots = [[216, 266], [229, 286], [201, 262], [223, 306], [236, 270], [250, 296]].map(([x, y]) => circle(x, y, 3.4, INK))
  return [
    shadow(330, 424, 210),
    stroke('M468 330 q66 -4 74 -64 q4 -34 -22 -50', gold, 24),
    circle(520, 216, 13, INK),
    leg(414, 362, 34, 60),
    leg(382, 368, 30, 54),
    leg(270, 362, 34, 60),
    leg(238, 368, 30, 54),
    ellipse(345, 330, 142, 64, gold),
    ellipse(345, 368, 120, 22, cream),
    ellipse(262, 312, 58, 50, gold),
    circle(206, 292, 54, gold),
    circle(178, 248, 17, gold),
    circle(178, 248, 9, INK),
    circle(232, 246, 17, gold),
    circle(232, 246, 9, INK),
    ellipse(168, 314, 32, 24, cream),
    ellipse(143, 305, 10, 8, INK),
    stroke('M148 318 q16 12 34 4', INK, 3),
    circle(192, 284, 9, '#c9a227'),
    circle(192, 284, 4.6, INK),
    ...dots,
    ...[[300, 300, 13], [345, 286, 14], [396, 298, 13], [440, 318, 11], [320, 336, 14], [374, 332, 13], [422, 346, 12], [280, 340, 11], [262, 300, 10]].flatMap(([x, y, r]) => rosette(x, y, r)),
    circle(428, 384, 4.2, INK),
    circle(286, 388, 4.2, INK),
  ]
}

/** Mico-leão-dourado: orange fur, a lion's mane around a dark face, long tail, perched on a branch. */
function drawMico() {
  const fur = '#f0891c'
  const furLight = '#f8b24c'
  const furDark = '#c96a10'
  const face = '#5a3a24'
  const mane = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2
    const half = Math.PI / 18
    const at = (angle, r) => [262 + Math.cos(angle) * r, 252 + Math.sin(angle) * r]
    return poly([at(a - half, 54), at(a, 78), at(a + half, 54)], i % 2 ? fur : furLight)
  })
  return [
    stroke('M30 396 q250 44 550 -36', '#6a4a2c', 28),
    stroke('M30 388 q250 44 550 -36', '#8f6c44', 8, 'opacity=".7"'),
    stroke('M408 338 q98 30 92 -62 q-3 -42 -46 -62', fur, 18),
    stroke('M408 338 q98 30 92 -62 q-3 -42 -46 -62', furLight, 5, 'opacity=".55"'),
    ellipse(398, 368, 25, 36, furDark),
    ellipse(398, 398, 22, 8, face),
    ellipse(346, 330, 84, 57, fur),
    ellipse(352, 352, 62, 30, furLight),
    ellipse(288, 374, 15, 32, furDark),
    ellipse(292, 402, 15, 7, face),
    ...mane,
    circle(262, 252, 58, fur),
    ellipse(262, 259, 32, 34, face),
    ellipse(256, 273, 17, 12, '#7b5236'),
    circle(249, 252, 5.4, '#150d08'),
    circle(275, 252, 5.4, '#150d08'),
    circle(250.6, 250.4, 1.7, '#fff'),
    circle(276.6, 250.4, 1.7, '#fff'),
    ellipse(256, 270, 4.6, 3.4, '#150d08'),
    // a few leaves in front of the branch
    ellipse(110, 372, 38, 14, '#2f8a3f', 'transform="rotate(-24 110 372)"'),
    ellipse(520, 366, 40, 15, '#2a7a38', 'transform="rotate(20 520 366)"'),
  ]
}

/** Tamanduá-bandeira: very long snout, the black-and-white "flag" stripe on the shoulder, huge bushy tail. Faces left. */
function drawTamandua() {
  const fur = '#8e7d6a'
  const furDark = '#5f5143'
  const furLight = '#b9a98f'
  const white = '#f2ede4'
  const black = '#1c1612'
  return [
    shadow(330, 440, 230),
    path('M438 300 C 528 216 612 268 588 362 C 572 414 500 402 450 352 Z', furDark),
    stroke('M452 322 C 520 268 566 298 556 352', furLight, 4, 'opacity=".55"'),
    stroke('M462 338 C 520 296 552 322 546 360', furLight, 4, 'opacity=".45"'),
    rect(252, 372, 26, 58, furDark, 'rx="10"'),
    rect(408, 374, 26, 56, furDark, 'rx="10"'),
    ellipse(350, 330, 114, 58, fur),
    ellipse(350, 362, 102, 20, furDark, 'opacity=".35"'),
    rect(280, 368, 30, 62, furDark, 'rx="11"'),
    rect(380, 370, 30, 60, furDark, 'rx="11"'),
    rect(280, 398, 30, 32, white, 'rx="9"'),
    rect(280, 394, 30, 7, black),
    rect(380, 400, 30, 30, white, 'rx="9"'),
    rect(380, 396, 30, 7, black),
    poly([[222, 340], [288, 256], [342, 284], [286, 372]], white),
    poly([[235, 339], [291, 269], [327, 289], [284, 358]], black),
    path('M248 282 C 198 286 142 330 84 386 L 86 399 C 140 399 202 376 254 350 Z', '#9d8b77'),
    path('M120 366 C 160 340 200 318 240 304', 'none', `stroke="${furLight}" stroke-width="3" opacity=".5"`),
    ellipse(84, 393, 8, 6, black),
    circle(198, 322, 5.4, black),
    circle(199.6, 320.4, 1.6, '#fff'),
    circle(242, 292, 12, furDark),
  ]
}

/** Lobo-guará: very long dark legs, reddish coat, huge ears, black mane, white tail tip. Faces left. */
function drawLobo() {
  const coat = '#d0661c'
  const coatLight = '#eba15a'
  const dark = '#241812'
  const white = '#f5efe4'
  const leg = (x, y) => [rect(x, y, 15, 112, dark, 'rx="7"'), ellipse(x + 7, y + 112, 12, 6, dark)]
  return [
    shadow(340, 442, 210),
    stroke('M452 296 q62 10 44 86', coat, 30),
    circle(490, 384, 17, white),
    leg(254, 336),
    leg(414, 338),
    ellipse(350, 306, 112, 44, coat),
    ellipse(350, 326, 92, 16, coatLight, 'opacity=".7"'),
    leg(290, 340),
    leg(382, 342),
    ellipse(258, 276, 40, 58, coat, 'transform="rotate(-22 258 276)"'),
    stroke('M250 232 Q336 236 440 268', dark, 17),
    stroke('M272 246 Q330 250 380 262', dark, 9),
    ellipse(218, 262, 24, 20, white),
    ellipse(206, 224, 40, 30, coat),
    poly([[132, 236], [182, 218], [232, 232], [180, 252]], coat),
    ellipse(138, 237, 8, 6.5, dark),
    poly([[190, 208], [172, 140], [220, 192]], coat),
    poly([[191, 202], [178, 160], [208, 192]], dark),
    poly([[222, 204], [244, 142], [252, 204]], coat),
    poly([[226, 202], [242, 160], [246, 202]], dark),
    circle(194, 222, 5.4, dark),
    circle(195.6, 220.4, 1.6, '#fff'),
    stroke('M140 246 q22 8 44 0', dark, 2.6),
  ]
}

/** Capivara: barrel-shaped brown body, blunt snout, tiny ears, sitting in shallow water. Faces left. */
function drawCapivara(b) {
  const fur = '#8f5d2d'
  const furDark = '#6f4520'
  const furLight = '#a87a45'
  return [
    ellipse(340, 378, 134, 74, fur),
    ellipse(340, 404, 112, 36, furLight, 'opacity=".5"'),
    ellipse(232, 330, 62, 52, fur),
    ellipse(176, 346, 38, 32, furDark),
    ellipse(148, 342, 13, 10, '#1d120a'),
    circle(142, 340, 2.2, '#5a3b22'),
    circle(154, 340, 2.2, '#5a3b22'),
    ellipse(248, 296, 13, 10, furDark),
    circle(212, 318, 6.2, '#1d120a'),
    circle(213.8, 316.2, 1.8, '#fff'),
    stroke('M164 360 q14 8 30 2', '#1d120a', 2.6),
    stroke('M300 330 l-4 22 M330 322 l-2 24 M362 326 l2 24 M392 336 l4 22', furDark, 3, 'opacity=".6"'),
    // the animal sits in the water: the surface covers its legs and belly
    rect(0, 410, 600, 190, b.water, 'opacity=".66"'),
    ellipse(300, 414, 220, 4, b.waterLight, 'opacity=".7"'),
    ellipse(170, 470, 60, 3, b.waterLight, 'opacity=".5"'),
    ellipse(440, 482, 80, 3, b.waterLight, 'opacity=".5"'),
  ]
}

/** Bicho-preguiça: hangs from a branch, pale face with the dark eye mask, shaggy fur, long claws. Faces left. */
function drawPreguica() {
  const fur = '#b89c78'
  const furDark = '#8a7152'
  const mask = '#4a3322'
  const face = '#dccaa8'
  const claws = (x, y) => stroke(`M${x} ${y} l-5 -22 M${x + 8} ${y} l0 -24 M${x + 16} ${y} l5 -22`, '#3a2a1c', 4)
  return [
    stroke('M20 168 q280 -30 560 20', '#6a4a2c', 30),
    stroke('M20 160 q280 -30 560 20', '#8f6c44', 8, 'opacity=".6"'),
    stroke('M380 224 Q 392 196 396 170', fur, 20),
    claws(386, 176),
    stroke('M300 226 Q 292 198 286 174', furDark, 20),
    claws(276, 180),
    ellipse(318, 262, 108, 52, fur),
    ellipse(318, 282, 90, 22, furDark, 'opacity=".4"'),
    stroke('M250 250 l-8 20 M280 258 l-6 22 M320 262 l-4 22 M360 260 l-2 22 M392 254 l2 20', furDark, 4, 'opacity=".7"'),
    circle(206, 282, 46, face),
    ellipse(206, 274, 40, 12, mask, 'transform="rotate(-8 206 274)"'),
    circle(190, 274, 5, '#120b06'),
    circle(224, 272, 5, '#120b06'),
    circle(191.6, 272.4, 1.6, '#fff'),
    circle(225.6, 270.4, 1.6, '#fff'),
    ellipse(196, 296, 8, 6, mask),
    stroke('M184 308 q18 12 38 -2', mask, 3),
    ellipse(112, 392, 38, 14, '#2f8a3f', 'transform="rotate(-28 112 392)"'),
    ellipse(500, 120, 42, 14, '#2a7a38', 'transform="rotate(20 500 120)"'),
    ellipse(70, 130, 38, 13, '#2a7a38', 'transform="rotate(-16 70 130)"'),
  ]
}

/** Arara-azul: cobalt body, yellow patch around the eye, big black hooked bill, long pointed tail. Faces left. */
function drawArara() {
  const blue = '#1f45c4'
  const blueLight = '#3d67e0'
  const blueDark = '#17308f'
  const yellow = '#f4c81c'
  const black = '#18181d'
  return [
    stroke('M40 398 Q 300 372 570 414', '#6a4a2c', 26),
    stroke('M40 390 Q 300 364 570 406', '#8f6c44', 7, 'opacity=".6"'),
    poly([[318, 330], [394, 540], [374, 546], [292, 340]], blueDark),
    poly([[336, 330], [420, 520], [402, 530], [316, 340]], blue),
    ellipse(312, 262, 64, 104, blue, 'transform="rotate(8 312 262)"'),
    ellipse(284, 292, 30, 70, blueLight, 'opacity=".55" transform="rotate(8 284 292)"'),
    ellipse(338, 288, 40, 92, blueDark, 'transform="rotate(12 338 288)"'),
    circle(264, 168, 52, blue),
    ellipse(240, 184, 34, 24, yellow),
    circle(246, 170, 10, '#f6f1d8'),
    circle(246, 170, 5.4, black),
    circle(247.6, 168.4, 1.6, '#fff'),
    path('M236 134 C 178 122 154 186 192 232 C 204 212 214 192 238 180 Z', black),
    path('M196 214 C 206 232 226 238 240 226 C 228 214 214 208 196 214 Z', black),
    ellipse(224, 206, 14, 8, yellow, 'transform="rotate(-24 224 206)"'),
    ellipse(296, 398, 18, 7, '#6d6d72'),
    ellipse(332, 402, 18, 7, '#6d6d72'),
    stroke('M470 120 q40 -40 100 -30 M490 150 q50 -20 90 10', '#2f8a3f', 12),
  ]
}

/** Tucano-toco: black body, white throat, enormous orange bill with a black spot near the tip. Faces left. */
function drawTucano() {
  const black = '#18141c'
  const orange = '#f28a1c'
  const orangeDark = '#df7412'
  return [
    stroke('M30 408 Q 300 382 570 420', '#6a4a2c', 26),
    stroke('M30 400 Q 300 374 570 412', '#8f6c44', 7, 'opacity=".6"'),
    poly([[328, 350], [380, 470], [358, 478], [300, 362]], black),
    ellipse(322, 292, 66, 104, black, 'transform="rotate(6 322 292)"'),
    ellipse(280, 238, 34, 42, '#f4efe6'),
    ellipse(334, 384, 24, 10, '#d6402a'),
    circle(268, 196, 46, black),
    ellipse(262, 232, 30, 24, '#f4efe6'),
    path('M236 166 C 150 140 84 172 60 218 C 116 238 192 232 240 218 Z', orange),
    stroke('M236 168 C 160 152 100 176 72 206', '#ffd36a', 6, 'opacity=".8"'),
    path('M240 218 C 192 232 120 240 70 224 C 100 250 190 252 240 236 Z', orangeDark),
    circle(92, 205, 12, black),
    circle(252, 188, 17, '#2f7be0'),
    circle(252, 188, 13, '#f5a02a'),
    circle(252, 188, 6, black),
    circle(253.6, 186.4, 1.8, '#fff'),
    ellipse(468, 130, 46, 15, '#2a7a38', 'transform="rotate(18 468 130)"'),
    ellipse(70, 150, 40, 14, '#2a7a38', 'transform="rotate(-18 70 150)"'),
  ]
}

/** Ararajuba: golden-yellow plumage, green wings, pale bill, long tail. Faces left. */
function drawArarajuba() {
  const yellow = '#f4c61a'
  const yellowLight = '#f9de60'
  const green = '#2e8d3c'
  const greenDark = '#1f6a2b'
  return [
    stroke('M30 396 Q 300 370 570 412', '#6a4a2c', 26),
    stroke('M30 388 Q 300 362 570 404', '#8f6c44', 7, 'opacity=".6"'),
    poly([[322, 336], [392, 520], [372, 528], [296, 346]], greenDark),
    poly([[340, 336], [412, 500], [396, 512], [322, 346]], green),
    ellipse(312, 264, 58, 96, yellow, 'transform="rotate(8 312 264)"'),
    ellipse(292, 292, 28, 64, yellowLight, 'opacity=".6" transform="rotate(8 292 292)"'),
    ellipse(338, 290, 38, 88, green, 'transform="rotate(12 338 290)"'),
    stroke('M326 232 q14 60 8 130 M346 240 q16 56 12 122', greenDark, 3, 'opacity=".6"'),
    circle(266, 176, 46, yellow),
    circle(250, 170, 11, '#fff6d6'),
    circle(250, 170, 6, '#120d08'),
    circle(251.6, 168.4, 1.8, '#fff'),
    path('M236 166 C 196 164 188 206 210 224 C 220 210 230 198 244 190 Z', '#f1e2c0'),
    path('M210 224 C 224 232 238 226 244 214 C 232 210 220 212 210 224 Z', '#d8c8a2'),
    ellipse(298, 398, 16, 6, '#e07b2a'),
    ellipse(332, 402, 16, 6, '#e07b2a'),
    ellipse(480, 130, 46, 15, '#2a7a38', 'transform="rotate(18 480 130)"'),
    ellipse(80, 140, 42, 14, '#2a7a38', 'transform="rotate(-18 80 140)"'),
  ]
}

/** Boto-cor-de-rosa: pink river dolphin surfacing, long thin beak, bulging forehead, low dorsal ridge. Faces left. */
function drawBoto(b) {
  const pink = '#e98aa6'
  const pinkLight = '#f7bccb'
  const pinkDark = '#c96b88'
  return [
    path('M488 332 C 530 306 560 288 574 270 C 570 306 574 336 592 366 C 552 356 520 352 488 352 Z', pinkDark),
    ellipse(350, 338, 152, 54, pink, 'transform="rotate(-5 350 338)"'),
    ellipse(338, 364, 124, 20, pinkLight, 'opacity=".8"'),
    poly([[332, 294], [376, 280], [408, 304]], pinkDark),
    poly([[250, 352], [286, 424], [322, 414], [292, 346]], pinkDark),
    ellipse(214, 322, 46, 40, pink),
    circle(228, 292, 31, pink),
    poly([[76, 336], [194, 306], [196, 344]], pink),
    circle(78, 337, 7.5, pink),
    stroke('M82 340 q58 14 110 -2', pinkDark, 3),
    circle(200, 308, 5, '#2a1018'),
    circle(201.4, 306.6, 1.5, '#fff'),
    // the river covers the lower half: the dolphin is surfacing
    rect(0, 372, 600, 228, b.water, 'opacity=".78"'),
    ellipse(160, 372, 90, 4, b.waterLight, 'opacity=".8"'),
    ellipse(430, 376, 120, 4, b.waterLight, 'opacity=".7"'),
    circle(120, 316, 4, '#fff', 'opacity=".8"'),
    circle(150, 298, 3, '#fff', 'opacity=".8"'),
    circle(540, 262, 4, '#fff', 'opacity=".8"'),
    circle(512, 280, 3, '#fff', 'opacity=".8"'),
  ]
}

/** Jacaré-do-pantanal: only the long snout, the eye bumps and the ridged back above the water. Faces left. */
function drawJacare(b) {
  const skin = '#667a3e'
  const skinDark = '#475a2a'
  const teeth = Array.from({ length: 8 }, (_, i) => poly([[74 + i * 18, 392], [80 + i * 18, 392], [77 + i * 18, 402]], '#f4efe0'))
  const ridge = Array.from({ length: 14 }, (_, i) => poly([[268 + i * 20, 380], [277 + i * 20, 364], [286 + i * 20, 380]], skinDark))
  return [
    ellipse(396, 388, 156, 24, skin),
    ...ridge,
    path('M530 386 C 560 392 580 404 600 424 L 600 442 C 570 422 546 410 520 404 Z', skinDark),
    ellipse(124, 382, 88, 17, skin),
    ellipse(224, 374, 50, 26, skin),
    circle(50, 372, 7, skin),
    circle(49, 371, 2, skinDark),
    circle(228, 352, 12, skin),
    circle(260, 355, 11, skin),
    circle(228, 352, 6.4, '#dcc734'),
    ellipse(228, 352, 1.8, 5.2, '#16130a'),
    circle(260, 355, 6, '#dcc734'),
    ellipse(260, 355, 1.7, 4.8, '#16130a'),
    ...teeth,
    rect(0, 396, 600, 204, b.water, 'opacity=".78"'),
    ellipse(120, 396, 100, 4, b.waterLight, 'opacity=".8"'),
    ellipse(380, 402, 160, 4, b.waterLight, 'opacity=".7"'),
    ellipse(60, 420, 50, 3, b.waterLight, 'opacity=".6"'),
  ]
}

/** Peixe-boi-da-amazônia: round grey body, spatulate tail, blunt bristly snout, floating plants. Faces left. */
function drawPeixeBoi(b) {
  const grey = '#8e98a3'
  const greyLight = '#aab2bb'
  const greyDark = '#6f7882'
  return [
    ellipse(332, 380, 152, 62, grey),
    ellipse(336, 404, 124, 26, greyLight, 'opacity=".6"'),
    ellipse(468, 388, 56, 30, grey),
    ellipse(528, 398, 60, 24, greyDark, 'transform="rotate(6 528 398)"'),
    ellipse(205, 366, 52, 46, grey),
    ellipse(164, 378, 34, 26, greyLight),
    ellipse(144, 374, 12, 9, greyDark),
    circle(152, 366, 2.4, '#1a1e22'),
    circle(162, 366, 2.4, '#1a1e22'),
    stroke('M140 388 l-12 6 M148 392 l-10 10 M158 392 l-4 12', '#444b52', 2.6),
    circle(200, 352, 4.8, '#1a1e22'),
    circle(201.4, 350.6, 1.4, '#fff'),
    ellipse(270, 416, 42, 16, greyDark, 'transform="rotate(32 270 416)"'),
    stroke('M300 360 q24 14 30 44 M350 354 q22 14 28 46', greyDark, 3, 'opacity=".5"'),
    rect(0, 400, 600, 200, b.water, 'opacity=".5"'),
    ellipse(110, 392, 30, 9, '#3f9a4a'),
    ellipse(80, 400, 24, 8, '#378a42'),
    ellipse(600 - 90, 372, 30, 9, '#3f9a4a'),
    ellipse(200, 410, 120, 4, b.waterLight, 'opacity=".6"'),
  ]
}

export const FAUNA = [
  { slug: 'onca-pintada', biome: 'pantanal', focus: { x: 110, y: 215, width: 200, height: 200 }, draw: drawOnca },
  { slug: 'arara-azul', biome: 'pantanal', focus: { x: 140, y: 100, width: 200, height: 200 }, draw: drawArara },
  { slug: 'boto-cor-de-rosa', biome: 'amazonia', focus: { x: 56, y: 236, width: 220, height: 220 }, draw: drawBoto },
  { slug: 'mico-leao-dourado', biome: 'mata-atlantica', focus: { x: 172, y: 162, width: 180, height: 180 }, draw: drawMico },
  { slug: 'tamandua-bandeira', biome: 'cerrado', focus: { x: 50, y: 250, width: 240, height: 240 }, draw: drawTamandua },
  { slug: 'lobo-guara', biome: 'cerrado', focus: { x: 110, y: 130, width: 170, height: 170 }, draw: drawLobo },
  { slug: 'tucano-toco', biome: 'cerrado', focus: { x: 44, y: 116, width: 260, height: 260 }, draw: drawTucano },
  { slug: 'capivara', biome: 'pantanal', focus: { x: 100, y: 250, width: 200, height: 200 }, draw: drawCapivara },
  { slug: 'bicho-preguica', biome: 'mata-atlantica', focus: { x: 126, y: 196, width: 170, height: 170 }, draw: drawPreguica },
  { slug: 'jacare-do-pantanal', biome: 'pantanal', focus: { x: 30, y: 300, width: 260, height: 260 }, draw: drawJacare },
  { slug: 'peixe-boi-da-amazonia', biome: 'amazonia', focus: { x: 110, y: 296, width: 200, height: 200 }, draw: drawPeixeBoi },
  { slug: 'ararajuba', biome: 'amazonia', focus: { x: 170, y: 100, width: 170, height: 170 }, draw: drawArarajuba },
]

/** A 600x600 SVG of `slug`. `view`: 1 = whole scene, 2 = face detail (cropped viewBox), 3 = the same scene at dusk. */
export function faunaTile(slug, view) {
  const animal = FAUNA.find((candidate) => candidate.slug === slug)
  if (!animal) throw new Error(`Unknown fauna slug: ${slug}`)
  if (view !== 1 && view !== 2 && view !== 3) throw new Error(`Unknown view: ${view}`)

  const mood = view === 3 ? 'dusk' : 'day'
  const rand = prng(seedOf(slug))
  const palette = BIOMES[animal.biome][mood]
  const crop = view === 2 ? animal.focus : { x: 0, y: 0, width: 600, height: 600 }
  const dusk = view === 3 ? rect(0, 0, 600, 600, '#2a1646', 'opacity=".26"') : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}">${scene(animal.biome, mood, rand).join('')}${animal.draw(palette).flat(Infinity).join('')}${dusk}</svg>\n`
}
