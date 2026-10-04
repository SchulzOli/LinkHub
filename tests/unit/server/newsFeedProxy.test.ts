import { describe, expect, it } from 'vitest'

// @ts-expect-error -- plain ESM server module without type declarations
import {
  fetchFeed,
  getCacheSize,
  isPrivateAddress,
  parseTargetUrl,
} from '../../../server/news-feed/fetchFeed.mjs'
// @ts-expect-error -- plain ESM server module without type declarations
import { isAllowedOrigin } from '../../../server/news-feed/origins.mjs'

const publicLookup = async () => [{ address: '93.184.216.34' }]

function response(status: number, body = '', headers: object = {}) {
  return new Response(status >= 300 && status < 400 ? null : body, {
    status,
    headers: headers as Record<string, string>,
  })
}

describe('news feed proxy', () => {
  it('classifies private and public addresses', () => {
    for (const address of [
      '127.0.0.1',
      '10.1.2.3',
      '192.168.0.5',
      '172.20.0.1',
      '169.254.169.254',
      '::1',
      'fd00::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(isPrivateAddress(address), address).toBe(true)
    }

    expect(isPrivateAddress('93.184.216.34')).toBe(false)
    expect(isPrivateAddress('2a00:1450::1')).toBe(false)
  })

  it('serves only LinkHub origins', () => {
    for (const origin of [
      'http://127.0.0.1:4173',
      'http://localhost:5173',
      'chrome-extension://abcdefghijklmnop',
      'moz-extension://1234-abcd',
    ]) {
      expect(isAllowedOrigin(origin), origin).toBe(true)
    }

    for (const origin of [
      'https://evil.example',
      'http://localhost.evil.example',
      'null',
      undefined,
    ]) {
      expect(isAllowedOrigin(origin), String(origin)).toBe(false)
    }

    expect(isAllowedOrigin('https://my.host', ['https://my.host'])).toBe(true)
    expect(isAllowedOrigin('http://localhost:1', ['https://my.host'])).toBe(
      false,
    )
  })

  it('refuses private addresses at connect time (DNS rebinding)', async () => {
    // A public answer at check time does not help when the socket
    // resolves the host to loopback.
    await expect(
      fetchFeed('http://localhost:9/rss', {
        lookup: async () => [{ address: '93.184.216.34' }],
      }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('accepts only http(s) URLs', () => {
    expect(() => parseTargetUrl('file:///etc/passwd')).toThrow(/http/)
    expect(() => parseTargetUrl('')).toThrow(/invalid/)
    expect(parseTargetUrl('https://a.example/rss').href).toBe(
      'https://a.example/rss',
    )
  })

  it('returns the feed body and content type', async () => {
    const result = await fetchFeed('https://a.example/rss', {
      lookup: publicLookup,
      skipCache: true,
      fetch: async () =>
        response(200, '<rss/>', { 'content-type': 'application/rss+xml' }),
    })

    expect(String(result.body)).toBe('<rss/>')
    expect(result.contentType).toBe('application/rss+xml')
  })

  it('follows redirects but blocks redirects to private hosts', async () => {
    const calls: string[] = []
    const result = await fetchFeed('https://a.example/old', {
      lookup: publicLookup,
      skipCache: true,
      fetch: async (url: URL) => {
        calls.push(url.href)

        return url.pathname === '/old'
          ? response(301, '', { location: '/new' })
          : response(200, '<feed/>')
      },
    })

    expect(calls).toEqual(['https://a.example/old', 'https://a.example/new'])
    expect(result.finalUrl).toBe('https://a.example/new')

    await expect(
      fetchFeed('https://a.example/old', {
        lookup: publicLookup,
        skipCache: true,
        skipCache: true,
        fetch: async () =>
          response(302, '', { location: 'http://127.0.0.1:8080/admin' }),
      }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('caches responses and caps the cache size', async () => {
    let calls = 0
    const fetch = async () => {
      calls += 1
      return response(200, '<rss/>')
    }

    await fetchFeed('https://cache.example/rss', {
      lookup: publicLookup,
      fetch,
    })
    await fetchFeed('https://cache.example/rss', {
      lookup: publicLookup,
      fetch,
    })
    expect(calls).toBe(1)

    for (let index = 0; index < 80; index += 1) {
      await fetchFeed(`https://cache.example/${index}`, {
        lookup: publicLookup,
        fetch,
      })
    }

    expect(getCacheSize()).toBeLessThanOrEqual(50)
  })

  it('reports upstream errors', async () => {
    await expect(
      fetchFeed('https://a.example/rss', {
        lookup: publicLookup,
        skipCache: true,
        skipCache: true,
        fetch: async () => response(404),
      }),
    ).rejects.toThrow(/HTTP 404/)
  })
})
