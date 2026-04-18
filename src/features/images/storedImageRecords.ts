import type { Workspace } from '../../contracts/workspace'
import type { StoredImageAssetRecord } from '../../storage/imageRepository'
import { createId } from '../../utils/id'

export async function areImageBlobsEqual(left: Blob, right: Blob) {
  if (left.size !== right.size) {
    return false
  }

  const [leftBytes, rightBytes] = await Promise.all([
    new Uint8Array(await left.arrayBuffer()),
    new Uint8Array(await right.arrayBuffer()),
  ])

  for (let index = 0; index < leftBytes.length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) {
      return false
    }
  }

  return true
}

export async function areStoredImagesEquivalent(
  left: StoredImageAssetRecord,
  right: StoredImageAssetRecord,
) {
  if (
    left.asset.mimeType !== right.asset.mimeType ||
    left.asset.byteSize !== right.asset.byteSize ||
    left.asset.width !== right.asset.width ||
    left.asset.height !== right.asset.height ||
    left.asset.isAnimated !== right.asset.isAnimated
  ) {
    return false
  }

  return areImageBlobsEqual(left.blob, right.blob)
}

export function rewriteWorkspaceImageReferences(
  workspace: Workspace,
  imageIdMap: Map<string, string>,
) {
  if (imageIdMap.size === 0) {
    return workspace
  }

  return {
    ...workspace,
    cards: workspace.cards.map((card) => ({
      ...card,
      faviconOverrideImageId: card.faviconOverrideImageId
        ? (imageIdMap.get(card.faviconOverrideImageId) ??
          card.faviconOverrideImageId)
        : undefined,
    })),
    pictures: workspace.pictures.map((picture) => ({
      ...picture,
      imageId: imageIdMap.get(picture.imageId) ?? picture.imageId,
    })),
  }
}

export async function reconcileStoredImageRecords(input: {
  records: StoredImageAssetRecord[]
  resolveExistingImage: (
    imageId: string,
  ) => Promise<StoredImageAssetRecord | null>
}) {
  const imageIdMap = new Map<string, string>()
  const recordsToStore: StoredImageAssetRecord[] = []

  for (const imageRecord of input.records) {
    const existingImage = await input.resolveExistingImage(imageRecord.asset.id)

    if (!existingImage) {
      recordsToStore.push(imageRecord)
      continue
    }

    if (await areStoredImagesEquivalent(existingImage, imageRecord)) {
      continue
    }

    const nextImageId = createId()

    imageIdMap.set(imageRecord.asset.id, nextImageId)
    recordsToStore.push({
      ...imageRecord,
      asset: {
        ...imageRecord.asset,
        id: nextImageId,
      },
    })
  }

  return {
    imageIdMap,
    recordsToStore,
  }
}
