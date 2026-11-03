import { useLocale } from '../i18n/locale'
import { MEMBERSHIP_BADGE, parseMembership, staffBadge } from '../lib/nameplate'
import type { User } from '../types'
import type { MessageKey } from '../i18n/messages'

const MEMBERSHIP_KEYS: Record<string, MessageKey> = {
  member: 'rank.registered',
  vip: 'rank.vip',
  premium: 'rank.premium',
  elite: 'rank.elite',
}

const STAFF_KEYS: Record<string, MessageKey> = {
  Owner: 'rank.owner',
  Moderator: 'rank.moderator',
}

export function RankBadges({
  user,
  showStaffTag = false,
}: {
  user?: Pick<User, 'role' | 'membership'> | null
  showStaffTag?: boolean
}) {
  const { t } = useLocale()
  if (!user) return null
  const staff = staffBadge(user.role)
  const membership = MEMBERSHIP_BADGE[parseMembership(user.membership)]
  const showMembership = user.role === 'user' || parseMembership(user.membership) !== 'member'
  return (
    <div className="rank-badges">
      {staff && (
        <span className={staff.className}>
          {t(STAFF_KEYS[staff.text] || 'rank.staff')}
        </span>
      )}
      {showStaffTag && user.role !== 'user' && (
        <span className="role-pill rank-staff">{t('rank.staff')}</span>
      )}
      {showMembership && (
        <span className={membership.className}>
          {t(MEMBERSHIP_KEYS[parseMembership(user.membership)] || 'rank.registered')}
        </span>
      )}
    </div>
  )
}
