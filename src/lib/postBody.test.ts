import { describe, expect, it } from 'vitest'
import { persistBodyImages } from './postBody'

describe('persistBodyImages', () => {
  it('strips data URLs and IndexedDB keys', async () => {
    const body = await persistBodyImages('x', [
      { id: '1', type: 'text', text: 'hi' },
      { id: '2', type: 'image', url: 'data:image/png;base64,aaaa' },
      { id: '3', type: 'image', url: 'idb:abc' },
      { id: '4', type: 'image', url: '/uploads/ok.png' },
    ])
    const urls = body.filter((b) => b.type === 'image').map((b) => b.url)
    expect(urls).toEqual(['/uploads/ok.png'])
  })
})
