import { useEffect, useMemo, useRef, useState } from 'react'
import { filterGameCatalog, loadGameCatalog, type CatalogGame } from '../lib/gameCatalog'

export function GameCatalogPicker({
  onPick,
}: {
  onPick: (game: CatalogGame | null) => void
}) {
  const [games, setGames] = useState<CatalogGame[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadGameCatalog().then(setGames)
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = useMemo(() => filterGameCatalog(games, query), [games, query])

  return (
    <div ref={rootRef} className="space-y-1.5">
      <label className="text-sm font-medium">Pick from Slot-Meter catalog</label>
      <div className="relative">
        <input
          className="input w-full"
          placeholder={games.length ? `Search ${games.length.toLocaleString()} games…` : 'Loading catalog…'}
          value={query}
          disabled={!games.length}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
        />
        {open && games.length > 0 && (
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
            {results.map((g) => (
              <li key={g.key}>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-[var(--color-panel-2)]"
                  onClick={() => {
                    onPick(g)
                    setQuery(`${g.name} · ${g.brand}`)
                    setOpen(false)
                  }}
                >
                  <img src={g.logo} alt="" className="w-8 h-8 rounded object-cover shrink-0 bg-[var(--color-panel-2)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{g.name}</span>
                    <span className="block truncate text-[11px] prose-muted">{g.brand}</span>
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
      <p className="text-[11px] prose-muted">Selecting a game fills title, brand, and logo. Choose Custom to type your own.</p>
    </div>
  )
}
