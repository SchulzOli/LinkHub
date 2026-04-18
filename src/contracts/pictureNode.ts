import { z } from 'zod'

import { CardSizeSchema, coerceCardSize, DEFAULT_CARD_SIZE } from './linkCard'

export const PictureNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('picture'),
  imageId: z.string().min(1),
  positionX: z.number(),
  positionY: z.number(),
  size: CardSizeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type PictureNode = z.infer<typeof PictureNodeSchema>

export function coercePictureNode(value: unknown): PictureNode | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<PictureNode> & {
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
