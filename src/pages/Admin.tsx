import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DocumentTitle } from '../components/DocumentTitle'
import { LoginLink } from '../components/LoginModal'
import { useToast } from '../components/Toast'
import { MediaOrPlaceholder } from '../components/Placeholder'
import { useForum } from '../context/ForumContext'
import { timeAgo } from '../lib/utils'
import { api } from '../lib/api'
import { uploadImage } from '../lib/uploads'
import type { Ad, AdSlot, CmsItem, GameProvider, Report, User } from '../types'

type Tab = 'ads' | 'games' | 'featured' | 'providers' | 'communities' | 'pins' | 'moderation'

const SLOTS: { id: AdSlot; label: string }[] = [
  { id: 'left-1', label: 'Left ad 1' },
  { id: 'left-2', label: 'Left ad 2' },
  { id: 'left-3', label: 'Left ad 3' },
  { id: 'right-1', label: 'Right ad 1' },
]

async function pickImage(file?: File) {
  if (!file) return ''
  return uploadImage(file)
}

function ImageField({
  value,
  onChange,
  label = 'Image / GIF',
}: {
  value: string
  onChange: (url: string) => void
  label?: string
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1 flex items-center gap-3">
        <MediaOrPlaceholder src={value} label="Preview" className="w-20 h-14 rounded-md shrink-0" />
        <input
          type="file"
          accept="image/*,.gif"
          className="text-xs"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            onChange(await pickImage(f))
          }}
        />
        {value && (
          <button type="button" className="btn btn-secondary text-xs" onClick={() => onChange('')}>
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

export function Admin() {
  const {
    currentUser,
    isAdmin,
    state,
    getUser,
    saveAd,
    deleteAd,
    setAdRotateSec,
    saveTrendingGame,
    deleteTrendingGame,
    saveProvider,
    deleteProvider,
    toggleFeatured,
    saveCategory,
    deleteCategory,
    togglePin,
    resolveReport,
    deleteThread,
    deleteComment,
    banUser,
    setRole,
    resetDemoData,
    topCategories,
  } = useForum()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('ads')
  const [rotate, setRotate] = useState(String(state.adRotateSec))

  const [adForm, setAdForm] = useState({ id: '', slot: 'left-1' as AdSlot, title: '', url: '', imageUrl: '', order: 1 })
  const [gameForm, setGameForm] = useState({ id: '', title: '', subtitle: '', url: '', imageUrl: '', order: 1 })
  const [provForm, setProvForm] = useState({ id: '', name: '', url: '', imageUrl: '', rating: 4.5, order: 1 })
  const [catForm, setCatForm] = useState({
    id: '',
    name: '',
    slug: '',
    description: '',
    parentId: '',
    featured: false,
    order: 1,
  })
  const [stats, setStats] = useState({ users: 0, threads: 0, comments: 0, reports: 0, openReports: 0 })
  const [reports, setReports] = useState<Report[]>([])
  const [adminUsers, setAdminUsers] = useState<User[]>([])

  useEffect(() => {
    if (!isAdmin) return
    void api<{ stats: typeof stats }>('/api/admin/stats').then((res) => {
      if (res.ok) setStats(res.stats)
    })
    void api<{ reports: Report[] }>('/api/admin/reports').then((res) => {
      if (res.ok) setReports(res.reports)
    })
    void api<{ users: User[] }>('/api/admin/users').then((res) => {
      if (res.ok) setAdminUsers(res.users)
    })
  }, [isAdmin, tab])

  if (!currentUser || !isAdmin) {
    return (
      <div className="forum-card p-6 text-center max-w-lg mx-auto">
        <p className="prose-muted">Admin access required.</p>
        <LoginLink className="btn btn-primary mt-3 inline-flex">Log in</LoginLink>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ads', label: 'Ads' },
    { id: 'games', label: 'Trending games' },
    { id: 'featured', label: 'Featured' },
    { id: 'providers', label: 'Providers' },
    { id: 'communities', label: 'Communities' },
    { id: 'pins', label: 'Pins' },
    { id: 'moderation', label: 'Moderation' },
  ]

  const submitAd = (e: FormEvent) => {
    e.preventDefault()
    saveAd({
      id: adForm.id || undefined,
      slot: adForm.slot,
      title: adForm.title,
      url: adForm.url,
      imageUrl: adForm.imageUrl,
      order: Number(adForm.order) || 1,
    })
    setAdForm({ id: '', slot: 'left-1', title: '', url: '', imageUrl: '', order: 1 })
    toast('Ad saved')
  }

  const submitGame = (e: FormEvent) => {
    e.preventDefault()
    saveTrendingGame({
      id: gameForm.id || undefined,
      title: gameForm.title,
      subtitle: gameForm.subtitle,
      url: gameForm.url,
      imageUrl: gameForm.imageUrl,
      order: Number(gameForm.order) || 1,
    })
    setGameForm({ id: '', title: '', subtitle: '', url: '', imageUrl: '', order: 1 })
    toast('Trending game saved')
  }

  const submitProv = (e: FormEvent) => {
    e.preventDefault()
    saveProvider({
      id: provForm.id || undefined,
      name: provForm.name,
      url: provForm.url,
      imageUrl: provForm.imageUrl,
      rating: Number(provForm.rating) || 0,
      order: Number(provForm.order) || 1,
    })
    setProvForm({ id: '', name: '', url: '', imageUrl: '', rating: 4.5, order: 1 })
    toast('Provider saved')
  }

  const submitCat = async (e: FormEvent) => {
    e.preventDefault()
    const res = await saveCategory({
      id: catForm.id || undefined,
      name: catForm.name,
      slug: catForm.slug,
      description: catForm.description,
      parentId: catForm.parentId || null,
      featured: catForm.featured,
      order: Number(catForm.order) || 1,
    })
    if (!res.ok) {
      toast(res.error)
      return
    }
    setCatForm({ id: '', name: '', slug: '', description: '', parentId: '', featured: false, order: 1 })
    toast('Community saved')
  }

  const openReports = reports.filter((r) => r.status === 'open')

  return (
    <div className="space-y-4">
      <DocumentTitle title="Admin — MCW Forum" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title gold-text">Admin dashboard</h1>
          <p className="text-[12px] prose-muted">
            {stats.users} members · {stats.threads} threads · {stats.comments} replies · {stats.openReports} open reports
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            if (!window.confirm('Reset all demo data? You will be logged out.')) return
            void resetDemoData().then((res) => toast(res.ok ? 'Demo data reset' : res.error))
          }}
        >
          Reset demo data
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={`btn ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ads' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <form onSubmit={submitAd} className="forum-card p-4 space-y-3">
            <h2 className="font-semibold">{adForm.id ? 'Edit ad' : 'Add ad'}</h2>
            <select className="input" value={adForm.slot} onChange={(e) => setAdForm({ ...adForm, slot: e.target.value as AdSlot })}>
              {SLOTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <input className="input" placeholder="Title" value={adForm.title} onChange={(e) => setAdForm({ ...adForm, title: e.target.value })} required />
            <input className="input" placeholder="Click URL" value={adForm.url} onChange={(e) => setAdForm({ ...adForm, url: e.target.value })} />
            <input className="input" type="number" min={1} value={adForm.order} onChange={(e) => setAdForm({ ...adForm, order: Number(e.target.value) })} />
            <ImageField value={adForm.imageUrl} onChange={(imageUrl) => setAdForm({ ...adForm, imageUrl })} />
            <button type="submit" className="btn btn-primary">{adForm.id ? 'Update' : 'Add ad'}</button>
          </form>
          <div className="space-y-3">
            <form
              className="forum-card p-4 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                setAdRotateSec(Number(rotate))
                toast(`Ads rotate every ${rotate}s`)
              }}
            >
              <div className="flex-1">
                <label className="text-sm">Rotation interval (seconds)</label>
                <input className="input mt-1" type="number" min={2} max={60} value={rotate} onChange={(e) => setRotate(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-secondary">Save</button>
            </form>
            <div className="forum-card divide-y divide-[var(--color-border)]">
              {state.ads.map((ad: Ad) => (
                <div key={ad.id} className="p-3 flex items-center gap-3">
                  <MediaOrPlaceholder src={ad.imageUrl} label="Ad" className="w-16 h-10 rounded shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{ad.title || 'Untitled'}</div>
                    <div className="text-xs prose-muted">{ad.slot} · {ad.url || 'no url'}</div>
                  </div>
                  <button type="button" className="btn btn-secondary text-xs" onClick={() => setAdForm(ad)}>Edit</button>
                  <button type="button" className="btn btn-danger text-xs" onClick={() => { deleteAd(ad.id); toast('Ad deleted') }}>Delete</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'games' && (
        <CmsList
          form={
            <form onSubmit={submitGame} className="forum-card p-4 space-y-3">
              <h2 className="font-semibold">{gameForm.id ? 'Edit game' : 'Add trending game'}</h2>
              <input className="input" placeholder="Title" value={gameForm.title} onChange={(e) => setGameForm({ ...gameForm, title: e.target.value })} required />
              <input className="input" placeholder="Subtitle" value={gameForm.subtitle} onChange={(e) => setGameForm({ ...gameForm, subtitle: e.target.value })} />
              <input className="input" placeholder="Link URL" value={gameForm.url} onChange={(e) => setGameForm({ ...gameForm, url: e.target.value })} />
              <input className="input" type="number" value={gameForm.order} onChange={(e) => setGameForm({ ...gameForm, order: Number(e.target.value) })} />
              <ImageField value={gameForm.imageUrl} onChange={(imageUrl) => setGameForm({ ...gameForm, imageUrl })} />
              <button type="submit" className="btn btn-primary">Save</button>
            </form>
          }
          items={state.trendingGames}
          render={(g: CmsItem) => (
            <div className="p-3 flex items-center gap-3">
              <MediaOrPlaceholder src={g.imageUrl} label="Game" className="w-12 h-12 rounded shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{g.title}</div>
                <div className="text-xs prose-muted">{g.subtitle}</div>
              </div>
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setGameForm(g)}>Edit</button>
              <button type="button" className="btn btn-danger text-xs" onClick={() => deleteTrendingGame(g.id)}>Delete</button>
            </div>
          )}
        />
      )}

      {tab === 'providers' && (
        <CmsList
          form={
            <form onSubmit={submitProv} className="forum-card p-4 space-y-3">
              <h2 className="font-semibold">{provForm.id ? 'Edit provider' : 'Add provider'}</h2>
              <input className="input" placeholder="Name" value={provForm.name} onChange={(e) => setProvForm({ ...provForm, name: e.target.value })} required />
              <input className="input" placeholder="Link URL" value={provForm.url} onChange={(e) => setProvForm({ ...provForm, url: e.target.value })} />
              <input className="input" type="number" step="0.1" value={provForm.rating} onChange={(e) => setProvForm({ ...provForm, rating: Number(e.target.value) })} />
              <input className="input" type="number" value={provForm.order} onChange={(e) => setProvForm({ ...provForm, order: Number(e.target.value) })} />
              <ImageField value={provForm.imageUrl} onChange={(imageUrl) => setProvForm({ ...provForm, imageUrl })} />
              <button type="submit" className="btn btn-primary">Save</button>
            </form>
          }
          items={state.providers}
          render={(p: GameProvider) => (
            <div className="p-3 flex items-center gap-3">
              <MediaOrPlaceholder src={p.imageUrl} label={p.name} className="w-12 h-12 rounded shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs prose-muted">{p.rating} ★</div>
              </div>
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setProvForm(p)}>Edit</button>
              <button type="button" className="btn btn-danger text-xs" onClick={() => deleteProvider(p.id)}>Delete</button>
            </div>
          )}
        />
      )}

      {tab === 'featured' && (
        <div className="forum-card divide-y divide-[var(--color-border)]">
          {state.categories.map((c) => (
            <div key={c.id} className="p-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs prose-muted">{c.slug} {c.parentId ? '· nested' : '· top-level'}</div>
              </div>
              <button type="button" className={`btn text-sm ${c.featured ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleFeatured(c.id)}>
                {c.featured ? 'Featured' : 'Not featured'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'communities' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <form onSubmit={submitCat} className="forum-card p-4 space-y-3">
            <h2 className="font-semibold">{catForm.id ? 'Edit community' : 'Add community'}</h2>
            <input className="input" placeholder="Name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
            <input className="input" placeholder="slug-like-this" value={catForm.slug} onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} />
            <textarea className="input min-h-20" placeholder="Description" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
            <select className="input" value={catForm.parentId} onChange={(e) => setCatForm({ ...catForm, parentId: e.target.value })}>
              <option value="">No parent (top-level)</option>
              {topCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={catForm.featured} onChange={(e) => setCatForm({ ...catForm, featured: e.target.checked })} />
              Featured
            </label>
            <input className="input" type="number" value={catForm.order} onChange={(e) => setCatForm({ ...catForm, order: Number(e.target.value) })} />
            <button type="submit" className="btn btn-primary">Save</button>
          </form>
          <div className="forum-card divide-y divide-[var(--color-border)]">
            {state.categories.map((c) => (
              <div key={c.id} className="p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs prose-muted">/{c.slug}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary text-xs"
                  onClick={() =>
                    setCatForm({
                      id: c.id,
                      name: c.name,
                      slug: c.slug,
                      description: c.description,
                      parentId: c.parentId || '',
                      featured: c.featured,
                      order: c.order,
                    })
                  }
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-danger text-xs"
                  onClick={async () => {
                    const res = await deleteCategory(c.id)
                    toast(res.ok ? 'Deleted' : res.error)
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'pins' && (
        <div className="forum-card divide-y divide-[var(--color-border)]">
          {[...state.threads]
            .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
            .map((t) => (
              <div key={t.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/thread/${t.id}`} className="font-medium hover:text-[var(--color-gold)] line-clamp-1">{t.title}</Link>
                  <div className="text-xs prose-muted">{timeAgo(t.createdAt)}</div>
                </div>
                <button type="button" className={`btn text-sm ${t.pinned ? 'btn-primary' : 'btn-secondary'}`} onClick={() => togglePin(t.id)}>
                  {t.pinned ? 'Pinned' : 'Pin'}
                </button>
              </div>
            ))}
        </div>
      )}

      {tab === 'moderation' && (
        <div className="space-y-4">
          <section className="forum-card overflow-hidden">
            <div className="px-4 py-3 font-semibold border-b border-[var(--color-border)]">Open reports ({openReports.length})</div>
            {openReports.map((r) => {
              const reporter = getUser(r.reporterId)
              return (
                <div key={r.id} className="p-4 border-b border-[var(--color-border)] space-y-2">
                  <div className="text-sm">
                    <span className="gold-text uppercase text-xs">{r.targetType}</span>
                    {' · '}@{reporter?.username} · {timeAgo(r.createdAt)}
                  </div>
                  <p className="text-sm">{r.reason}</p>
                  <div className="flex flex-wrap gap-2">
                    {r.targetType === 'thread' && (
                      <button type="button" className="btn btn-danger text-sm" onClick={() => { deleteThread(r.targetId); resolveReport(r.id); toast('Thread deleted') }}>
                        Delete thread
                      </button>
                    )}
                    {r.targetType === 'comment' && (
                      <button type="button" className="btn btn-danger text-sm" onClick={() => { deleteComment(r.targetId); resolveReport(r.id); toast('Comment deleted') }}>
                        Delete comment
                      </button>
                    )}
                    {r.targetType === 'user' && (
                      <button type="button" className="btn btn-danger text-sm" onClick={() => { banUser(r.targetId, true); resolveReport(r.id); toast('User removed') }}>
                        Remove user
                      </button>
                    )}
                    <button type="button" className="btn btn-secondary text-sm" onClick={() => { resolveReport(r.id); toast('Dismissed') }}>
                      Dismiss
                    </button>
                  </div>
                </div>
              )
            })}
            {openReports.length === 0 && <div className="p-5 text-sm prose-muted">No open reports.</div>}
          </section>
          <section className="forum-card overflow-hidden">
            <div className="px-4 py-3 font-semibold border-b border-[var(--color-border)]">Users</div>
            {adminUsers.filter((u) => u.id !== currentUser.id).map((u) => (
              <div key={u.id} className="p-3 flex items-center justify-between gap-2 border-b border-[var(--color-border)]">
                <div>
                  <Link to={`/profile/${u.username}`} className="font-medium gold-text hover:underline">@{u.username}</Link>
                  <div className="text-xs prose-muted">{u.banned ? 'Removed' : u.role}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="input h-7 text-[12px] w-28"
                    value={u.role}
                    onChange={(e) => {
                      const role = e.target.value as User['role']
                      setRole(u.id, role)
                      setAdminUsers((list) => list.map((row) => (row.id === u.id ? { ...row, role } : row)))
                      toast(`Role set to ${role}`)
                    }}
                  >
                    <option value="user">user</option>
                    <option value="moderator">moderator</option>
                    <option value="admin">admin</option>
                  </select>
                  {u.role === 'user' && (
                    <button
                      type="button"
                      className={`btn text-sm ${u.banned ? 'btn-secondary' : 'btn-danger'}`}
                      onClick={() => {
                        banUser(u.id, !u.banned)
                        toast(u.banned ? 'User restored' : 'User removed')
                      }}
                    >
                      {u.banned ? 'Restore' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  )
}

function CmsList<T extends { id: string }>({
  form,
  items,
  render,
}: {
  form: ReactNode
  items: T[]
  render: (item: T) => ReactNode
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {form}
      <div className="forum-card divide-y divide-[var(--color-border)]">
        {items.map((item) => (
          <div key={item.id}>{render(item)}</div>
        ))}
        {items.length === 0 && <div className="p-5 text-sm prose-muted">Nothing here yet.</div>}
      </div>
    </div>
  )
}
