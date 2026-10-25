import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  createDefaultLinkImageDataUrl,
  fetchFaviconBlob,
} from '../../../../src/features/favicon/faviconCache'

// ─── Mock canvas (jsdom lacks CanvasRenderingContext2D and toDataURL) ─────

const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () =>
      ({
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        fillText: vi.fn(),
        canvas: { width: 128, height: 128 },
      }) as unknown as CanvasRenderingContext2D,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext

  HTMLCanvasElement.prototype.toDataURL = vi.fn(
    () =>
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  )
})

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLCanvasElement.prototype.toDataURL = originalToDataURL
})

function makeBlob(size: number, type = 'image/png'): Blob {
  return new Blob([new Uint8Array(size)], { type })
}

// ─── Tests for fetchFaviconBlob ────────────────────────────────────────────

const BOTH = { site: true, google: true }
const SITE_ONLY = { site: true, google: false }

describe('fetchFaviconBlob', () => {
  const HOSTNAME = 'example.com'
  const ICON_URL = 'https://example.com/favicon.ico'
  const GOOGLE_URL =
    'https://www.google.com/s2/favicons?domain=example.com&sz=128'

  let log: Array<{ url: string }>
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    log = []
    mockFetch = vi.fn((url: string) => {
      log.push({ url })
      // Default: 404
      return Promise.resolve(new Response(null, { status: 404 }))
    })
  })

  function stubOkOnce(blob?: Blob) {
    const body = blob ?? makeBlob(1024)
    mockFetch.mockImplementationOnce(async (url: string) => {
      log.push({ url })
      return {
        ok: true,
        status: 200,
        blob: async () => body,
      }
    })
  }

  function stubFailOnce() {
    mockFetch.mockImplementationOnce((url: string) => {
      log.push({ url })
      return Promise.resolve({
        ok: false,
        status: 404,
        blob: async () => makeBlob(0),
      })
    })
  }

  function stubTimeoutOnce() {
    mockFetch.mockImplementationOnce((url: string) => {
      log.push({ url })
      return Promise.reject(
        new DOMException('The operation was aborted', 'AbortError'),
      )
    })
  }

  it('returns the blob from the host favicon.ico when it succeeds', async () => {
    stubOkOnce(makeBlob(512, 'image/x-icon'))

    const result = await fetchFaviconBlob(HOSTNAME, BOTH, mockFetch)

    expect(result).not.toBeNull()
    expect(result!.size).toBe(512)
    expect(log).toHaveLength(1)
    expect(log[0].url).toBe(ICON_URL)
  })

  it('falls back to Google service when host fails and Google is allowed', async () => {
    stubFailOnce()
    stubOkOnce()

    const result = await fetchFaviconBlob(HOSTNAME, BOTH, mockFetch)

    expect(result).not.toBeNull()
    expect(log).toHaveLength(2)
    expect(log[0].url).toBe(ICON_URL)
    expect(log[1].url).toBe(GOOGLE_URL)
  })

  it('asks a sources function right before the Google request', async () => {
    let google = true
    let resolveHost: (value: Response) => void = () => undefined

    mockFetch.mockImplementationOnce((url: string) => {
      log.push({ url })
      return new Promise<Response>((resolve) => {
        resolveHost = resolve
      })
    })

    const pending = fetchFaviconBlob(
      HOSTNAME,
      () => ({ site: true, google }),
      mockFetch,
    )

    // The user switches Google favicons off while the site request runs.
    google = false
    resolveHost(new Response(null, { status: 404 }))

    expect(await pending).toBeNull()
    expect(log.map((entry) => entry.url)).toEqual([ICON_URL])
  })

  it('requests nothing when no source is allowed', async () => {
    const result = await fetchFaviconBlob(
      HOSTNAME,
      { site: false, google: false },
      mockFetch,
    )

    expect(result).toBeNull()
    expect(log).toHaveLength(0)
  })

  it('does NOT fall back to Google when Google is not allowed', async () => {
    stubFailOnce()

    const result = await fetchFaviconBlob(HOSTNAME, SITE_ONLY, mockFetch)

    expect(result).toBeNull()
    expect(log).toHaveLength(1)
    expect(log[0].url).toBe(ICON_URL)
  })

  it('returns null when both sources fail', async () => {
    stubFailOnce()
    stubFailOnce()

    const result = await fetchFaviconBlob(HOSTNAME, BOTH, mockFetch)

    expect(result).toBeNull()
    expect(log).toHaveLength(2)
  })

  it('returns null when the host times out and Google also fails', async () => {
    stubTimeoutOnce()
    stubFailOnce()

    const result = await fetchFaviconBlob(HOSTNAME, BOTH, mockFetch)

    expect(result).toBeNull()
    expect(log).toHaveLength(2)
  })

  it('discards tiny blobs (< 100 bytes), falls back to Google', async () => {
    stubOkOnce(makeBlob(50))
    stubOkOnce()

    const result = await fetchFaviconBlob(HOSTNAME, BOTH, mockFetch)

    expect(result).not.toBeNull()
    expect(result!.size).toBe(1024)
    expect(log).toHaveLength(2)
    expect(log[0].url).toBe(ICON_URL)
    expect(log[1].url).toBe(GOOGLE_URL)
  })

  it('passes AbortSignal and cache options to fetch', async () => {
    stubOkOnce()

    await fetchFaviconBlob(HOSTNAME, BOTH, mockFetch)

    expect(log).toHaveLength(1)
    const opts = mockFetch.mock.calls[0][1] as RequestInit
    expect(opts).toHaveProperty('signal')
    expect(opts).toHaveProperty('cache', 'force-cache')
  })
})

// ─── Tests for createDefaultLinkImageDataUrl ──────────────────────────────

describe('createDefaultLinkImageDataUrl', () => {
  function decode(dataUrl: string) {
    return decodeURIComponent(dataUrl.replace('data:image/svg+xml,', ''))
  }

  it('draws a picture without loading anything', () => {
    const dataUrl = createDefaultLinkImageDataUrl('https://example.com/page')

    expect(dataUrl.startsWith('data:image/svg+xml,')).toBe(true)
    expect(decode(dataUrl)).toContain('<svg')
    expect(decode(dataUrl)).not.toMatch(/href=|https?:\/\/(?!www\.w3\.org)/)
  })

  it('gives each site its own, stable colour', () => {
    expect(createDefaultLinkImageDataUrl('https://www.github.com/a')).toBe(
      createDefaultLinkImageDataUrl('github.com/b'),
    )
    expect(createDefaultLinkImageDataUrl('github.com')).not.toBe(
      createDefaultLinkImageDataUrl('gitlab.com'),
    )
  })

  it('still draws one for an empty or odd address', () => {
    expect(createDefaultLinkImageDataUrl('')).toContain('data:image/svg+xml,')
    expect(createDefaultLinkImageDataUrl('not a url')).toContain(
      'data:image/svg+xml,',
    )
  })
})
