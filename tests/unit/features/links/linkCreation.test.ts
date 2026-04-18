import { describe, expect, it } from 'vitest'

import { createLinkCard } from '../../../../src/features/links/linkCreation'
import { normalizeUrl } from '../../../../src/features/links/urlValidation'

describe('link creation', () => {
  it('normalizes bare domains to https', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/')
  })

  it('rejects non-http protocols', () => {
    expect(normalizeUrl('ftp://example.com')).toBeNull()
  })

  it('creates a square card with an empty title when no title is provided', () => {
    const card = createLinkCard({
      url: 'example.com',
      position: { x: 24, y: 48 },
      size: { columns: 4, rows: 6 },
    })

    expect(card).not.toBeNull()
    expect(card?.title).toBe('')
    expect(card?.size).toEqual({ columns: 4, rows: 6 })
    expect(card?.positionX).toBe(24)
    expect(card?.positionY).toBe(48)
  })

  it('keeps explicit transparency and shadow settings when provided', () => {
    const card = createLinkCard({
      url: 'example.com',
      position: { x: 24, y: 48 },
      size: { columns: 4, rows: 6 },
      surfaceTransparency: 28,
      shadowStyle: 'hard',
    })

    expect(card?.surfaceTransparency).toBe(28)
    expect(card?.shadowStyle).toBe('hard')
  })
})
