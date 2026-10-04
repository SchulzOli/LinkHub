import { z } from 'zod'

import { ChartNodeSchema, coerceChartNode, type ChartNode } from './chartNode'
import { coerceFeedNode, FeedNodeSchema, type FeedNode } from './feedNode'
import { CardSizeSchema, coerceCardSize, DEFAULT_CARD_SIZE } from './linkCard'

export const ImagePictureNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('picture'),
  imageId: z.string().min(1),
  positionX: z.number(),
  positionY: z.number(),
  size: CardSizeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ImagePictureNode = z.infer<typeof ImagePictureNodeSchema>

/**
 * Free-floating canvas nodes (no `groupId`; group membership follows their
 * bounds). `picture` = image, `chart` = streamed time-series chart,
 * `feed` = RSS/Atom news list.
 */
export const PictureNodeSchema = z.discriminatedUnion('type', [
  ImagePictureNodeSchema,
  ChartNodeSchema,
  FeedNodeSchema,
])

export type PictureNode = ImagePictureNode | ChartNode | FeedNode

export function isImagePictureNode(
  node: PictureNode,
): node is ImagePictureNode {
  return node.type === 'picture'
}

export function isChartNode(node: PictureNode): node is ChartNode {
  return node.type === 'chart'
}

export function isFeedNode(node: PictureNode): node is FeedNode {
  return node.type === 'feed'
}

export function coercePictureNode(value: unknown): PictureNode | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  if ((value as { type?: unknown }).type === 'chart') {
    return coerceChartNode(value)
  }

  if ((value as { type?: unknown }).type === 'feed') {
    return coerceFeedNode(value)
  }

  const candidate = value as Partial<ImagePictureNode> & {
    size?: unknown
    type?: unknown
  }

  if (
    typeof candidate.id !== 'string' ||
    candidate.id.length === 0 ||
    typeof candidate.imageId !== 'string' ||
    candidate.imageId.length === 0 ||
    typeof candidate.positionX !== 'number' ||
    typeof candidate.positionY !== 'number' ||
    typeof candidate.createdAt !== 'string' ||
    typeof candidate.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: candidate.id,
    type: 'picture',
    imageId: candidate.imageId,
    positionX: candidate.positionX,
    positionY: candidate.positionY,
    size: coerceCardSize(candidate.size, DEFAULT_CARD_SIZE),
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  }
}
