import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createPlaceholderDataUrl,
  fetchFaviconBlob,
  getFaviconPlaceholderLetter,
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

    const result = await fetchFaviconBlob(HOSTNAME, false, mockFetch)

    expect(result).not.toBeNull()
    expect(result!.size).toBe(512)
    expect(log).toHaveLength(1)
    expect(log[0].url).toBe(ICON_URL)
  })

  it('falls back to Google service when host fails and offlineOnly is false', async () => {
    stubFailOnce()
    stubOkOnce()

    const result = await fetchFaviconBlob(HOSTNAME, false, mockFetch)

    expect(result).not.toBeNull()
    expect(log).toHaveLength(2)
    expect(log[0].url).toBe(ICON_URL)
    expect(log[1].url).toBe(GOOGLE_URL)
  })

  it('does NOT fall back to Google when offlineOnly is true', async () => {
    stubFailOnce()

    const result = await fetchFaviconBlob(HOSTNAME, true, mockFetch)

    expect(result).toBeNull()
    expect(log).toHaveLength(1)
    expect(log[0].url).toBe(ICON_URL)
  })

  it('returns null when both sources fail', async () => {
    stubFailOnce()
    stubFailOnce()

    const result = await fetchFaviconBlob(HOSTNAME, false, mockFetch)

    expect(result).toBeNull()
    expect(log).toHaveLength(2)
  })

  it('returns null when the host times out and Google also fails', async () => {
    stubTimeoutOnce()
    stubFailOnce()

    const result = await fetchFaviconBlob(HOSTNAME, false, mockFetch)

    expect(result).toBeNull()
    expect(log).toHaveLength(2)
  })

  it('discards tiny blobs (< 100 bytes), falls back to Google', async () => {
    stubOkOnce(makeBlob(50))
    stubOkOnce()

    const result = await fetchFaviconBlob(HOSTNAME, false, mockFetch)

    expect(result).not.toBeNull()
    expect(result!.size).toBe(1024)
    expect(log).toHaveLength(2)
    expect(log[0].url).toBe(ICON_URL)
    expect(log[1].url).toBe(GOOGLE_URL)
  })

  it('passes AbortSignal and cache options to fetch', async () => {
    stubOkOnce()

    await fetchFaviconBlob(HOSTNAME, false, mockFetch)

    expect(log).toHaveLength(1)
    const opts = mockFetch.mock.calls[0][1] as RequestInit
    expect(opts).toHaveProperty('signal')
    expect(opts).toHaveProperty('cache', 'force-cache')
  })
})

// ─── Tests for getFaviconPlaceholderLetter ─────────────────────────────────

describe('getFaviconPlaceholderLetter', () => {
  it('extracts the first letter of the hostname (excluding www)', () => {
    expect(getFaviconPlaceholderLetter('https://example.com')).toBe('E')
    expect(getFaviconPlaceholderLetter('https://www.google.com')).toBe('G')
    expect(getFaviconPlaceholderLetter('https://github.com')).toBe('G')
  })

  it('handles URLs without protocol by assuming https', () => {
    expect(getFaviconPlaceholderLetter('example.com/page')).toBe('E')
  })

  it('falls back to the first character for unparseable input', () => {
    expect(getFaviconPlaceholderLetter('')).toBe('?')
    expect(getFaviconPlaceholderLetter('   ')).toBe('?')
    expect(getFaviconPlaceholderLetter('      ')).toBe('?')
  })

  it('returns uppercase letter', () => {
    expect(getFaviconPlaceholderLetter('localhost:3000')).toBe('L')
    expect(getFaviconPlaceholderLetter('192.168.1.1')).toBe('1')
  })
})

// ─── Tests for createPlaceholderDataUrl ────────────────────────────────────

describe('createPlaceholderDataUrl', () => {
  it('returns a valid data URL for a given letter', () => {
    const dataUrl = createPlaceholderDataUrl('G')

    expect(dataUrl).toMatch(/^data:image\/png;base64,/)
    expect(dataUrl.length).toBeGreaterThan(100)
  })

  it('works with single letters and numbers', () => {
    const dataUrlA = createPlaceholderDataUrl('A')
    const dataUrl1 = createPlaceholderDataUrl('1')

    expect(dataUrlA).toMatch(/^data:image\/png/)
    expect(dataUrl1).toMatch(/^data:image\/png/)
  })

  it('returns empty string when canvas context is unavailable', () => {
    const mockGetContext = HTMLCanvasElement.prototype.getContext as ReturnType<
      typeof vi.fn
    >
    mockGetContext.mockReturnValueOnce(null)

    const result = createPlaceholderDataUrl('X')

    expect(result).toBe('')

    mockGetContext.mockReturnValue({
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillText: vi.fn(),
      canvas: { width: 128, height: 128 },
    })
  })
})