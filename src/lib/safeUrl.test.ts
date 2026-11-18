import { describe, expect, it } from 'vitest'
import { safeExternalHref } from './utils'

describe('safeExternalHref', () => {
  it('allows http(s) and relative paths', () => {
    expect(safeExternalHref('https://example.com/a')).toBe('https://example.com/a')
    expect(safeExternalHref('/wp-content/uploads/x.png')).toBe('/wp-content/uploads/x.png')
  })

  it('blocks dangerous schemes and protocol-relative URLs', () => {
    expect(safeExternalHref('javascript:alert(1)')).toBeUndefined()
    expect(safeExternalHref('data:text/html,x')).toBeUndefined()
    expect(safeExternalHref('//evil.example/x')).toBeUndefined()
    expect(safeExternalHref('vbscript:x')).toBeUndefined()
  })
})
