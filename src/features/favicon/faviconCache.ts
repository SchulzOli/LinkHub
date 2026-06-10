import { resolveSupportedImageUploadMimeType } from '../../contracts/imageAsset'
import { saveImageAsset } from '../../storage/imageRepository'

/**
 * Tries to fetch a favicon for the given domain.
 * Fallback chain:
 *   1. `https://<host>/favicon.ico`
 *   2. Google favicons service (unless `offlineOnly` is true)
 *
 * Returns the raw Blob on success, or `null` when all attempts fail.
 *
 * The optional `fetchFn` parameter allows test injection of a mock fetch
 * implementation. Defaults to `globalThis.fetch`.
 */
export async function fetchFaviconBlob(
  hostname: string,
  offlineOnly: boolean,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<Blob | null> {
  // Attempt 1: host's own /favicon.ico
  const hostResult = await tryFetchFavicon(
    `https://${hostname}/favicon.ico`,
    fetchFn,
  )
  if (hostResult) {
    return hostResult
  }

  // Attempt 2: Google service — only when offline-only is NOT active
  if (!offlineOnly) {
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

/**
 * Stores a fetched favicon blob as an image asset in IndexedDB.
 * Returns the new image asset ID on success, or `null` on failure.
 */
export async function storeFaviconAsImageAsset(
  hostname: string,
  blob: Blob,
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
      name: `Favicon (${hostname})`,
    })

    return asset.id
  } catch {
    return null
  }
}

/**
 * Generates a placeholder initial-chip character from a URL / title / hostname.
 */
export function getFaviconPlaceholderLetter(input: string): string {
  const trimmed = input.trim()

  if (!trimmed) {
    return '?'
  }

  // Try to extract the first letter of the hostname (excluding www)
  try {
    const url = new URL(
      trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
    )
    const cleanHost = url.hostname.replace(/^www\./, '')
    return cleanHost.charAt(0).toUpperCase()
  } catch {
    // Fall back to first character of the input
    return trimmed.charAt(0).toUpperCase()
  }
}

/**
 * Creates a data-URI for a simple coloured circle with the initial letter.
 * Used as ultimate fallback when no favicon can be loaded.
 */
export function createPlaceholderDataUrl(letter: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return ''
  }

  // Draw a coloured circle
  ctx.beginPath()
  ctx.arc(64, 64, 64, 0, Math.PI * 2)
  ctx.fillStyle = '#64748b'
  ctx.fill()

  // Draw the letter
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 48px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letter, 64, 64)

  return canvas.toDataURL('image/png', 0.9)
}
