/**
 * Turns raw "the user opened X" signals into a ranked, de-duplicated and
 * filtered list of dashboard candidates. Pure functions, no browser APIs.
 */

export type AutoSignalSource = 'linkhub' | 'topSites' | 'history' | 'pinned'

export type AutoSignal = {
  url: string
  title: string
  count: number
  /** ms since epoch; 0 = unknown. */
  lastVisitTime: number
  source: AutoSignalSource
}

export type AutoCandidate = {
  /** Stable for one build: the normalized URL key. */
  id: string
  url: string
  title: string
  /** Host without a leading `www.`. */
  host: string
  score: number
  visitCount: number
  lastVisitTime: number
  sources: AutoSignalSource[]
  pinned: boolean
}

const DAY_MS = 24 * 3600 * 1000
const RECENCY_HALF_LIFE_DAYS = 14
const UNKNOWN_RECENCY = 0.5

const SOURCE_WEIGHTS: Record<AutoSignalSource, number> = {
  // A click on a LinkHub card is a deliberate choice; weigh it higher.
  linkhub: 1.5,
  history: 1,
  topSites: 1,
  pinned: 0,
}

const TRACKING_PARAMS =
  /^(utm_|fbclid$|gclid$|dclid$|msclkid$|mc_|igshid$|ref_src$)/i

const SEARCH_PAGES: Array<{ host: RegExp; path: RegExp; query?: string }> = [
  { host: /(^|\.)google\.[a-z.]+$/, path: /^\/(search|webhp|url)\b/ },
  { host: /(^|\.)bing\.com$/, path: /^\/search\b/ },
  { host: /(^|\.)duckduckgo\.com$/, path: /^\/$/, query: 'q' },
  { host: /(^|\.)search\.yahoo\.com$/, path: /^\/search\b/ },
  { host: /(^|\.)ecosia\.org$/, path: /^\/search\b/ },
  { host: /(^|\.)startpage\.com$/, path: /^\/(do|sp)\/search\b/ },
  { host: /(^|\.)yandex\.[a-z.]+$/, path: /^\/search\b/ },
  { host: /(^|\.)baidu\.com$/, path: /^\/s\b/ },
]

const AUTH_HOSTS =
  /(^|\.)(accounts\.google\.com|login\.microsoftonline\.com|login\.live\.com|appleid\.apple\.com|auth0\.com|okta\.com|id\.atlassian\.com)$/

const AUTH_PATH =
  /(^|\/)(login|log-in|logout|signin|sign-in|signout|signup|sign-up|oauth2?|auth|sso|saml|callback|2fa|mfa|verify|reset-password)(\/|$|\?|\.)/i

// Banking and payment pages rarely belong on a dashboard and are private.
// The user can exclude more sites in the settings.
const SENSITIVE_HOSTS =
  /(^|\.)(paypal\.com|sparkasse\.de|comdirect\.de|ing\.de|dkb\.de|n26\.com|revolut\.com|consorsbank\.de|postbank\.de|commerzbank\.de|deutsche-bank\.de|volksbank\.de|chase\.com|bankofamerica\.com|wellsfargo\.com)$|bank/

function isPrivateHost(host: string) {
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '[::1]' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^0\.0\.0\.0$/.test(host)
  )
}

function stripWww(host: string) {
  return host.replace(/^www\./, '')
}

/** http(s) URL without hash and tracking parameters, or null. */
export function cleanCandidateUrl(input: string): URL | null {
  let url: URL

  try {
    url = new URL(input.trim())
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }

  url.hash = ''
  url.username = ''
  url.password = ''

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) {
      url.searchParams.delete(key)
    }
  }

  return url
}

/** Same page → same key, whatever `www.`, trailing slash or scheme. */
export function getCandidateKey(url: URL) {
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const search = url.searchParams.toString()

  return `${stripWww(url.hostname.toLowerCase())}${path}${search ? `?${search}` : ''}`
}

function matchesUserEntry(url: URL, entry: string) {
  const value = entry.trim().toLowerCase()

  if (!value) {
    return false
  }

  const host = stripWww(url.hostname.toLowerCase())

  // A bare host matches the host and its subdomains.
  if (!value.includes('/') && !value.includes(':')) {
    const entryHost = stripWww(value)

    return host === entryHost || host.endsWith(`.${entryHost}`)
  }

  const entryUrl = cleanCandidateUrl(
    /^[a-z][a-z\d+.-]*:/.test(value) ? value : `https://${value}`,
  )

  return entryUrl
    ? getCandidateKey(url).startsWith(getCandidateKey(entryUrl))
    : false
}

/** Pages that never belong on the dashboard (or that the user excluded). */
export function isExcludedUrl(url: URL, excludedSites: string[] = []) {
  const host = url.hostname.toLowerCase()
  const path = url.pathname

  if (
    isPrivateHost(host) ||
    AUTH_HOSTS.test(host) ||
    SENSITIVE_HOSTS.test(host)
  ) {
    return true
  }

  if (AUTH_PATH.test(path)) {
    return true
  }

  if (
    SEARCH_PAGES.some(
      (page) =>
        page.host.test(host) &&
        page.path.test(path) &&
        (!page.query || url.searchParams.has(page.query)),
    )
  ) {
    return true
  }

  return excludedSites.some((entry) => matchesUserEntry(url, entry))
}

export function getRecencyFactor(lastVisitTime: number, now: number) {
  if (!lastVisitTime) {
    return UNKNOWN_RECENCY
  }

  const ageDays = Math.max(0, (now - lastVisitTime) / DAY_MS)

  return Math.max(0.05, 0.5 ** (ageDays / RECENCY_HALF_LIFE_DAYS))
}

/**
 * Frequency × recency ("frecency"): a page opened often but not for weeks
 * slowly drops below one opened a little less but every day.
 */
export function scoreSignal(signal: AutoSignal, now: number) {
  return (
    SOURCE_WEIGHTS[signal.source] *
    Math.max(0, signal.count) *
    getRecencyFactor(signal.lastVisitTime, now)
  )
}

function pickTitle(current: string, next: string) {
  const a = current.trim()
  const b = next.trim()

  if (!a) {
    return b
  }

  if (!b) {
    return a
  }

  // Prefer the more descriptive (but not absurdly long) title.
  return b.length > a.length && b.length <= 90 ? b : a
}

export function buildAutoCandidates(input: {
  signals: AutoSignal[]
  pinnedUrls?: string[]
  excludedSites?: string[]
  maxPerSite: number
  now?: number
}): AutoCandidate[] {
  const now = input.now ?? Date.now()
  const byKey = new Map<string, AutoCandidate>()
  const pinnedSignals: AutoSignal[] = (input.pinnedUrls ?? []).map((url) => ({
    url: /^[a-z][a-z\d+.-]*:/i.test(url) ? url : `https://${url}`,
    title: '',
    count: 0,
    lastVisitTime: 0,
    source: 'pinned',
  }))

  for (const signal of [...pinnedSignals, ...input.signals]) {
    const url = cleanCandidateUrl(signal.url)

    if (!url) {
      continue
    }

    const pinned = signal.source === 'pinned'

    if (!pinned && isExcludedUrl(url, input.excludedSites)) {
      continue
    }

    const key = getCandidateKey(url)
    const existing = byKey.get(key)
    const score = scoreSignal(signal, now)

    if (!existing) {
      byKey.set(key, {
        id: key,
        url: url.toString(),
        title: signal.title.trim(),
        host: stripWww(url.hostname.toLowerCase()),
        score,
        visitCount: signal.count,
        lastVisitTime: signal.lastVisitTime,
        sources: [signal.source],
        pinned,
      })
      continue
    }

    existing.score += score
    existing.visitCount += signal.count
    existing.lastVisitTime = Math.max(
      existing.lastVisitTime,
      signal.lastVisitTime,
    )
    existing.title = pickTitle(existing.title, signal.title)
    existing.pinned ||= pinned

    if (!existing.sources.includes(signal.source)) {
      existing.sources.push(signal.source)
    }
  }

  const ranked = [...byKey.values()]
    .filter((candidate) => candidate.pinned || candidate.score > 0)
    .sort(
      (left, right) =>
        Number(right.pinned) - Number(left.pinned) ||
        right.score - left.score ||
        left.id.localeCompare(right.id),
    )
  const perSite = new Map<string, number>()

  return ranked.filter((candidate) => {
    if (candidate.pinned) {
      return true
    }

    const used = perSite.get(candidate.host) ?? 0

    if (used >= input.maxPerSite) {
      return false
    }

    perSite.set(candidate.host, used + 1)

    return true
  })
}
