import { Link } from 'react-router-dom'
import { LoginLink } from '../components/LoginModal'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'
import { timeAgo } from '../lib/utils'

export function Moderation() {
  const {
    currentUser,
    isMod,
    state,
    getUser,
    resolveReport,
    deleteThread,
    deleteComment,
    banUser,
    resetDemoData,
  } = useForum()
  const toast = useToast()

  if (!currentUser || !isMod) {
    return (
      <div className="forum-card p-6 text-center">
        <p className="prose-muted">Moderator access required.</p>
        <LoginLink className="btn btn-primary mt-3 inline-flex">
          Log in as moderator
        </LoginLink>
        <p className="text-xs prose-muted mt-3">Moderator or admin login required.</p>
      </div>
    )
  }

  const openReports = state.reports.filter((r) => r.status === 'open')
  const users = state.users.filter((u) => u.role === 'user')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title gold-text">Moderation</h1>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            if (!window.confirm('Reset all demo data? You will be logged out.')) return
            resetDemoData()
            toast('Demo data reset')
          }}
        >
          Reset demo data
        </button>
      </div>

      <section className="forum-card overflow-hidden">
        <div className="forum-list-head">
          Open reports ({openReports.length})
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {openReports.map((r) => {
            const reporter = getUser(r.reporterId)
            return (
              <div key={r.id} className="p-4 space-y-2">
                <div className="text-sm">
                  <span className="font-semibold uppercase text-xs text-[var(--color-gold)]">{r.targetType}</span>
                  {' · '}
                  reported by @{reporter?.username} · {timeAgo(r.createdAt)}
                </div>
                <p className="text-sm">{r.reason}</p>
                <div className="text-xs prose-muted break-all">Target: {r.targetId}</div>
                <div className="flex flex-wrap gap-2">
                  {r.targetType === 'thread' && (
                    <button
                      type="button"
                      className="btn btn-danger text-sm"
                      onClick={() => {
                        deleteThread(r.targetId)
                        resolveReport(r.id)
                        toast('Thread deleted')
                      }}
                    >
                      Delete thread
                    </button>
                  )}
                  {r.targetType === 'comment' && (
                    <button
                      type="button"
                      className="btn btn-danger text-sm"
                      onClick={() => {
                        deleteComment(r.targetId)
                        resolveReport(r.id)
                        toast('Comment deleted')
                      }}
                    >
                      Delete comment
                    </button>
                  )}
                  {r.targetType === 'user' && (
                    <button
                      type="button"
                      className="btn btn-danger text-sm"
                      onClick={() => {
                        banUser(r.targetId, true)
                        resolveReport(r.id)
                        toast('User removed')
                      }}
                    >
                      Remove user
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    onClick={() => {
                      resolveReport(r.id)
                      toast('Report dismissed')
                    }}
                  >
                    Dismiss
                  </button>
                  {r.targetType === 'thread' && (
                    <Link to={`/thread/${r.targetId}`} className="btn btn-secondary text-sm">
                      View
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
          {openReports.length === 0 && <div className="p-5 prose-muted text-sm">No open reports.</div>}
        </div>
      </section>

      <section className="forum-card overflow-hidden">
        <div className="forum-list-head">
          Manage users
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {users.map((u) => (
            <div key={u.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link to={`/profile/${u.username}`} className="font-semibold text-[var(--color-gold)] hover:underline">
                  @{u.username}
                </Link>
                <div className="text-xs prose-muted">
                  {u.banned ? 'Removed' : 'Active'} · {u.email}
                </div>
              </div>
              <div className="flex gap-2">
                {!u.banned ? (
                  <button
                    type="button"
                    className="btn btn-danger text-sm"
                    onClick={() => {
                      if (!window.confirm(`Remove @${u.username}?`)) return
                      banUser(u.id, true)
                      toast('User removed')
                    }}
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    onClick={() => {
                      banUser(u.id, false)
                      toast('User restored')
                    }}
                  >
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
