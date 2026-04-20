import type { ImageAsset } from '../contracts/imageAsset'
import { resolveSupportedImageUploadMimeType } from '../contracts/imageAsset'
import {
  generateImageThumbnail,
  type GeneratedImageThumbnail,
} from '../features/images/imageThumbnail'
import { createId } from '../utils/id'
import { openLinkHubDb, STORAGE_STORES } from './db'

export type StoredImageAssetRecord = {
  asset: ImageAsset
  blob: Blob
  thumbnailBlob?: Blob | null
}

function deriveAssetName(file: File) {
  const trimmedName = file.name.trim()

  if (!trimmedName) {
    return 'Image'
  }

  const extensionIndex = trimmedName.lastIndexOf('.')

  return extensionIndex > 0
    ? trimmedName.slice(0, extensionIndex) || 'Image'
    : trimmedName
}

async function readImageDimensions(file: File) {
  if (typeof Image === 'undefined' || typeof URL === 'undefined') {
    return {
      width: undefined,
      height: undefined,
    }
  }

  return new Promise<Pick<ImageAsset, 'height' | 'width'>>((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl)
    }

    image.onload = () => {
      resolve({
        width: image.naturalWidth || undefined,
        height: image.naturalHeight || undefined,
      })
      cleanup()
    }

    image.onerror = () => {
      resolve({
        width: undefined,
        height: undefined,
      })
      cleanup()
    }

    image.src = objectUrl
  })
}

function normalizeImageUploadFile(file: File, mimeType: string) {
  if (file.type === mimeType) {
    return file
  }

  return new File([file], file.name, {
    lastModified: file.lastModified,
    type: mimeType,
  })
}

function normalizeStoredImageBlob(asset: ImageAsset, blob: Blob) {
  if (
    blob instanceof File &&
    blob.type === asset.mimeType &&
    blob.name === asset.originalFilename
  ) {
    return blob
  }

  return new File([blob], asset.originalFilename, {
    type: asset.mimeType,
  })
}

export async function saveImageAsset(input: {
  description?: string
  file: File
  name?: string
}) {
  const resolvedMimeType = resolveSupportedImageUploadMimeType({
    filename: input.file.name,
    mimeType: input.file.type,
  })

  if (!resolvedMimeType) {
    throw new Error('Only common browser image formats are supported.')
  }

  const normalizedFile = normalizeImageUploadFile(input.file, resolvedMimeType)

  const now = new Date().toISOString()
  const dimensions = await readImageDimensions(normalizedFile)
  const thumbnail = await generateImageThumbnail(
    normalizedFile,
    resolvedMimeType,
  )
  const asset: ImageAsset = {
    id: createId(),
    name: input.name?.trim() || deriveAssetName(normalizedFile),
    description: input.description?.trim() || undefined,
    originalFilename: normalizedFile.name,
    mimeType: resolvedMimeType,
    byteSize: normalizedFile.size,
    width: dimensions.width,
    height: dimensions.height,
    isAnimated:
      resolvedMimeType === 'image/gif' ||
      normalizedFile.name.toLowerCase().endsWith('.gif'),
    thumbnail: thumbnail
      ? {
          width: thumbnail.width,
          height: thumbnail.height,
          byteSize: thumbnail.byteSize,
          mimeType: thumbnail.mimeType,
        }
      : undefined,
    createdAt: now,
    updatedAt: now,
  }
  const db = await openLinkHubDb()
  const transaction = db.transaction(
    [
      STORAGE_STORES.imageAsset,
      STORAGE_STORES.imageBlob,
      STORAGE_STORES.imageThumbnailBlob,
    ],
    'readwrite',
  )

  await transaction.objectStore(STORAGE_STORES.imageAsset).put(asset, asset.id)
  await transaction
    .objectStore(STORAGE_STORES.imageBlob)
    .put(normalizedFile, asset.id)
  if (thumbnail) {
    await transaction
      .objectStore(STORAGE_STORES.imageThumbnailBlob)
      .put(thumbnail.blob, asset.id)
  }
  await transaction.done

  return asset
}

export async function listImageAssets() {
  const db = await openLinkHubDb()
  const assets = (await db.getAll(STORAGE_STORES.imageAsset)) as ImageAsset[]

  return [...assets].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )
}

export async function listStoredImageAssetRecords() {
  const assets = await listImageAssets()
  const blobs = await Promise.all(assets.map((asset) => getImageBlob(asset.id)))
  const missingBlobAsset = assets.find((_, index) => !blobs[index])

  if (missingBlobAsset) {
    throw new Error(
      `Image asset ${missingBlobAsset.id} is missing its stored blob.`,
    )
  }

  return assets.map((asset, index) => ({
    asset,
    blob: blobs[index] as Blob,
  }))
}

export async function getImageAsset(imageId: string) {
  const db = await openLinkHubDb()

  return (
    ((await db.get(STORAGE_STORES.imageAsset, imageId)) as
      | ImageAsset
      | undefined) ?? null
  )
}

export async function getImageBlob(imageId: string) {
  const db = await openLinkHubDb()

  return (
    ((await db.get(STORAGE_STORES.imageBlob, imageId)) as Blob | undefined) ??
    null
  )
}

async function readThumbnailBlobFromStore(imageId: string) {
  const db = await openLinkHubDb()
  return (
    ((await db.get(STORAGE_STORES.imageThumbnailBlob, imageId)) as
      | Blob
      | undefined) ?? null
  )
}

async function persistBackfilledThumbnail(
  imageId: string,
  asset: ImageAsset,
  generated: GeneratedImageThumbnail,
) {
  const db = await openLinkHubDb()
  const transaction = db.transaction(
    [STORAGE_STORES.imageAsset, STORAGE_STORES.imageThumbnailBlob],
    'readwrite',
  )

  // Asset kann zwischenzeitlich gel\u00f6scht oder ge\u00e4ndert worden sein;
  // in dem Fall verwerfen wir das Backfill-Ergebnis.
  const currentAsset = (await transaction
    .objectStore(STORAGE_STORES.imageAsset)
    .get(imageId)) as ImageAsset | undefined

  if (!currentAsset || currentAsset.updatedAt !== asset.updatedAt) {
    await transaction.done
    return
  }

  await transaction.objectStore(STORAGE_STORES.imageAsset).put(
    {
      ...currentAsset,
      thumbnail: {
        width: generated.width,
        height: generated.height,
        byteSize: generated.byteSize,
        mimeType: generated.mimeType,
      },
    } satisfies ImageAsset,
    imageId,
  )
  await transaction
    .objectStore(STORAGE_STORES.imageThumbnailBlob)
    .put(generated.blob, imageId)
  await transaction.done
}

/**
 * Liefert den gespeicherten Thumbnail-Blob. F\u00fcllt transparent Altbest\u00e4nde
 * nach (generiert Thumbnail + persistiert), wenn das Asset noch kein
 * Thumbnail hat. Gibt `null` zur\u00fcck, wenn weder Thumbnail existiert noch
 * eines erzeugt werden kann (z. B. GIF/SVG oder Umgebung ohne Canvas);
 * Consumer sollten dann auf `getImageBlob` zur\u00fcckfallen.
 */
export async function getImageThumbnailBlob(imageId: string) {
  const existing = await readThumbnailBlobFromStore(imageId)

  if (existing) {
    return existing
  }

  const asset = await getImageAsset(imageId)

  if (!asset) {
    return null
  }

  const fullBlob = await getImageBlob(imageId)

  if (!fullBlob) {
    return null
  }

  const generated = await generateImageThumbnail(fullBlob, asset.mimeType)

  if (!generated) {
    return null
  }

  try {
    await persistBackfilledThumbnail(imageId, asset, generated)
  } catch {
    // Backfill ist best-effort: Lesepfad liefert trotzdem den Thumb-Blob.
  }

  return generated.blob
}

export async function getStoredImageAssetRecord(imageId: string) {
  const [asset, blob, thumbnailBlob] = await Promise.all([
    getImageAsset(imageId),
    getImageBlob(imageId),
    readThumbnailBlobFromStore(imageId),
  ])

  if (!asset || !blob) {
    return null
  }

  return {
    asset,
    blob,
    thumbnailBlob: thumbnailBlob ?? undefined,
  } satisfies StoredImageAssetRecord
}

type ResolvedThumbnailPut =
  | { kind: 'keep' }
  | { kind: 'delete' }
  | {
      kind: 'write'
      blob: Blob
      metadata: NonNullable<ImageAsset['thumbnail']>
    }

async function resolveThumbnailForPut(
  input: StoredImageAssetRecord,
): Promise<ResolvedThumbnailPut> {
  // Expliziter Wunsch: Thumbnail entfernen.
  if (input.thumbnailBlob === null) {
    return { kind: 'delete' }
  }

  // Expliziter Blob mitgegeben: als Thumbnail \u00fcbernehmen. Metadaten m\u00fcssen
  // aus dem Asset stammen; fehlen sie, leiten wir sie bestm\u00f6glich her.
  if (input.thumbnailBlob) {
    const metadata = input.asset.thumbnail ?? {
      width: input.asset.width ?? 0,
      height: input.asset.height ?? 0,
      byteSize: input.thumbnailBlob.size,
      mimeType: input.thumbnailBlob.type || input.asset.mimeType,
    }

    if (metadata.width > 0 && metadata.height > 0) {
      return { kind: 'write', blob: input.thumbnailBlob, metadata }
    }
  }

  // Kein Thumbnail mitgegeben: versuchen, eines aus dem Full-Blob zu erzeugen.
  const generated = await generateImageThumbnail(
    input.blob,
    input.asset.mimeType,
  )

  if (generated) {
    return {
      kind: 'write',
      blob: generated.blob,
      metadata: {
        width: generated.width,
        height: generated.height,
        byteSize: generated.byteSize,
        mimeType: generated.mimeType,
      },
    }
  }

  // Thumbnail nicht erzeugbar (GIF/SVG/Canvas fehlt). Bestehenden Eintrag
  // belassen, damit Lazy-Backfill sp\u00e4ter erneut versuchen kann.
  return { kind: 'keep' }
}

export async function putStoredImageAssetRecord(input: StoredImageAssetRecord) {
  const resolvedThumbnail = await resolveThumbnailForPut(input)
  const assetToWrite: ImageAsset =
    resolvedThumbnail.kind === 'write'
      ? { ...input.asset, thumbnail: resolvedThumbnail.metadata }
      : resolvedThumbnail.kind === 'delete'
        ? { ...input.asset, thumbnail: undefined }
        : input.asset

  const db = await openLinkHubDb()
  const transaction = db.transaction(
    [
      STORAGE_STORES.imageAsset,
      STORAGE_STORES.imageBlob,
      STORAGE_STORES.imageThumbnailBlob,
    ],
    'readwrite',
  )

  await transaction
    .objectStore(STORAGE_STORES.imageAsset)
    .put(assetToWrite, assetToWrite.id)
  await transaction
    .objectStore(STORAGE_STORES.imageBlob)
    .put(normalizeStoredImageBlob(assetToWrite, input.blob), assetToWrite.id)

  if (resolvedThumbnail.kind === 'write') {
    await transaction
      .objectStore(STORAGE_STORES.imageThumbnailBlob)
      .put(resolvedThumbnail.blob, assetToWrite.id)
  } else if (resolvedThumbnail.kind === 'delete') {
    await transaction
      .objectStore(STORAGE_STORES.imageThumbnailBlob)
      .delete(assetToWrite.id)
  }

  await transaction.done
}

export async function updateImageAsset(
  imageId: string,
  updates: {
    description?: string
    name?: string
  },
) {
  const storedRecord = await getStoredImageAssetRecord(imageId)

  if (!storedRecord) {
    throw new Error('Image asset not found.')
  }

  const nextName =
    updates.name === undefined ? storedRecord.asset.name : updates.name.trim()
  const nextDescription =
    updates.description === undefined
      ? storedRecord.asset.description
      : updates.description.trim() || undefined

  if (!nextName) {
    throw new Error('Image title cannot be empty.')
  }

  if (
    nextName === storedRecord.asset.name &&
    nextDescription === storedRecord.asset.description
  ) {
    return storedRecord.asset
  }

  const asset: ImageAsset = {
    ...storedRecord.asset,
    name: nextName,
    description: nextDescription,
    updatedAt: new Date().toISOString(),
  }

  await putStoredImageAssetRecord({
    asset,
    blob: storedRecord.blob,
    thumbnailBlob: storedRecord.thumbnailBlob ?? undefined,
  })

  return asset
}

export async function deleteImageAsset(imageId: string) {
  const db = await openLinkHubDb()
  const transaction = db.transaction(
    [
      STORAGE_STORES.imageAsset,
      STORAGE_STORES.imageBlob,
      STORAGE_STORES.imageThumbnailBlob,
    ],
    'readwrite',
  )

  await transaction.objectStore(STORAGE_STORES.imageAsset).delete(imageId)
  await transaction.objectStore(STORAGE_STORES.imageBlob).delete(imageId)
  await transaction
    .objectStore(STORAGE_STORES.imageThumbnailBlob)
    .delete(imageId)
  await transaction.done
}
