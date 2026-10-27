import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import {
  clearLocalProbeCache,
  isLocalUrlReachable,
  normalizeLocalUrl,
} from '../../../../src/features/links/localFirstLink'
import { ensureLatestWorkspace } from '../../../../src/storage/storageMigrations'

describe('local links', () => {
  beforeEach(() => {
    clearLocalProbeCache()
  })

  it('reads local addresses as http unless a scheme is given', () => {
    expect(normalizeLocalUrl('192.168.1.10:8123')).toBe(
      'http://192.168.1.10:8123/',
    )
    expect(normalizeLocalUrl('nas.local:5000/photos')).toBe(
      'http://nas.local:5000/photos',
    )
    expect(normalizeLocalUrl('https://10.0.0.2')).toBe('https://10.0.0.2/')
    expect(normalizeLocalUrl('')).toBeNull()
    expect(normalizeLocalUrl('ftp://nas')).toBeNull()
  })

  it('uses the local address when it answers', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null))

    expect(
      await isLocalUrlReachable('http://192.168.1.10:8123/', { fetch }),
    ).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      'http://192.168.1.10:8123/',
      expect.objectContaining({ mode: 'no-cors', credentials: 'omit' }),
    )
  })

  it('falls back when it fails or takes too long, and remembers it', async () => {
    const failing = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    expect(
      await isLocalUrlReachable('http://192.168.1.10/', { fetch: failing }),
    ).toBe(false)

    const hanging = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        }),
    )

    expect(
      await isLocalUrlReachable('http://10.0.0.9/', {
        fetch: hanging as unknown as typeof fetch,
        timeoutMs: 20,
      }),
    ).toBe(false)

    // Cached: the next click doesn't wait again.
    const again = vi.fn().mockResolvedValue(new Response(null))

    expect(
      await isLocalUrlReachable('http://10.0.0.9/other', { fetch: again }),
    ).toBe(false)
    expect(again).not.toHaveBeenCalled()
  })

  it('keeps a valid local link through storage and drops a broken one', () => {
    const card = {
      id: 'c1',
      url: 'https://home.example.com/',
      title: 'Home',
      faviconUrl: '',
      positionX: 0,
      positionY: 0,
      size: { columns: 5, rows: 5 },
      createdAt: '2026-10-27T00:00:00.000Z',
      updatedAt: '2026-10-27T00:00:00.000Z',
    }
    const workspace = ensureLatestWorkspace({
      ...createDefaultWorkspace(),
      cards: [
        { ...card, localUrl: 'http://192.168.1.10:8123/' },
        { ...card, id: 'c2', localUrl: 'not a url at all' },
      ],
    })

    expect(workspace.cards[0].localUrl).toBe('http://192.168.1.10:8123/')
    expect(workspace.cards[1].localUrl).toBeUndefined()
  })
})
