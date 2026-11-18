export function RouteFallback() {
  return (
    <div className="max-w-[1100px] mx-auto py-8 px-3">
      <div className="h-4 w-40 rounded bg-[var(--color-panel-2)] animate-pulse" />
      <div className="mt-4 h-8 w-2/3 max-w-xl rounded bg-[var(--color-panel-2)] animate-pulse" />
      <div className="mt-6 space-y-3">
        <div className="h-24 rounded bg-[var(--color-panel-2)] animate-pulse" />
        <div className="h-24 rounded bg-[var(--color-panel-2)] animate-pulse" />
      </div>
    </div>
  )
}
