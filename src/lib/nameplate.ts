export const MEMBERSHIPS = ['member', 'vip', 'premium', 'elite'] as const
export type Membership = (typeof MEMBERSHIPS)[number]

export const NAME_FRAMES = [
  'none',
  'bronze',
  'silver',
  'gold',
  'diamond',
  'legendary',
  'mythic',
  'rainbow',
  'holographic',
  'royal',
  'dragon',
] as const
export type NameFrame = (typeof NAME_FRAMES)[number]

export const NAME_EMBLEMS = [
  'none',
  'crown',
  'wings',
  'shield',
  'star',
  'diamond',
  'flame',
  'lightning',
  'royal',
  'moderator',
  'administrator',
] as const
export type NameEmblem = (typeof NAME_EMBLEMS)[number]

export type NameUnlocks = { frames: NameFrame[]; emblems: NameEmblem[] }

const MEMBERSHIP_RANK: Record<Membership, number> = {
  member: 0,
  vip: 1,
  premium: 2,
  elite: 3,
}

export const MEMBERSHIP_LABELS: Record<Membership, string> = {
  member: 'Regular Member',
  vip: 'VIP',
  premium: 'Premium VIP',
  elite: 'Elite',
}

export const MEMBERSHIP_BADGE: Record<Membership, { text: string; className: string }> = {
  member: { text: 'Registered Member', className: 'role-pill rank-member' },
  vip: { text: 'VIP', className: 'role-pill rank-vip' },
  premium: { text: 'Premium VIP', className: 'role-pill rank-premium' },
  elite: { text: 'Elite', className: 'role-pill rank-elite' },
}

export function staffBadge(role: string) {
  if (role === 'admin') return { text: 'Owner', className: 'role-pill rank-owner' }
  if (role === 'moderator') return { text: 'Moderator', className: 'role-pill rank-mod' }
  return null
}

export function rankDisplayTitle(user: { role: string; membership?: string }) {
  if (user.role === 'admin') return 'Owner'
  if (user.role === 'moderator') return 'Moderator'
  return MEMBERSHIP_BADGE[parseMembership(user.membership)].text
}

/** Message keys for localized rank titles (see i18n/messages). */
export function rankDisplayKey(user: { role: string; membership?: string }):
  | 'rank.owner'
  | 'rank.moderator'
  | 'rank.registered'
  | 'rank.vip'
  | 'rank.premium'
  | 'rank.elite' {
  if (user.role === 'admin') return 'rank.owner'
  if (user.role === 'moderator') return 'rank.moderator'
  const m = parseMembership(user.membership)
  if (m === 'vip') return 'rank.vip'
  if (m === 'premium') return 'rank.premium'
  if (m === 'elite') return 'rank.elite'
  return 'rank.registered'
}

type FrameDef = {
  label: string
  minMembership: Membership
  effect?: 'shimmer' | 'glow' | 'rainbow' | 'holo' | 'spark'
}

type EmblemDef = {
  label: string
  minMembership: Membership
  staff?: 'moderator' | 'admin'
}

export const FRAME_DEFS: Record<NameFrame, FrameDef> = {
  none: { label: 'None', minMembership: 'member' },
  bronze: { label: 'Bronze', minMembership: 'vip' },
  silver: { label: 'Silver', minMembership: 'vip' },
  gold: { label: 'Gold', minMembership: 'vip', effect: 'shimmer' },
  diamond: { label: 'Diamond', minMembership: 'premium' },
  royal: { label: 'Royal', minMembership: 'premium' },
  legendary: { label: 'Legendary', minMembership: 'elite', effect: 'glow' },
  mythic: { label: 'Mythic', minMembership: 'elite', effect: 'spark' },
  rainbow: { label: 'Rainbow', minMembership: 'elite', effect: 'rainbow' },
  holographic: { label: 'Holographic', minMembership: 'elite', effect: 'holo' },
  dragon: { label: 'Dragon', minMembership: 'elite' },
}

export const EMBLEM_DEFS: Record<NameEmblem, EmblemDef> = {
  none: { label: 'None', minMembership: 'member' },
  crown: { label: 'Crown', minMembership: 'vip' },
  star: { label: 'Star', minMembership: 'vip' },
  shield: { label: 'Shield', minMembership: 'premium' },
  diamond: { label: 'Diamond', minMembership: 'premium' },
  royal: { label: 'Royal insignia', minMembership: 'premium' },
  wings: { label: 'Wings', minMembership: 'elite' },
  flame: { label: 'Flame', minMembership: 'elite' },
  lightning: { label: 'Lightning', minMembership: 'elite' },
  moderator: { label: 'Moderator', minMembership: 'member', staff: 'moderator' },
  administrator: { label: 'Administrator', minMembership: 'member', staff: 'admin' },
}

export function parseMembership(value: unknown): Membership {
  return MEMBERSHIPS.includes(value as Membership) ? (value as Membership) : 'member'
}

export function parseNameFrame(value: unknown): NameFrame {
  return NAME_FRAMES.includes(value as NameFrame) ? (value as NameFrame) : 'none'
}

export function parseNameEmblem(value: unknown): NameEmblem {
  return NAME_EMBLEMS.includes(value as NameEmblem) ? (value as NameEmblem) : 'none'
}

export function parseUnlocks(value: unknown): NameUnlocks {
  const raw = value && typeof value === 'object' ? (value as { frames?: unknown; emblems?: unknown }) : {}
  const frames = Array.isArray(raw.frames)
    ? raw.frames.map(parseNameFrame).filter((id) => id !== 'none')
    : []
  const emblems = Array.isArray(raw.emblems)
    ? raw.emblems.map(parseNameEmblem).filter((id) => id !== 'none')
    : []
  return { frames: [...new Set(frames)], emblems: [...new Set(emblems)] }
}

export function parseCsv(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return []
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function membershipRank(membership: Membership) {
  return MEMBERSHIP_RANK[membership] ?? 0
}

function hasStaff(role: string, needed?: 'moderator' | 'admin') {
  if (!needed) return true
  if (needed === 'admin') return role === 'admin'
  return role === 'moderator' || role === 'admin'
}

export function frameRequirement(id: NameFrame) {
  if (id === 'none') return 'Available to everyone'
  return `${MEMBERSHIP_LABELS[FRAME_DEFS[id].minMembership]} membership`
}

export function emblemRequirement(id: NameEmblem) {
  const def = EMBLEM_DEFS[id]
  if (id === 'none') return 'Available to everyone'
  if (def.staff === 'admin') return 'Administrator role'
  if (def.staff === 'moderator') return 'Moderator or administrator role'
  return `${MEMBERSHIP_LABELS[def.minMembership]} membership`
}

export function isFrameUnlocked(opts: {
  frame: NameFrame
  membership: Membership
  extra: NameUnlocks
  disabled: string[]
}) {
  const { frame, membership, extra, disabled } = opts
  if (frame === 'none') return true
  if (!NAME_FRAMES.includes(frame)) return false
  if (disabled.includes(frame)) return false
  if (extra.frames.includes(frame)) return true
  return membershipRank(membership) >= membershipRank(FRAME_DEFS[frame].minMembership)
}

export function isEmblemUnlocked(opts: {
  emblem: NameEmblem
  membership: Membership
  role: string
  extra: NameUnlocks
  disabled: string[]
}) {
  const { emblem, membership, role, extra, disabled } = opts
  if (emblem === 'none') return true
  if (!NAME_EMBLEMS.includes(emblem)) return false
  if (disabled.includes(emblem)) return false
  if (extra.emblems.includes(emblem)) return true
  const def = EMBLEM_DEFS[emblem]
  if (!hasStaff(role, def.staff)) return false
  return membershipRank(membership) >= membershipRank(def.minMembership)
}

export function withGrantedUnlock(extra: NameUnlocks, frame: NameFrame, emblem: NameEmblem): NameUnlocks {
  return {
    frames: frame === 'none' ? extra.frames : [...new Set([...extra.frames, frame])],
    emblems: emblem === 'none' ? extra.emblems : [...new Set([...extra.emblems, emblem])],
  }
}
