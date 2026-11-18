export type CatalogProvider = {
  code: string
  name: string
  logo: string
}

let cache: CatalogProvider[] | null = null
let loading: Promise<CatalogProvider[]> | null = null

export function loadProviderCatalog(): Promise<CatalogProvider[]> {
  if (cache) return Promise.resolve(cache)
  if (!loading) {
    loading = fetch('/provider-catalog.json')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load provider catalog')
        return r.json() as Promise<CatalogProvider[]>
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

export function filterProviderCatalog(
  providers: CatalogProvider[],
  query: string,
  limit = 40,
): CatalogProvider[] {
  const s = query.trim().toLowerCase()
  if (!s) return providers.slice(0, limit)
  const out: CatalogProvider[] = []
  for (const p of providers) {
    if (
      p.name.toLowerCase().includes(s) ||
      p.code.toLowerCase().includes(s)
    ) {
      out.push(p)
      if (out.length >= limit) break
    }
  }
  return out
}
