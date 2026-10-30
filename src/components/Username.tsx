import { Link } from 'react-router-dom'
import { parseNameEmblem, parseNameFrame } from '../lib/nameplate'
import type { User } from '../types'
import { NameEmblem } from './NameEmblem'

type Named = Pick<User, 'username' | 'displayName'> & {
  nameFrame?: User['nameFrame']
  nameEmblem?: User['nameEmblem']
}

export function Username({
  user,
  label = 'displayName',
  className = '',
  link = true,
}: {
  user?: Named | null
  label?: 'username' | 'displayName'
  className?: string
  link?: boolean
}) {
  if (!user?.username) return <span className={className}>Unknown</span>
  const frame = parseNameFrame(user.nameFrame)
  const emblem = parseNameEmblem(user.nameEmblem)
  const text = label === 'username' ? user.username : user.displayName || user.username
  const classNames = `uname-plate uname-frame-${frame} ${className}`.trim()
  const inner = (
    <>
      <span className="uname-plate-edge" aria-hidden="true" />
      <NameEmblem id={emblem} />
      <span className="uname-text">{text}</span>
    </>
  )
  if (!link) return <span className={classNames}>{inner}</span>
  return (
    <Link to={`/profile/${user.username}`} className={classNames}>
      {inner}
    </Link>
  )
}
