import { readSessionCache, writeSessionCache } from './sessionCache'
import type { User } from '../types'

export type MemberRow = {
  user: User
  messages: number
  reactions: number
  media: number
  lastAt?: string
}

const PREFIX = 'mcw-members-v1:'

function key(boardKey: string, query: string) {
  return `${PREFIX}${boardKey}:${query}`
}

export function readMembersCache(boardKey: string, query: string): MemberRow[] | null {
  const parsed = readSessionCache<{ members?: MemberRow[] }>(key(boardKey, query))
  if (!parsed || !Array.isArray(parsed.members)) return null
  return parsed.members
}

export function writeMembersCache(boardKey: string, query: string, members: MemberRow[]) {
  writeSessionCache(key(boardKey, query), { members })
}
