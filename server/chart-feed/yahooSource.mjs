/**
 * Market data source for the chart feed: Yahoo Finance's public chart API
 * (no API key). Called server-side, so browser CORS rules do not apply.
 */

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/'
const USER_AGENT = 'Mozilla/5.0 (LinkHub chart feed)'
const DAY_SECONDS = 86400

/** Range → Yahoo query. 3Y has no Yahoo range keyword, so it uses periods. */
const RANGE_QUERIES = {
  '1D': { range: '1d', interval: '5m' },
  '5D': { range: '5d', interval: '15m' },
  '1M': { range: '1mo', interval: '90m' },
  '6M': { range: '6mo', interval: '1d' },
  YTD: { range: 'ytd', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
  '3Y': { years: 3, interval: '1wk' },
  '5Y': { range: '5y', interval: '1wk' },
  MAX: { range: 'max', interval: '1mo' },
}

export const SUPPORTED_RANGES = Object.keys(RANGE_QUERIES)

const SYMBOL_PATTERN = /^[A-Za-z0-9.^=\-]{1,32}$/

export function isValidSymbol(symbol) {
  return typeof symbol === 'string' && SYMBOL_PATTERN.test(symbol)
}

export function buildYahooUrl(symbol, range, nowSeconds = Date.now() / 1000) {
  const query = RANGE_QUERIES[range]

  if (!query) {
    throw new Error(`Unsupported range ${range}`)
  }

  const url = new URL(encodeURIComponent(symbol), YAHOO_CHART_URL)

  url.searchParams.set('interval', query.interval)
  url.searchParams.set('includePrePost', 'false')

  if (query.years) {
    const period2 = Math.floor(nowSeconds)

    url.searchParams.set(
      'period1',
      String(period2 - Math.round(query.years * 365.25 * DAY_SECONDS)),
    )
    url.searchParams.set('period2', String(period2))
  } else {
    url.searchParams.set('range', query.range)
  }

  return url
}

/** Converts a Yahoo chart payload into feed points `[ms, close]`. */
export function parseYahooChart(payload) {
  const error = payload?.chart?.error

  if (error) {
    throw new Error(error.description || error.code || 'Upstream error')
  }

  const result = payload?.chart?.result?.[0]

  if (!result) {
    throw new Error('No data for this symbol')
  }

  const timestamps = result.timestamp ?? []
  const closes = result.indicators?.quote?.[0]?.close ?? []
  const points = []

  for (let index = 0; index < timestamps.length; index += 1) {
    const value = closes[index]

    if (typeof value === 'number' && Number.isFinite(value)) {
      points.push([timestamps[index] * 1000, value])
    }
  }

  const meta = result.meta ?? {}
  const price = meta.regularMarketPrice
  const time = meta.regularMarketTime

  return {
    points,
    currency: typeof meta.currency === 'string' ? meta.currency : undefined,
    name: meta.longName || meta.shortName || undefined,
    latest:
      typeof price === 'number' && typeof time === 'number'
        ? [time * 1000, price]
        : points[points.length - 1],
  }
}

export async function fetchSeries(symbol, range, fetchImpl = fetch) {
  const response = await fetchImpl(buildYahooUrl(symbol, range), {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
  })
  const payload = await response.json().catch(() => null)

  if (!payload) {
    throw new Error(`Upstream responded with ${response.status}`)
  }

  return parseYahooChart(payload)
}
