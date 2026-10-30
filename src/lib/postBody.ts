import { uid } from './utils'
import type { Comment, PostBody, Thread } from '../types'

export const MAX_POST_IMAGES = 8

export function emptyBody(): PostBody {
  return [{ id: uid('blk'), type: 'text', text: '' }]
}

export function legacyBody(content: string, mediaUrl?: string | null): PostBody {
  const blocks: PostBody = []
  if (content.trim()) blocks.push({ id: uid('blk'), type: 'text', text: content })
  if (mediaUrl) blocks.push({ id: uid('blk'), type: 'image', url: mediaUrl })
  return normalizeBody(blocks.length ? blocks : emptyBody())
}

export function textFromBody(body: PostBody): string {
  return body
    .filter((block): block is Extract<PostBody[number], { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n')
    .trim()
}

export function firstImageUrl(body: PostBody): string | null {
  return body.find((block) => block.type === 'image')?.url ?? null
}

export function imageCount(body: PostBody): number {
  return body.filter((block) => block.type === 'image').length
}

export function isBodyEmpty(body: PostBody): boolean {
  return !textFromBody(body) && imageCount(body) === 0
}

export function normalizeBody(body: PostBody): PostBody {
  const out: PostBody = []
  for (const block of body) {
    if (block.type === 'text') {
      const last = out[out.length - 1]
      if (last?.type === 'text') {
        last.text = [last.text, block.text].filter((part) => part.length > 0).join('\n')
      } else {
        out.push({ ...block })
      }
    } else if (block.url) {
      out.push(block)
    }
  }
  if (out[0]?.type !== 'text') out.unshift({ id: uid('blk'), type: 'text', text: '' })
  if (out[out.length - 1]?.type !== 'text') out.push({ id: uid('blk'), type: 'text', text: '' })
  if (!out.some((block) => block.type === 'text')) out.push({ id: uid('blk'), type: 'text', text: '' })
  return out
}

export function ensureThreadBody(thread: Omit<Thread, 'body'> & { body?: PostBody }): Thread {
  if (Array.isArray(thread.body) && thread.body.length) {
    return { ...thread, body: normalizeBody(thread.body) }
  }
  const body = legacyBody(thread.content, thread.mediaUrl)
  return {
    ...thread,
    body,
    content: textFromBody(body) || thread.content,
    mediaUrl: firstImageUrl(body) ?? thread.mediaUrl,
    mediaType: firstImageUrl(body) ? 'image' : thread.mediaType,
  }
}

export function ensureCommentBody(comment: Omit<Comment, 'body'> & { body?: PostBody }): Comment {
  if (Array.isArray(comment.body) && comment.body.length) {
    return { ...comment, body: normalizeBody(comment.body) }
  }
  return { ...comment, body: legacyBody(comment.content) }
}

export async function persistBodyImages(_ownerId: string, body: PostBody): Promise<PostBody> {
  return normalizeBody(
    body.map((block) => {
      if (block.type === 'image' && (block.url.startsWith('data:') || block.url.startsWith('idb:'))) {
        return { ...block, url: '' }
      }
      return block
    }),
  )
}
