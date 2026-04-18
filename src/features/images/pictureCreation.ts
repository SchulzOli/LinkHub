import type { ImageAsset } from '../../contracts/imageAsset'
import {
  CARD_SIZE_LIMITS,
  DEFAULT_CARD_SIZE,
  type CardSize,
} from '../../contracts/linkCard'
import type { PictureNode } from '../../contracts/pictureNode'
import { createId } from '../../utils/id'

function clampGridCellCount(value: number) {
  return Math.min(
    CARD_SIZE_LIMITS.max,
    Math.max(CARD_SIZE_LIMITS.min, Math.round(value)),
  )
}

export function getDefaultPictureNodeSize(
  image: Pick<ImageAsset, 'width' | 'height'>,
): CardSize {
  if (!image.width || !image.height) {
    return DEFAULT_CARD_SIZE
  }

  const targetLongEdge = 8

  if (image.width >= image.height) {
    return {
      columns: clampGridCellCount(targetLongEdge),
      rows: clampGridCellCount((targetLongEdge * image.height) / image.width),
    }
  }

  return {
    columns: clampGridCellCount((targetLongEdge * image.width) / image.height),
    rows: clampGridCellCount(targetLongEdge),
  }
}

export function createPictureNode(input: {
  image: Pick<ImageAsset, 'height' | 'id' | 'width'>
  position: { x: number; y: number }
  size?: CardSize
}): PictureNode {
  const now = new Date().toISOString()

  return {
    id: createId(),
    type: 'picture',
    imageId: input.image.id,
    positionX: input.position.x,
    positionY: input.position.y,
    size: input.size ?? getDefaultPictureNodeSize(input.image),
    createdAt: now,
    updatedAt: now,
  }
}
