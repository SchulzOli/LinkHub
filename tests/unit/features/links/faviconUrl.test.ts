import { describe, expect, it } from 'vitest'

import {
  createFaviconUrl,
  resolveCardFaviconUrl,
} from '../../../../src/features/links/urlValidation'

describe('resolveCardFaviconUrl', () => {
  const card = {
    url: 'https://example.com/docs/page',
    faviconUrl: createFaviconUrl('https://example.com/docs/page'),
  }

  it('keeps the stored Google favicon URL by default', () => {
    expect(resolveCardFaviconUrl(card, false)).toBe(card.faviconUrl)
    expect(card.faviconUrl).toContain('google.com/s2/favicons')
  })

  it('never returns a Google URL in offline-only mode', () => {
    expect(resolveCardFaviconUrl(card, true)).toBe(
      'https://example.com/favicon.ico',
    )
  })

  it('keeps non-Google favicon URLs in offline-only mode', () => {
    const custom = { ...card, faviconUrl: 'https://example.com/icon.png' }

    expect(resolveCardFaviconUrl(custom, true)).toBe(
      'https://example.com/icon.png',
    )
  })
})
