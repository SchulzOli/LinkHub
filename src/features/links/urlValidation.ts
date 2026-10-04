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
 * The favicon URL a card may load. Cards store Google's favicon URL; with
 * "Favicons offline-only" on, that URL is replaced by the site's own
 * /favicon.ico so the Google service is never contacted.
 */
export function resolveCardFaviconUrl(
  card: { url: string; faviconUrl: string },
  offlineOnly: boolean,
) {
  if (!offlineOnly || !card.faviconUrl.startsWith(GOOGLE_FAVICON_PREFIX)) {
    return card.faviconUrl
  }

  try {
    return `${new URL(card.url).origin}/favicon.ico`
  } catch {
    return ''
  }
}
