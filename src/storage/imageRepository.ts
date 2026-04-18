import type { ImageAsset } from '../contracts/imageAsset'
import { resolveSupportedImageUploadMimeType } from '../contracts/imageAsset'
import { createId } from '../utils/id'
import { openLinkHubDb, STORAGE_STORES } from './db'

export type StoredImageAssetRecord = {
  asset: ImageAsset
  blob: Blob
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
    createdAt: now,
    updatedAt: now,
  }
  const db = await openLinkHubDb()
  const transaction = db.transaction(
    [STORAGE_STORES.imageAsset, STORAGE_STORES.imageBlob],
    'readwrite',
  )

  await transaction.objectStore(STORAGE_STORES.imageAsset).put(asset, asset.id)
  await transaction.objectStore(STORAGE_STORES.imageBlob).put(normalizedFile, asset.id)
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
    ((await db.get(STORAGE_STORES.imageAsset, imageId)) as ImageAsset | undefined) ??
    null
  )
}

export async function getImageBlob(imageId: string) {
  const db = await openLinkHubDb()

  return ((await db.get(STORAGE_STORES.imageBlob, imageId)) as Blob | undefined) ?? null
}

export async function getStoredImageAssetRecord(imageId: string) {
  const [asset, blob] = await Promise.all([
    getImageAsset(imageId),
    getImageBlob(imageId),
  ])

  if (!asset || !blob) {
    return null
  }

  return {
    asset,
    blob,
  } satisfies StoredImageAssetRecord
}

export async function putStoredImageAssetRecord(input: StoredImageAssetRecord) {
  const db = await openLinkHubDb()
  const transaction = db.transaction(
    [STORAGE_STORES.imageAsset, STORAGE_STORES.imageBlob],
    'readwrite',
  )

  await transaction
    .objectStore(STORAGE_STORES.imageAsset)
    .put(input.asset, input.asset.id)
  await transaction
    .objectStore(STORAGE_STORES.imageBlob)
    .put(normalizeStoredImageBlob(input.asset, input.blob), input.asset.id)
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
  })

  return asset
}

export async function deleteImageAsset(imageId: string) {
  const db = await openLinkHubDb()
  const transaction = db.transaction(
    [STORAGE_STORES.imageAsset, STORAGE_STORES.imageBlob],
    'readwrite',
  )

  await transaction.objectStore(STORAGE_STORES.imageAsset).delete(imageId)
  await transaction.objectStore(STORAGE_STORES.imageBlob).delete(imageId)
  await transaction.done
}
