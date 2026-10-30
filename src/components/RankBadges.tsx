import { MEMBERSHIP_BADGE, parseMembership, staffBadge } from '../lib/nameplate'
import type { User } from '../types'

export function RankBadges({
  user,
  showStaffTag = false,
}: {
  user?: Pick<User, 'role' | 'membership'> | null
  showStaffTag?: boolean
}) {
  if (!user) return null
  const staff = staffBadge(user.role)
  const membership = MEMBERSHIP_BADGE[parseMembership(user.membership)]
  const showMembership = user.role === 'user' || parseMembership(user.membership) !== 'member'
  return (
    <div className="rank-badges">
      {staff && <span className={staff.className}>{staff.text}</span>}
      {showStaffTag && user.role !== 'user' && <span className="role-pill rank-staff">Staff member</span>}
      {showMembership && <span className={membership.className}>{membership.text}</span>}
    </div>
  )
}
