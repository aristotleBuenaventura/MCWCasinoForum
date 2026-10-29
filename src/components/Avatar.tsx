import { UserRound } from 'lucide-react'
import type { User } from '../types'

export function Avatar({
  user,
  size = 36,
}: {
  user?: Pick<User, 'displayName' | 'username' | 'avatar'> | null
  size?: number
}) {
  const name = user?.displayName || user?.username || 'User'
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={name}
        className="rounded-full object-cover shrink-0 border border-[#2a2f3d]"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center bg-[#2a2f3c] text-[#9aa0b3] border border-[#3a4154]"
      style={{ width: size, height: size }}
      aria-label={`${name} avatar`}
    >
      <UserRound size={Math.round(size * 0.55)} strokeWidth={1.75} />
    </div>
  )
}
