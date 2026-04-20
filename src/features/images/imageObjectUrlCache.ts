import { getImageBlob } from '../../storage/imageRepository'

type ImageObjectUrlCacheEntry = {
  promise: Promise<string | null>
  refCount: number
  url: string | null
}

// Modul-Scope-Cache. Mehrere Nodes, die dasselbe `imageId` referenzieren
// (z. B. Card-Favicon-Override + Picture-Node + Gallery-Dialog), teilen
// sich eine einzige `URL.createObjectURL`-Instanz und einen einzigen
// IDB-Read. Einträge werden erst revoked, wenn der letzte Consumer den
// RefCount auf 0 senkt.
const cache = new Map<string, ImageObjectUrlCacheEntry>()

function canCreateObjectUrl() {
  return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
}

function revokeObjectUrl(url: string) {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url)
  }
}

function createEntry(imageId: string): ImageObjectUrlCacheEntry {
  const entry: ImageObjectUrlCacheEntry = {
    promise: Promise.resolve(null),
    refCount: 0,
    url: null,
  }

  entry.promise = (async () => {
    try {
      const blob = await getImageBlob(imageId)

      if (!blob || !canCreateObjectUrl()) {
        return null
      }

      // Während des awaits kann der Eintrag invalidiert worden sein
      // (z. B. Image wurde gelöscht). Keinen Object-URL erzeugen,
      // damit nichts geleakt wird.
      if (cache.get(imageId) !== entry) {
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

export function acquireImageObjectUrl(imageId: string): Promise<string | null> {
  let entry = cache.get(imageId)

  if (!entry) {
    entry = createEntry(imageId)
    cache.set(imageId, entry)
  }

  entry.refCount += 1
  return entry.promise
}

export function releaseImageObjectUrl(imageId: string) {
  const entry = cache.get(imageId)

  if (!entry) {
    return
  }

  entry.refCount = Math.max(0, entry.refCount - 1)

  if (entry.refCount === 0) {
    if (entry.url) {
      revokeObjectUrl(entry.url)
    }
    cache.delete(imageId)
  }
}

export function invalidateImageObjectUrl(imageId: string) {
  const entry = cache.get(imageId)

  if (!entry) {
    return
  }

  if (entry.url) {
    revokeObjectUrl(entry.url)
  }
  cache.delete(imageId)
}
