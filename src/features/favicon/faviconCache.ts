import { resolveSupportedImageUploadMimeType } from '../../contracts/imageAsset'
import type { FaviconSources } from '../../contracts/networkFeatures'
import { saveImageAsset } from '../../storage/imageRepository'
import { fetchAppIconBlob } from '../appIcons/appIcons'
import { isPrivateHost } from '../links/urlValidation'

/**
 * Tries to fetch a favicon for the given domain.
 * Fallback chain, each step only when its source is allowed:
 *   1. `https://<host>/favicon.ico` (`site`)
 *   2. Google favicons service (`google`)
 *
 * `sources` may be a function: it is then asked right before each request,
 * so switching a source off while an earlier request is pending is
 * honoured. With neither source allowed nothing is requested.
 *
 * Returns the raw Blob on success, or `null` when all attempts fail.
 *
 * The optional `fetchFn` parameter allows test injection of a mock fetch
 * implementation. Defaults to `globalThis.fetch`.
 */
export async function fetchFaviconBlob(
  hostname: string,
  sources: FaviconSources | (() => FaviconSources),
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<Blob | null> {
  const current = () => (typeof sources === 'function' ? sources() : sources)

  if (current().site) {
    const hostResult = await tryFetchFavicon(
      `https://${hostname}/favicon.ico`,
      fetchFn,
    )

    if (hostResult) {
      return hostResult
    }
  }

  // Google only knows public sites; for the rest it sends a placeholder.
  if (current().google && !isPrivateHost(hostname)) {
    const googleResult = await tryFetchFavicon(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`,
      fetchFn,
    )

    if (googleResult) {
      return googleResult
    }
  }

  return null
}

/**
 * The icon for a new or changed card: a matching self-hosted app icon
 * first (when allowed), else the site's favicon chain above.
 */
export async function fetchCardIcon(
  card: { url: string; title: string; localUrl?: string },
  sources: FaviconSources | (() => FaviconSources),
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<{ blob: Blob; label: string; kind: FetchedIconKind } | null> {
  const current = () => (typeof sources === 'function' ? sources() : sources)
  let hostname: string

  try {
    hostname = new URL(card.url).hostname
  } catch {
    return null
  }

  if (current().apps) {
    const appIcon = await fetchAppIconBlob(card, fetchFn)

    if (appIcon) {
      return { blob: appIcon.blob, label: appIcon.icon.name, kind: 'app' }
    }
  }

  const blob = await fetchFaviconBlob(hostname, current, fetchFn)

  return blob ? { blob, label: hostname, kind: 'favicon' } : null
}

async function tryFetchFavicon(
  url: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<Blob | null> {
  try {
    const response = await fetchFn(url, {
      cache: 'force-cache',
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return null
    }

    const blob = await response.blob()

    // Discard empty responses or tiny 1×1 placeholder images
    if (!blob || blob.size < 100) {
      return null
    }

    return blob
  } catch {
    return null
  }
}

/**
 * Valid mime types that the image repository can store.
 * Favicon sources often return unusual types – we map them here.
 */
const FAVICON_MIME_MAP: Record<string, string> = {
  'image/x-icon': 'image/png',
  'image/vnd.microsoft.icon': 'image/png',
  'image/ico': 'image/png',
  'image/x-imageico': 'image/png',
}

function normalizeFaviconMimeType(mimeType: string): string {
  return FAVICON_MIME_MAP[mimeType.toLowerCase()] ?? mimeType
}

function deriveFaviconFilename(hostname: string, blob: Blob): string {
  const normalizedMime = normalizeFaviconMimeType(blob.type)
  const extension =
    normalizedMime === 'image/png'
      ? 'png'
      : normalizedMime === 'image/jpeg'
        ? 'jpg'
        : normalizedMime === 'image/webp'
          ? 'webp'
          : normalizedMime === 'image/svg+xml'
            ? 'svg'
            : 'png'
  return `favicon-${hostname}.${extension}`
}

/** Icons Linkhaven fetched itself; they show as icons, not as photos. */
export type FetchedIconKind = 'favicon' | 'app'

const FETCHED_ICON_NAME = /^(Favicon|App icon) \(/

export function isFetchedIconName(name: string) {
  return FETCHED_ICON_NAME.test(name)
}

/**
 * Stores a fetched favicon blob as an image asset in IndexedDB.
 * Returns the new image asset ID on success, or `null` on failure.
 */
export async function storeFaviconAsImageAsset(
  hostname: string,
  blob: Blob,
  kind: FetchedIconKind = 'favicon',
): Promise<string | null> {
  try {
    const normalizedMime = normalizeFaviconMimeType(blob.type)
    const resolvedMimeType = resolveSupportedImageUploadMimeType({
      mimeType: normalizedMime,
    })
    const effectiveMimeType = resolvedMimeType ?? 'image/png'
    const filename = deriveFaviconFilename(hostname, blob)

    // Wrap the blob into a File so we can use saveImageAsset
    const file = new File([blob], filename, { type: effectiveMimeType })

    const asset = await saveImageAsset({
      file,
      name: `${kind === 'app' ? 'App icon' : 'Favicon'} (${hostname})`,
    })

    return asset.id
  } catch {
    return null
  }
}

function readHostname(input: string) {
  const trimmed = input.trim()

  try {
    return new URL(
      /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`,
    ).hostname.replace(/^www\./, '')
  } catch {
    return trimmed.toLowerCase()
  }
}

/** A stable hue per site, so different sites get different colours. */
function hueForHostname(hostname: string) {
  let hash = 2166136261

  for (const char of hostname) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0) % 360
}

/**
 * The picture a link card shows until it has an icon: a globe on a tile
 * coloured from the site's name. Drawn here, so it never loads anything.
 */
export function createDefaultLinkImageDataUrl(url: string): string {
  const hue = hueForHostname(readHostname(url))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 46% 58%)"/><stop offset="1" stop-color="hsl(${(hue + 38) % 360} 44% 42%)"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><g fill="none" stroke="#fff" stroke-opacity=".92" stroke-width="2.6" stroke-linecap="round"><circle cx="32" cy="32" r="16"/><ellipse cx="32" cy="32" rx="6.8" ry="16"/><path d="M16.5 27.5h31M16.5 36.5h31"/></g></svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
