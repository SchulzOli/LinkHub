import { z } from 'zod'

export const ImageAssetThumbnailMetadataSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  byteSize: z.number().int().nonnegative(),
  mimeType: z.string().min(1),
})

export type ImageAssetThumbnailMetadata = z.infer<
  typeof ImageAssetThumbnailMetadataSchema
>

export const ImageAssetSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  originalFilename: z.string().trim().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  isAnimated: z.boolean(),
  thumbnail: ImageAssetThumbnailMetadataSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ImageAsset = z.infer<typeof ImageAssetSchema>

export const SUPPORTED_IMAGE_UPLOAD_MIME_TYPES = [
  'image/apng',
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
] as const

const IMAGE_UPLOAD_MIME_TYPE_BY_EXTENSION = {
  apng: 'image/apng',
  avif: 'image/avif',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
} as const

const IMAGE_FILE_EXTENSION_BY_MIME_TYPE = Object.fromEntries(
  Object.entries(IMAGE_UPLOAD_MIME_TYPE_BY_EXTENSION).map(
    ([extension, mimeType]) => [mimeType, extension],
  ),
) as Record<(typeof SUPPORTED_IMAGE_UPLOAD_MIME_TYPES)[number], string>

function normalizeImageUploadMimeType(mimeType: string | null | undefined) {
  const normalizedMimeType = mimeType?.trim().toLowerCase()

  if (!normalizedMimeType) {
    return null
  }

  if (normalizedMimeType === 'image/jpg') {
    return 'image/jpeg'
  }

  return normalizedMimeType
}

export function resolveSupportedImageUploadMimeType(input: {
  filename?: string | null
  mimeType?: string | null
}) {
  const normalizedMimeType = normalizeImageUploadMimeType(input.mimeType)

  if (
    normalizedMimeType &&
    SUPPORTED_IMAGE_UPLOAD_MIME_TYPES.includes(
      normalizedMimeType as (typeof SUPPORTED_IMAGE_UPLOAD_MIME_TYPES)[number],
    )
  ) {
    return normalizedMimeType
  }

  const normalizedFilename = input.filename?.trim().toLowerCase()

  if (!normalizedFilename) {
    return null
  }

  const extensionMatch = normalizedFilename.match(/\.([a-z0-9+]+)$/)

  if (!extensionMatch) {
    return null
  }

  return (
    IMAGE_UPLOAD_MIME_TYPE_BY_EXTENSION[
      extensionMatch[1] as keyof typeof IMAGE_UPLOAD_MIME_TYPE_BY_EXTENSION
    ] ?? null
  )
}

export function isSupportedImageUploadMimeType(mimeType: string) {
  return resolveSupportedImageUploadMimeType({ mimeType }) !== null
}

export function getImageFileExtensionForMimeType(mimeType: string) {
  const resolvedMimeType = resolveSupportedImageUploadMimeType({ mimeType })

  if (!resolvedMimeType) {
    return null
  }

  return (
    IMAGE_FILE_EXTENSION_BY_MIME_TYPE[
      resolvedMimeType as keyof typeof IMAGE_FILE_EXTENSION_BY_MIME_TYPE
    ] ?? null
  )
}
