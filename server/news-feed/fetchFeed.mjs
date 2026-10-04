/**
 * Fetches one feed for the news proxy with the limits a local proxy needs:
 * http(s) only, no private/loopback targets (also after redirects), a
 * timeout and a size cap.
 */
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const USER_AGENT = 'Mozilla/5.0 (LinkHub news feed proxy)'
const TIMEOUT_MS = Number(process.env.FEED_TIMEOUT_MS ?? 15000)
const MAX_BYTES = Number(process.env.FEED_MAX_BYTES ?? 5 * 1024 * 1024)
const MAX_REDIRECTS = 5
const CACHE_MS = Number(process.env.FEED_CACHE_MS ?? 60000)

export class FeedProxyError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.status = status
  }
}

/** True for loopback, private, link-local, CGNAT and unspecified ranges. */
export function isPrivateAddress(address) {
  const version = isIP(address)

  if (version === 4) {
    const [a, b] = address.split('.').map(Number)

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    )
  }

  if (version === 6) {
    const lower = address.toLowerCase()

    if (lower.startsWith('::ffff:')) {
      return isPrivateAddress(lower.slice(7))
    }

    return (
      lower === '::' ||
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    )
  }

  return true
}

export function parseTargetUrl(value) {
  let url

  try {
    url = new URL(String(value ?? '').trim())
  } catch {
    throw new FeedProxyError('Missing or invalid url parameter', 400)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FeedProxyError('Only http:// and https:// feeds are allowed', 400)
  }

  return url
}

async function assertPublicHost(url, resolve = lookup) {
  if (process.env.FEED_ALLOW_PRIVATE === '1') {
    return
  }

  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host)
    ? [{ address: host }]
    : await resolve(host, { all: true }).catch(() => {
        throw new FeedProxyError(`Host not found: ${host}`, 502)
      })

  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new FeedProxyError(
      'Private and local addresses are blocked (set FEED_ALLOW_PRIVATE=1 to allow)',
      403,
    )
  }
}

async function readLimited(response) {
  const reader = response.body?.getReader()

  if (!reader) {
    return ''
  }

  const chunks = []
  let total = 0

  for (;;) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    total += value.byteLength

    if (total > MAX_BYTES) {
      await reader.cancel()
      throw new FeedProxyError('Feed is larger than the size limit', 413)
    }

    chunks.push(value)
  }

  return Buffer.concat(chunks)
}

const cache = new Map()

/** Returns `{ body: Buffer, contentType, finalUrl }`. */
export async function fetchFeed(value, options = {}) {
  const fetchImpl = options.fetch ?? fetch
  const resolve = options.lookup ?? lookup
  let url = parseTargetUrl(value)
  const cacheKey = url.href
  const cached = cache.get(cacheKey)

  if (!options.fetch && cached && Date.now() - cached.at < CACHE_MS) {
    return cached.value
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    for (let redirects = 0; ; redirects += 1) {
      await assertPublicHost(url, resolve)

      const response = await fetchImpl(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept:
            'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.5, */*;q=0.3',
        },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')

        if (!location || redirects >= MAX_REDIRECTS) {
          throw new FeedProxyError('Too many or invalid redirects')
        }

        url = parseTargetUrl(new URL(location, url).href)
        continue
      }

      if (!response.ok) {
        throw new FeedProxyError(
          `Feed server answered HTTP ${response.status}`,
          502,
        )
      }

      const value = {
        body: await readLimited(response),
        contentType:
          response.headers.get('content-type') ??
          'application/xml; charset=utf-8',
        finalUrl: url.href,
      }

      cache.set(cacheKey, { at: Date.now(), value })

      return value
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new FeedProxyError('Feed server did not respond in time', 504)
    }

    throw error
  } finally {
    clearTimeout(timer)
  }
}
