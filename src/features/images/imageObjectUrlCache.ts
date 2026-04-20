import {
  getImageBlob,
  getImageThumbnailBlob,
} from '../../storage/imageRepository'

export type ImageObjectUrlVariant = 'thumbnail' | 'full'

type ImageObjectUrlCacheEntry = {
  promise: Promise<string | null>
  refCount: number
  url: string | null
}

// Modul-Scope-Cache. Mehrere Nodes, die dasselbe `imageId` referenzieren
// (z. B. Card-Favicon-Override + Picture-Node + Gallery-Dialog), teilen
// sich eine einzige `URL.createObjectURL`-Instanz und einen einzigen
// IDB-Read pro Variante. Thumbnail- und Full-Variante werden separat
// gehalten, damit ein Gallery-Detail-View nicht ungewollt den
// Render-Pfad der Canvas-Nodes belastet.
const cache = new Map<string, ImageObjectUrlCacheEntry>()

function cacheKey(imageId: string, variant: ImageObjectUrlVariant) {
  return `${variant}:${imageId}`
}

function canCreateObjectUrl() {
  return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
}

function revokeObjectUrl(url: string) {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url)
  }
}

async function fetchVariantBlob(
  imageId: string,
  variant: ImageObjectUrlVariant,
) {
  if (variant === 'full') {
    return getImageBlob(imageId)
  }

  // Thumbnail-Variante: erst Thumbnail-Blob (inkl. Lazy-Backfill) probieren;
  // wenn keines existiert oder erzeugt werden kann, auf Full-Blob zurueckfallen.
  const thumbnail = await getImageThumbnailBlob(imageId)
  if (thumbnail) {
    return thumbnail
  }
  return getImageBlob(imageId)
}

function createEntry(
  imageId: string,
  variant: ImageObjectUrlVariant,
): ImageObjectUrlCacheEntry {
  const entry: ImageObjectUrlCacheEntry = {
    promise: Promise.resolve(null),
    refCount: 0,
    url: null,
  }

  const key = cacheKey(imageId, variant)

  entry.promise = (async () => {
    try {
      const blob = await fetchVariantBlob(imageId, variant)

      if (!blob || !canCreateObjectUrl()) {
        return null
      }

      // Waehrend des awaits kann der Eintrag invalidiert worden sein
      // (z. B. Image wurde geloescht). Keinen Object-URL erzeugen,
      // damit nichts geleakt wird.
      if (cache.get(key) !== entry) {
        return null
      }

      const url = URL.createObjectURL(blob)
      entry.url = url
      return url
    } catch {
      return null
    }
  })()

  return entry
}

export function acquireImageObjectUrl(
  imageId: string,
  variant: ImageObjectUrlVariant = 'thumbnail',
): Promise<string | null> {
  const key = cacheKey(imageId, variant)
  let entry = cache.get(key)

  if (!entry) {
    entry = createEntry(imageId, variant)
    cache.set(key, entry)
  }

  entry.refCount += 1
  return entry.promise
}

export function releaseImageObjectUrl(
  imageId: string,
  variant: ImageObjectUrlVariant = 'thumbnail',
) {
  const key = cacheKey(imageId, variant)
  const entry = cache.get(key)

  if (!entry) {
    return
  }

  entry.refCount = Math.max(0, entry.refCount - 1)

  if (entry.refCount === 0) {
    if (entry.url) {
      revokeObjectUrl(entry.url)
    }
    cache.delete(key)
  }
}

/**
 * Invalidiert beide Varianten (Thumbnail + Full) eines Bildes. Wird beim
 * Loeschen eines Assets aufgerufen, damit bestehende Object-URLs nicht
 * auf mittlerweile geloeschte Blobs zeigen.
 */
export function invalidateImageObjectUrl(imageId: string) {
  for (const variant of ['thumbnail', 'full'] as const) {
    const key = cacheKey(imageId, variant)
    const entry = cache.get(key)

    if (!entry) {
      continue
    }

    if (entry.url) {
      revokeObjectUrl(entry.url)
    }
    cache.delete(key)
  }
}
