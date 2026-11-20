import { describe, expect, it } from 'vitest'
import { withLang } from './api'

describe('withLang', () => {
  it('always appends lang=en', () => {
    expect(withLang('/api/bootstrap', 'en')).toBe('/api/bootstrap?lang=en')
    expect(withLang('/api/threads/1?include_comments=1', 'en')).toBe(
      '/api/threads/1?include_comments=1&lang=en',
    )
  })

  it('always appends lang=bn', () => {
    expect(withLang('/api/comments', 'bn')).toBe('/api/comments?lang=bn')
  })

  it('does not duplicate lang', () => {
    expect(withLang('/api/bootstrap?lang=bn', 'en')).toBe('/api/bootstrap?lang=bn')
  })
})
