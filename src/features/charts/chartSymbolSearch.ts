import {
  parseChartSymbolSuggestions,
  type ChartSymbolSuggestion,
} from './chartFeedProtocol'

/**
 * Feed servers may offer `GET /search?q=` on the same host (the reference
 * server does). Derives it from the feed URL: ws(s) → http(s).
 */
export function getChartSearchUrl(feedUrl: string, query: string) {
  let url: URL

  try {
    url = new URL(feedUrl)
  } catch {
    return null
  }

  if (url.protocol === 'ws:') {
    url.protocol = 'http:'
  } else if (url.protocol === 'wss:') {
    url.protocol = 'https:'
  } else if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }

  url.pathname = '/search'
  url.search = ''
  url.hash = ''
  url.searchParams.set('q', query)

  return url.toString()
}

/** Resolves listings for a query; empty when the feed has no search. */
export async function searchChartSymbols(
  feedUrl: string,
  query: string,
  signal?: AbortSignal,
): Promise<ChartSymbolSuggestion[]> {
  const url = getChartSearchUrl(feedUrl, query.trim())

  if (!url || !query.trim()) {
    return []
  }

  const response = await fetch(url, { signal })

  if (!response.ok) {
    return []
  }

  const payload = (await response.json().catch(() => null)) as {
    results?: unknown
  } | null

  return parseChartSymbolSuggestions(payload?.results)
}
