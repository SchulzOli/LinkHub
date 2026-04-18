import { resolveSupportedImageUploadMimeType } from '../../contracts/imageAsset'

export function hasFileDataTransfer(
  dataTransfer: Pick<DataTransfer, 'types'> | null | undefined,
) {
  if (!dataTransfer) {
    return false
  }

  const normalizedTypes = Array.from(dataTransfer.types, (type) =>
    type.toLowerCase(),
  )

  return (
    normalizedTypes.includes('files') ||
    normalizedTypes.includes('application/x-moz-file')
  )
}

export function getSupportedDroppedImageFiles(
  files: FileList | readonly File[] | null | undefined,
) {
  if (!files) {
    return []
  }

  return Array.from(files).filter(
    (file) =>
      resolveSupportedImageUploadMimeType({
        filename: file.name,
        mimeType: file.type,
      }) !== null,
  )
}
