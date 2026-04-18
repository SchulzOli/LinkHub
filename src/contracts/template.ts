import { z } from 'zod'

import { CardGroupSchema } from './cardGroup'
import { ImageAssetSchema } from './imageAsset'
import { LinkCardSchema } from './linkCard'
import { PictureNodeSchema } from './pictureNode'

export const TEMPLATE_DOCUMENT_FORMAT = 'linkhub.template'
export const TEMPLATE_DOCUMENT_VERSION = 1

export const TemplateImageEntrySchema = z.object({
  asset: ImageAssetSchema,
  sourceImageId: z.string().min(1),
})

export const TemplateContentSchema = z.object({
  cards: z.array(LinkCardSchema),
  groups: z.array(CardGroupSchema),
  pictures: z.array(PictureNodeSchema),
  images: z.array(TemplateImageEntrySchema),
})

export const TemplateDocumentSchema = z.object({
  format: z.literal(TEMPLATE_DOCUMENT_FORMAT),
  version: z.literal(TEMPLATE_DOCUMENT_VERSION),
  id: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().max(400).optional(),
  previewDataUrl: z.string().min(1).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  content: TemplateContentSchema,
})

export type TemplateImageEntry = z.infer<typeof TemplateImageEntrySchema>
export type TemplateContent = z.infer<typeof TemplateContentSchema>
export type TemplateDocument = z.infer<typeof TemplateDocumentSchema>

export function sanitizeTemplateName(value: string) {
  return value.trim()
}

export function sanitizeTemplateDescription(value: string) {
  const trimmed = value.trim()

  return trimmed ? trimmed : undefined
}
