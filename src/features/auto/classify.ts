/**
 * Decides whether a page is best shown as a link card, a news feed or a
 * price chart. Only well-known URL shapes are recognised, so a guess never
 * produces a feed or symbol that doesn't exist.
 */

export type AutoClassification =
  | { kind: 'link' }
  | { kind: 'feed'; feedUrl: string; label: string }
  | { kind: 'chart'; symbol: string }

/** Yahoo-style ticker, the format the chart feed server understands. */
export const CHART_SYMBOL_PATTERN = /^[A-Z0-9^][A-Z0-9.=^-]{0,14}$/

const RESERVED_GITHUB_OWNERS = new Set([
  'about',
  'apps',
  'collections',
  'enterprise',
  'events',
  'explore',
  'features',
  'issues',
  'login',
  'marketplace',
  'new',
  'notifications',
  'orgs',
  'pricing',
  'pulls',
  'search',
  'settings',
  'sponsors',
  'topics',
  'trending',
])

/** Sites whose main feed lives at a fixed, public address. */
const KNOWN_SITE_FEEDS: Record<string, { feedUrl: string; label: string }> = {
  'news.ycombinator.com': {
    feedUrl: 'https://news.ycombinator.com/rss',
    label: 'Hacker News',
  },
  'heise.de': {
    feedUrl: 'https://www.heise.de/rss/heise-atom.xml',
    label: 'heise online',
  },
  'golem.de': {
    feedUrl: 'https://rss.golem.de/rss.php?feed=ATOM1.0',
    label: 'Golem',
  },
  'tagesschau.de': {
    feedUrl: 'https://www.tagesschau.de/index~rss2.xml',
    label: 'tagesschau',
  },
  'spiegel.de': {
    feedUrl: 'https://www.spiegel.de/schlagzeilen/index.rss',
    label: 'SPIEGEL',
  },
  'zeit.de': {
    feedUrl: 'https://newsfeed.zeit.de/index',
    label: 'ZEIT',
  },
  'theverge.com': {
    feedUrl: 'https://www.theverge.com/rss/index.xml',
    label: 'The Verge',
  },
  'arstechnica.com': {
    feedUrl: 'https://feeds.arstechnica.com/arstechnica/index',
    label: 'Ars Technica',
  },
  'bbc.com': {
    feedUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
    label: 'BBC News',
  },
  'bbc.co.uk': {
    feedUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
    label: 'BBC News',
  },
  'lobste.rs': { feedUrl: 'https://lobste.rs/rss', label: 'Lobsters' },
}

const TRADINGVIEW_EXCHANGE_SUFFIX: Record<string, string> = {
  NASDAQ: '',
  NYSE: '',
  AMEX: '',
  XETR: '.DE',
  FWB: '.F',
  LSE: '.L',
  EURONEXT: '.PA',
  SIX: '.SW',
  TSX: '.TO',
}

const GOOGLE_EXCHANGE_SUFFIX: Record<string, string> = {
  NASDAQ: '',
  NYSE: '',
  NYSEARCA: '',
  NYSEAMERICAN: '',
  ETR: '.DE',
  FRA: '.F',
  LON: '.L',
  EPA: '.PA',
  SWX: '.SW',
  TSE: '.TO',
}

function segments(url: URL) {
  return url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
}

function toSymbol(raw: string) {
  const symbol = raw.trim().toUpperCase()

  return CHART_SYMBOL_PATTERN.test(symbol) ? symbol : null
}

export function detectChartSymbol(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const parts = segments(url)

  // finance.yahoo.com/quote/AAPL, …/quote/SAP.DE/
  if (
    /(^|\.)finance\.yahoo\.com$/.test(host) &&
    parts[0] === 'quote' &&
    parts[1]
  ) {
    return toSymbol(parts[1])
  }

  // google.com/finance/quote/AAPL:NASDAQ
  if (
    /^google\.[a-z.]+$/.test(host) &&
    parts[0] === 'finance' &&
    parts[1] === 'quote' &&
    parts[2]
  ) {
    const [ticker, exchange = ''] = parts[2].split(':')
    const suffix = GOOGLE_EXCHANGE_SUFFIX[exchange.toUpperCase()]

    return suffix === undefined ? null : toSymbol(`${ticker}${suffix}`)
  }

  // tradingview.com/symbols/NASDAQ-AAPL/
  if (host === 'tradingview.com' && parts[0] === 'symbols' && parts[1]) {
    const dash = parts[1].indexOf('-')

    if (dash === -1) {
      return null
    }

    const exchange = parts[1].slice(0, dash).toUpperCase()
    const suffix = TRADINGVIEW_EXCHANGE_SUFFIX[exchange]

    return suffix === undefined
      ? null
      : toSymbol(`${parts[1].slice(dash + 1)}${suffix}`)
  }

  // marketwatch.com/investing/stock/aapl
  if (
    host === 'marketwatch.com' &&
    parts[0] === 'investing' &&
    parts[1] === 'stock' &&
    parts[2]
  ) {
    return toSymbol(parts[2])
  }

  // nasdaq.com/market-activity/stocks/aapl
  if (
    host === 'nasdaq.com' &&
    parts[0] === 'market-activity' &&
    parts[1] === 'stocks' &&
    parts[2]
  ) {
    return toSymbol(parts[2])
  }

  return null
}

export function detectFeed(
  url: URL,
): { feedUrl: string; label: string } | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const parts = segments(url)

  if (host === 'reddit.com' || host === 'old.reddit.com') {
    if (parts[0] === 'r' && parts[1] && /^\w{2,21}$/.test(parts[1])) {
      return {
        feedUrl: `https://www.reddit.com/r/${parts[1]}/.rss`,
        label: `r/${parts[1]}`,
      }
    }

    return null
  }

  if (host === 'youtube.com' && parts[0] === 'channel' && parts[1]) {
    return /^UC[\w-]{22}$/.test(parts[1])
      ? {
          feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${parts[1]}`,
          label: 'YouTube channel',
        }
      : null
  }

  if (host === 'github.com' && parts.length === 2) {
    const [owner, repo] = parts

    if (RESERVED_GITHUB_OWNERS.has(owner.toLowerCase())) {
      return null
    }

    return /^[\w.-]+$/.test(owner) && /^[\w.-]+$/.test(repo)
      ? {
          feedUrl: `https://github.com/${owner}/${repo}/releases.atom`,
          label: `${owner}/${repo} releases`,
        }
      : null
  }

  if (host === 'medium.com' && parts[0]?.startsWith('@')) {
    return {
      feedUrl: `https://medium.com/feed/${parts[0]}`,
      label: parts[0],
    }
  }

  if (host.endsWith('.substack.com')) {
    return {
      feedUrl: `https://${url.hostname}/feed`,
      label: host.replace(/\.substack\.com$/, ''),
    }
  }

  if (host === 'dev.to' && parts.length === 1 && /^[\w-]+$/.test(parts[0])) {
    return {
      feedUrl: `https://dev.to/feed/${parts[0]}`,
      label: `dev.to/${parts[0]}`,
    }
  }

  if (
    host === 'stackoverflow.com' &&
    parts[0] === 'questions' &&
    parts[1] === 'tagged' &&
    parts[2]
  ) {
    return {
      feedUrl: `https://stackoverflow.com/feeds/tag?tagnames=${encodeURIComponent(parts[2])}`,
      label: `Stack Overflow: ${parts[2]}`,
    }
  }

  // Only the site's front page stands for its main feed.
  if (parts.length === 0 && KNOWN_SITE_FEEDS[host]) {
    return KNOWN_SITE_FEEDS[host]
  }

  return null
}

export function classifyCandidateUrl(urlString: string): AutoClassification {
  let url: URL

  try {
    url = new URL(urlString)
  } catch {
    return { kind: 'link' }
  }

  const symbol = detectChartSymbol(url)

  if (symbol) {
    return { kind: 'chart', symbol }
  }

  const feed = detectFeed(url)

  if (feed) {
    return { kind: 'feed', ...feed }
  }

  return { kind: 'link' }
}
