export const IMAGE_THUMBNAIL_LONGEST_EDGE = 512
const THUMBNAIL_QUALITY = 0.82

// Animierte oder Vektor-Formate werden nicht verkleinert: Animation
// ginge verloren, SVG ist bereits klein und skaliert verlustfrei.
const SKIP_THUMBNAIL_MIME_TYPES = new Set<string>([
  'image/gif',
  'image/apng',
  'image/svg+xml',
])

// Ziel-MIME-Typ fuer den Thumbnail-Blob. PNG bleibt PNG (Alpha-Kanal
// erhalten); alle anderen werden als JPEG komprimiert.
function resolveThumbnailMimeType(sourceMimeType: string): string {
  if (sourceMimeType === 'image/png' || sourceMimeType === 'image/webp') {
    return sourceMimeType
  }
  return 'image/jpeg'
}

export type GeneratedImageThumbnail = {
  blob: Blob
  width: number
  height: number
  byteSize: number
  mimeType: string
}

function canGenerateThumbnails() {
  return (
    typeof document !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function' &&
    typeof HTMLCanvasElement !== 'undefined'
  )
}

function computeThumbnailSize(sourceWidth: number, sourceHeight: number) {
  const longestEdge = Math.max(sourceWidth, sourceHeight)

  if (longestEdge <= IMAGE_THUMBNAIL_LONGEST_EDGE) {
    return { width: sourceWidth, height: sourceHeight, wasResized: false }
  }

  const scale = IMAGE_THUMBNAIL_LONGEST_EDGE / longestEdge
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
    wasResized: true,
  }
}

async function decodeImageElement(blob: Blob) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()

    image.onload = () => {
      resolve(image)
    }
    image.onerror = () => {
      resolve(null)
    }
    image.src = objectUrl

    // Revoke nachdem Load/Error abgeschlossen ist. `decode()` w\u00fcrde
    // promise-freundlicher sein, ist aber nicht \u00fcberall verf\u00fcgbar.
    image.addEventListener('load', () => URL.revokeObjectURL(objectUrl), {
      once: true,
    })
    image.addEventListener('error', () => URL.revokeObjectURL(objectUrl), {
      once: true,
    })
  })
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, quality)
  })
}

/**
 * Erzeugt ein skaliertes JPEG/PNG/WebP-Thumbnail. Gibt `null` zur\u00fcck, wenn
 *
 * - das Source-Format nicht thumbnailbar ist (GIF, SVG),
 * - die Browser-Umgebung kein Canvas hat (jsdom-Tests, SSR),
 * - das Decoding fehlschl\u00e4gt oder
 * - das resultierende Thumbnail gr\u00f6sser als der Originalblob w\u00e4re.
 *
 * Consumer sollten in diesen F\u00e4llen auf den Full-Res-Blob zur\u00fcckfallen.
 */
export async function generateImageThumbnail(
  blob: Blob,
  sourceMimeType: string,
): Promise<GeneratedImageThumbnail | null> {
  if (SKIP_THUMBNAIL_MIME_TYPES.has(sourceMimeType)) {
    return null
  }
  if (!canGenerateThumbnails()) {
    return null
  }

  const image = await decodeImageElement(blob)

  if (!image) {
    return null
  }

  const naturalWidth = image.naturalWidth || 0
  const naturalHeight = image.naturalHeight || 0

  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return null
  }

  const { width, height } = computeThumbnailSize(naturalWidth, naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)

  const targetMimeType = resolveThumbnailMimeType(sourceMimeType)
  const thumbnailBlob = await canvasToBlob(
    canvas,
    targetMimeType,
    THUMBNAIL_QUALITY,
  )

  if (!thumbnailBlob) {
    return null
  }

  // Wenn das Thumbnail gr\u00f6sser als das Original w\u00e4re (z. B. bei bereits
  // stark komprimierten Quellen), sparen wir uns den Platz.
  if (thumbnailBlob.size >= blob.size) {
    return null
  }

  return {
    blob: thumbnailBlob,
    width,
    height,
    byteSize: thumbnailBlob.size,
    mimeType: targetMimeType,
  }
}
