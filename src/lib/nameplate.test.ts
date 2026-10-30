import { describe, expect, it } from 'vitest'
import {
  isEmblemUnlocked,
  isFrameUnlocked,
  parseMembership,
  parseNameEmblem,
  parseNameFrame,
  parseUnlocks,
  rankDisplayTitle,
} from './nameplate'

describe('parse nameplate ids', () => {
  it('accepts known frames and emblems', () => {
    expect(parseNameFrame('gold')).toBe('gold')
    expect(parseNameEmblem('crown')).toBe('crown')
    expect(parseMembership('elite')).toBe('elite')
  })

  it('rejects injected values', () => {
    expect(parseNameFrame('<script>')).toBe('none')
    expect(parseNameEmblem('background:url(x)')).toBe('none')
    expect(parseMembership('admin')).toBe('member')
  })

  it('shows membership on titles, staff role first', () => {
    expect(rankDisplayTitle({ role: 'user', membership: 'vip' })).toBe('VIP')
    expect(rankDisplayTitle({ role: 'user', membership: 'premium' })).toBe('Premium VIP')
    expect(rankDisplayTitle({ role: 'user', membership: 'elite' })).toBe('Elite')
    expect(rankDisplayTitle({ role: 'moderator', membership: 'elite' })).toBe('Moderator')
  })
})

describe('unlocks', () => {
  it('lets VIP equip gold but not mythic', () => {
    const extra = parseUnlocks({})
    expect(isFrameUnlocked({ frame: 'gold', membership: 'vip', extra, disabled: [] })).toBe(true)
    expect(isFrameUnlocked({ frame: 'mythic', membership: 'vip', extra, disabled: [] })).toBe(false)
  })

  it('lets extra unlocks bypass membership', () => {
    const extra = parseUnlocks({ frames: ['dragon'] })
    expect(isFrameUnlocked({ frame: 'dragon', membership: 'member', extra, disabled: [] })).toBe(true)
  })

  it('blocks disabled frames even with extra unlocks', () => {
    const extra = parseUnlocks({ frames: ['gold'] })
    expect(isFrameUnlocked({ frame: 'gold', membership: 'elite', extra, disabled: ['gold'] })).toBe(false)
  })

  it('gates staff emblems by role', () => {
    const extra = parseUnlocks({})
    expect(
      isEmblemUnlocked({ emblem: 'moderator', membership: 'member', role: 'user', extra, disabled: [] }),
    ).toBe(false)
    expect(
      isEmblemUnlocked({ emblem: 'moderator', membership: 'member', role: 'moderator', extra, disabled: [] }),
    ).toBe(true)
    expect(
      isEmblemUnlocked({ emblem: 'administrator', membership: 'elite', role: 'moderator', extra, disabled: [] }),
    ).toBe(false)
  })
})
