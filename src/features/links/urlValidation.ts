import type { FaviconSources } from '../../contracts/networkFeatures'

export function normalizeUrl(input: string) {
  const value = input.trim()

  if (!value) {
    return null
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)
    ? value
    : `https://${value}`

  try {
    const url = new URL(candidate)

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

export function createFaviconUrl(urlString: string) {
  const url = new URL(urlString)
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=128`
}

const GOOGLE_FAVICON_PREFIX = 'https://www.google.com/s2/favicons'

/**
 * Addresses only your own network knows: IPs, localhost, .local/.lan/…,
 * single-label names. Google can't see them and only answers with its
 * placeholder globe, so it isn't asked for them.
 */
export function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')

  return (
    !host.includes('.') ||
    host.includes(':') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    /\.(local|lan|home|internal|intranet|localdomain|home\.arpa|ts\.net|box|fritz\.box)$/.test(
      host,
    )
  )
}

function hasPrivateHost(url: string) {
  try {
    return isPrivateHost(new URL(url).hostname)
  } catch {
    return false
  }
}

/**
 * The favicon URL a card may load. Cards store Google's favicon URL; it is
 * used only while Google is allowed, else the site's own /favicon.ico while
 * the site is allowed, else nothing (the card shows its letter). Local
 * `data:` and `blob:` images never touch the network and always load.
 */
export function resolveCardFaviconUrl(
  card: { url: string; faviconUrl: string },
  sources: FaviconSources,
) {
  const { faviconUrl } = card

  if (/^(data|blob):/.test(faviconUrl)) {
    return faviconUrl
  }

  if (
    faviconUrl.startsWith(GOOGLE_FAVICON_PREFIX) &&
    sources.google &&
    !hasPrivateHost(card.url)
  ) {
    return faviconUrl
  }

  if (!sources.site) {
    return ''
  }

  if (!faviconUrl.startsWith(GOOGLE_FAVICON_PREFIX)) {
    return faviconUrl
  }

  try {
    return `${new URL(card.url).origin}/favicon.ico`
  } catch {
    return ''
  }
}
