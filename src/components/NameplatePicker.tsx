import { useMemo, useState } from 'react'
import {
  EMBLEM_DEFS,
  FRAME_DEFS,
  MEMBERSHIP_LABELS,
  NAME_EMBLEMS,
  NAME_FRAMES,
  type NameEmblem,
  type NameFrame,
} from '../lib/nameplate'
import type { User } from '../types'
import { Username } from './Username'

type Item = {
  id: string
  label: string
  requirement: string
  unlocked: boolean
  disabled: boolean
  equipped: boolean
}

export function NameplatePicker({
  user,
  frames,
  emblems,
  membership,
  saving,
  onEquip,
}: {
  user: Pick<User, 'username' | 'displayName' | 'nameFrame' | 'nameEmblem'>
  frames: Item[]
  emblems: Item[]
  membership: string
  saving?: boolean
  onEquip: (patch: { frame?: NameFrame; emblem?: NameEmblem }) => void
}) {
  const [previewFrame, setPreviewFrame] = useState<NameFrame>(user.nameFrame)
  const [previewEmblem, setPreviewEmblem] = useState<NameEmblem>(user.nameEmblem)
  const previewUser = useMemo(
    () => ({ ...user, nameFrame: previewFrame, nameEmblem: previewEmblem }),
    [previewEmblem, previewFrame, user],
  )

  return (
    <div className="nameplate-studio">
      <div className="nameplate-preview">
        <div className="text-[11px] prose-muted mb-2">Live preview</div>
        <Username user={previewUser} link={false} />
        <div className="text-[11px] prose-muted mt-2">{MEMBERSHIP_LABELS[membership as keyof typeof MEMBERSHIP_LABELS] || 'Regular Member'}</div>
      </div>
      <section>
        <h3>Frames</h3>
        <div className="nameplate-grid">
          {NAME_FRAMES.map((id) => {
            const item = frames.find((row) => row.id === id) || {
              id,
              label: FRAME_DEFS[id].label,
              requirement: '',
              unlocked: id === 'none',
              disabled: false,
              equipped: false,
            }
            const locked = !item.unlocked || item.disabled
            return (
              <button
                key={id}
                type="button"
                className={`nameplate-option ${previewFrame === id ? 'is-on' : ''} ${locked ? 'is-locked' : ''}`}
                disabled={saving}
                onClick={() => {
                  setPreviewFrame(id)
                  if (!locked) onEquip({ frame: id })
                }}
              >
                <Username user={{ ...user, nameFrame: id, nameEmblem: 'none' }} link={false} />
                <span className="nameplate-option-label">{item.label}</span>
                {locked && <span className="nameplate-lock">{item.disabled ? 'Disabled by staff' : item.requirement}</span>}
              </button>
            )
          })}
        </div>
      </section>
      <section>
        <h3>Emblems</h3>
        <div className="nameplate-grid">
          {NAME_EMBLEMS.map((id) => {
            const item = emblems.find((row) => row.id === id) || {
              id,
              label: EMBLEM_DEFS[id].label,
              requirement: '',
              unlocked: id === 'none',
              disabled: false,
              equipped: false,
            }
            const locked = !item.unlocked || item.disabled
            return (
              <button
                key={id}
                type="button"
                className={`nameplate-option ${previewEmblem === id ? 'is-on' : ''} ${locked ? 'is-locked' : ''}`}
                disabled={saving}
                onClick={() => {
                  setPreviewEmblem(id)
                  if (!locked) onEquip({ emblem: id })
                }}
              >
                <Username user={{ ...user, nameFrame: previewFrame, nameEmblem: id }} link={false} />
                <span className="nameplate-option-label">{item.label}</span>
                {locked && <span className="nameplate-lock">{item.disabled ? 'Disabled by staff' : item.requirement}</span>}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
