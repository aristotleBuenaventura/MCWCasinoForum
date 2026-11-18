export type CatalogGame = {
  key: string
  name: string
  brand: string
  brandCode: string
  logo: string
}

let cache: CatalogGame[] | null = null
let loading: Promise<CatalogGame[]> | null = null

export function loadGameCatalog(): Promise<CatalogGame[]> {
  if (cache) return Promise.resolve(cache)
  if (!loading) {
    loading = fetch('/game-catalog.json')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load game catalog')
        return r.json() as Promise<CatalogGame[]>
      })
      .then((rows) => {
        cache = Array.isArray(rows) ? rows : []
        return cache
      })
      .catch(() => {
        cache = []
        return cache
      })
  }
  return loading
}

export function filterGameCatalog(games: CatalogGame[], query: string, limit = 40): CatalogGame[] {
  const s = query.trim().toLowerCase()
  if (!s) return games.slice(0, limit)
  const out: CatalogGame[] = []
  for (const g of games) {
    if (
      g.name.toLowerCase().includes(s) ||
      g.brand.toLowerCase().includes(s) ||
      g.brandCode.toLowerCase().includes(s) ||
      g.key.toLowerCase().includes(s)
    ) {
      out.push(g)
      if (out.length >= limit) break
    }
  }
  return out
}
