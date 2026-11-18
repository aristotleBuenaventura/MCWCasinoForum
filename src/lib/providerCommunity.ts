import type { ForumCategory, GameProvider } from '../types'

/** Map brand codes / slug variants → community slug. */
const ALIASES: Record<string, string> = {
  '5g': '5g-games',
  '5g-games': '5g-games',
  ae: 'ae-sexy',
  'ae-sexy': 'ae-sexy',
  ambs: 'ambs',
  aw: 'awesome-gaming',
  'awesome-gaming': 'awesome-gaming',
  btg: 'big-time-gaming',
  'big-time-gaming': 'big-time-gaming',
  bng: 'booongo',
  booongo: 'booongo',
  bt: 'bt-gaming',
  'bt-gaming': 'bt-gaming',
  cq9: 'cq9',
  dna: 'dna-gaming',
  'dna-gaming': 'dna-gaming',
  drs: 'drsot',
  drsot: 'drsot',
  fc: 'fa-chai',
  'fa-chai': 'fa-chai',
  hs: 'hacksaw-gaming',
  hacksaw: 'hacksaw-gaming',
  'hacksaw-gaming': 'hacksaw-gaming',
  jdb: 'jdb',
  jili: 'jili',
  'jili-games': 'jili',
  ka: 'ka-gaming',
  'ka-gaming': 'ka-gaming',
  maha: 'maha-games',
  'maha-games': 'maha-games',
  mw: 'mega-win',
  'mega-win': 'mega-win',
  ma: 'microgaming',
  microgaming: 'microgaming',
  ne: 'netent',
  netent: 'netent',
  ns: 'nextspin',
  nextspin: 'nextspin',
  pg: 'pg-soft',
  'pg-soft': 'pg-soft',
  'pg-soft-games': 'pg-soft',
  pp: 'pragmatic-play',
  pragmatic: 'pragmatic-play',
  'pragmatic-play': 'pragmatic-play',
  rg: 'relax-gaming',
  'relax-gaming': 'relax-gaming',
  r88: 'rich88',
  rich88: 'rich88',
  rsg: 'royal-slot-gaming',
  'royal-slot-gaming': 'royal-slot-gaming',
  sg: 'spadegaming',
  spadegaming: 'spadegaming',
  wmt: 'wmt',
  yb: 'yeebet',
  yeebet: 'yeebet',
}

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Resolve a provider to an existing community slug, or null if none. */
export function communitySlugForProvider(
  provider: GameProvider,
  categories: ForumCategory[],
): string | null {
  const bySlug = (slug: string) => categories.find((c) => c.slug === slug)?.slug ?? null

  const fromUrl = provider.url.match(/\/communities\/([^/?#]+)/i)
  if (fromUrl?.[1]) {
    const hit = bySlug(fromUrl[1])
    if (hit) return hit
  }

  const exact = categories.find((c) => c.name.toLowerCase() === provider.name.toLowerCase())
  if (exact) return exact.slug

  const candidates = [
    slugifyName(provider.name),
    slugifyName(provider.name.replace(/\s+games?\b/gi, '')),
    slugifyName(provider.name.replace(/\s+gaming\b/gi, '')),
    slugifyName(provider.name.replace(/\s+soft\b/gi, ' soft')),
  ]

  for (const raw of candidates) {
    const slug = ALIASES[raw] || raw
    const hit = bySlug(slug)
    if (hit) return hit
  }
  return null
}

export type BrandCommunityCard = {
  key: string
  name: string
  slug: string
  imageUrl: string
}

/** Providers that map to real communities; homeTop first, then order. */
export function brandCommunityCards(
  providers: GameProvider[],
  categories: ForumCategory[],
  limit = 28,
): BrandCommunityCard[] {
  const out: BrandCommunityCard[] = []
  const seen = new Set<string>()
  const sorted = [...providers].sort((a, b) => {
    const at = a.homeTop ? 1 : 0
    const bt = b.homeTop ? 1 : 0
    if (at !== bt) return bt - at
    return a.order - b.order
  })
  for (const p of sorted) {
    const slug = communitySlugForProvider(p, categories)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    out.push({
      key: p.id,
      name: p.name,
      slug,
      imageUrl: p.imageUrl,
    })
    if (out.length >= limit) break
  }
  return out
}
