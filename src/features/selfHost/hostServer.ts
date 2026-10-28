import { DEFAULT_CHART_FEED_URL } from '../../contracts/chartNode'
import { DEFAULT_FEED_PROXY_URL } from '../../contracts/feedNode'

/**
 * A self-hosted Linkhaven server serves the web app itself and announces
 * its services in a `linkhaven-server` meta tag (server/webApp.mjs). The
 * app then uses that server for sync, news feeds and charts by default.
 */
export type HostServer = {
  /** e.g. https://links.example.com */
  origin: string
  sync: boolean
  newsProxy: boolean
  charts: boolean
}

export function readHostServer(
  doc: Document | undefined = typeof document === 'undefined'
    ? undefined
    : document,
  origin = doc?.location?.origin,
): HostServer | null {
  const content = doc
    ?.querySelector('meta[name="linkhaven-server"]')
    ?.getAttribute('content')

  if (!content || !origin || !/^https?:/.test(origin)) {
    return null
  }

  try {
    const services = JSON.parse(content) as Record<string, unknown>

    return {
      origin,
      sync: services.sync === true,
      newsProxy: services.newsProxy === true,
      charts: services.charts === true,
    }
  } catch {
    return null
  }
}

let cached: HostServer | null | undefined

export function getHostServer() {
  if (cached === undefined) {
    cached = readHostServer()
  }

  return cached
}

/** The feed proxy a new news feed starts with. */
export function defaultFeedProxyUrl(host = getHostServer()) {
  return host?.newsProxy ? `${host.origin}/rss` : DEFAULT_FEED_PROXY_URL
}

/** The chart feed a new chart starts with. */
export function defaultChartFeedUrl(host = getHostServer()) {
  return host?.charts
    ? `${host.origin.replace(/^http/, 'ws')}/feed`
    : DEFAULT_CHART_FEED_URL
}
