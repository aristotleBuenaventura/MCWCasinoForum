import { avatarColor, initials } from '../lib/utils'
import type { User } from '../types'

export function Avatar({
  user,
  size = 36,
}: {
  user?: Pick<User, 'displayName' | 'username' | 'avatar'> | null
  size?: number
}) {
  const name = user?.displayName || user?.username || '?'
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full text-white font-semibold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36, background: avatarColor(name) }}
      aria-hidden
    >
      {initials(name)}
    </div>
  )
}
