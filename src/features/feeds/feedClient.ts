import type { FeedSource } from '../../contracts/feedNode'

import { FeedParseError, parseFeed, type ParsedFeed } from './feedParser'

export type FeedSourceResult =
  | { status: 'ok'; url: string; feed: ParsedFeed; fetchedAt: number }
  | {
      status: 'error'
      url: string
      message: string
      fetchedAt: number
    }

const FETCH_TIMEOUT_MS = 20000
/** Nodes showing the same feed share one response for this long. */
const SHARED_CACHE_MS = 60000

const cache = new Map<
  string,
  { at: number; promise: Promise<FeedSourceResult> }
>()

/** `proxy?url=<feed>`; an empty proxy fetches the feed directly. */
export function buildFeedRequestUrl(feedUrl: string, proxyUrl: string): string {
  const proxy = proxyUrl.trim()

  if (!proxy) {
    return feedUrl
  }

  const url = new URL(proxy)

  url.searchParams.set('url', feedUrl)

  return url.href
}

/** Charset from the Content-Type header, else the XML declaration. */
export function decodeFeedBody(
  buffer: ArrayBuffer,
  contentType: string,
): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1]
  const head = new TextDecoder('ascii').decode(buffer.slice(0, 200))
  const fromXml = /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(head)?.[1]

  for (const label of [fromHeader, fromXml, 'utf-8']) {
    if (!label) {
      continue
    }

    try {
      return new TextDecoder(label).decode(buffer)
    } catch {
      // Unknown label: try the next one.
    }
  }

  return new TextDecoder().decode(buffer)
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }

    if (typeof body.error === 'string' && body.error) {
      return body.error
    }
  } catch {
    // Not JSON: fall through.
  }

  return `HTTP ${response.status}`
}

class FeedHttpError extends Error {}

async function requestFeed(
  url: string,
  proxyUrl: string,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(buildFeedRequestUrl(url, proxyUrl), {
    signal,
    headers: {
      accept:
        'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5',
    },
  })

  if (!response.ok) {
    throw new FeedHttpError(await readError(response))
  }

  return decodeFeedBody(
    await response.arrayBuffer(),
    response.headers.get('content-type') ?? '',
  )
}

/**
 * A web page URL that links exactly to its feed is followed once; items
 * keep the URL the user entered as `sourceUrl` (used for source filters).
 */
async function loadParsedFeed(
  feedUrl: string,
  proxyUrl: string,
  signal: AbortSignal,
): Promise<ParsedFeed> {
  try {
    return parseFeed(await requestFeed(feedUrl, proxyUrl, signal), feedUrl)
  } catch (error) {
    const alternate =
      error instanceof FeedParseError ? error.alternates[0] : undefined

    if (!alternate) {
      throw error
    }

    const feed = parseFeed(
      await requestFeed(alternate, proxyUrl, signal),
      alternate,
    )

    return {
      ...feed,
      items: feed.items.map((item) => ({ ...item, sourceUrl: feedUrl })),
    }
  }
}

async function loadSource(
  feedUrl: string,
  proxyUrl: string,
): Promise<FeedSourceResult> {
  const fetchedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const feed = await loadParsedFeed(feedUrl, proxyUrl, controller.signal)

    return { status: 'ok', url: feedUrl, feed, fetchedAt }
  } catch (error) {
    const message =
      error instanceof FeedParseError || error instanceof FeedHttpError
        ? error.message
        : controller.signal.aborted
          ? 'The feed took too long to respond.'
          : proxyUrl.trim()
            ? `Feed proxy not reachable (${proxyUrl.trim()}). Start it with npm run feed:news.`
            : 'Blocked or unreachable. Most feeds need the feed proxy (CORS).'

    return {
      status: 'error',
      url: feedUrl,
      message,
      fetchedAt,
    }
  } finally {
    clearTimeout(timer)
  }
}

/** Loads one feed; `force` skips the shared cache (manual reload). */
export function fetchFeedSource(
  source: Pick<FeedSource, 'url'>,
  proxyUrl: string,
  options: { force?: boolean } = {},
): Promise<FeedSourceResult> {
  const key = `${proxyUrl.trim()}|${source.url}`
  const cached = cache.get(key)

  if (!options.force && cached && Date.now() - cached.at < SHARED_CACHE_MS) {
    return cached.promise
  }

  const promise = loadSource(source.url, proxyUrl)

  cache.set(key, { at: Date.now(), promise })

  return promise
}

export function clearFeedCache() {
  cache.clear()
}
