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
  const both = { site: true, google: true }
  const siteOnly = { site: true, google: false }
  const googleOnly = { site: false, google: true }
  const none = { site: false, google: false }

  it('keeps the stored Google favicon URL while Google is allowed', () => {
    expect(resolveCardFaviconUrl(card, both)).toBe(card.faviconUrl)
    expect(resolveCardFaviconUrl(card, googleOnly)).toBe(card.faviconUrl)
    expect(card.faviconUrl).toContain('google.com/s2/favicons')
  })

  it("uses the site's own favicon.ico when only the site is allowed", () => {
    expect(resolveCardFaviconUrl(card, siteOnly)).toBe(
      'https://example.com/favicon.ico',
    )
  })

  it('loads nothing when no source is allowed', () => {
    expect(resolveCardFaviconUrl(card, none)).toBe('')
  })

  it('treats other remote icons as site icons', () => {
    const custom = { ...card, faviconUrl: 'https://example.com/icon.png' }

    expect(resolveCardFaviconUrl(custom, siteOnly)).toBe(
      'https://example.com/icon.png',
    )
    expect(resolveCardFaviconUrl(custom, googleOnly)).toBe('')
  })

  it('always keeps local data: and blob: images', () => {
    const local = { ...card, faviconUrl: 'data:image/png;base64,AAAA' }

    expect(resolveCardFaviconUrl(local, none)).toBe(local.faviconUrl)
  })
})
