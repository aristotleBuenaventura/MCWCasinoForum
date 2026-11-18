import { useEffect, useMemo, useRef, useState } from 'react'
import {
  filterProviderCatalog,
  loadProviderCatalog,
  type CatalogProvider,
} from '../lib/providerCatalog'

export function ProviderCatalogPicker({
  onPick,
}: {
  onPick: (provider: CatalogProvider | null) => void
}) {
  const [providers, setProviders] = useState<CatalogProvider[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadProviderCatalog().then(setProviders)
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = useMemo(
    () => filterProviderCatalog(providers, query),
    [providers, query],
  )

  return (
    <div ref={rootRef} className="space-y-1.5">
      <label className="text-sm font-medium">Pick from Slot-Meter providers</label>
      <div className="relative">
        <input
          className="input w-full"
          placeholder={
            providers.length
              ? `Search ${providers.length} providers…`
              : 'Loading catalog…'
          }
          value={query}
          disabled={!providers.length}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
        />
        {open && providers.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto forum-card p-1 shadow-lg">
            <li>
              <button
                type="button"
                className="w-full text-left px-2 py-2 text-sm rounded hover:bg-[var(--color-panel-2)]"
                onClick={() => {
                  onPick(null)
                  setQuery('')
                  setOpen(false)
                }}
              >
                Custom (manual entry)
              </button>
            </li>
            {results.map((p) => (
              <li key={p.code}>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-[var(--color-panel-2)]"
                  onClick={() => {
                    onPick(p)
                    setQuery(p.name)
                    setOpen(false)
                  }}
                >
                  <img
                    src={p.logo}
                    alt=""
                    className="w-8 h-8 rounded object-contain shrink-0 bg-[var(--color-panel-2)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate text-[11px] prose-muted">{p.code}</span>
                  </span>
                </button>
              </li>
            ))}
            {!results.length && (
              <li className="px-2 py-2 text-sm prose-muted">No matches — use Custom</li>
            )}
          </ul>
        )}
      </div>
      <p className="text-[11px] prose-muted">
        Selecting a provider fills name and logo. Choose Custom to type your own.
      </p>
    </div>
  )
}
