import type { PostBody } from '../types'
import { ForumMedia } from './ForumMedia'

export function PostBodyView({ body }: { body: PostBody }) {
  const blocks = body.filter((block) => (block.type === 'text' ? block.text.trim() : Boolean(block.url)))
  if (blocks.length === 0) return null
  return (
    <div className="space-y-3">
      {blocks.map((block) =>
        block.type === 'text' ? (
          <div key={block.id} className="text-[14px] leading-7 whitespace-pre-wrap">
            {block.text}
          </div>
        ) : (
          <ForumMedia
            key={block.id}
            url={block.url}
            type="image"
            lightbox
            className="max-h-80 max-w-full rounded border border-[#2c2618]"
          />
        ),
      )}
    </div>
  )
}
