import { z } from 'zod'

import {
  CardColorHexSchema,
  CardColorPresetIndexSchema,
  coerceCardColor,
  coerceCardColorPresetIndex,
} from './cardColors'
import {
  SurfaceShadowStyleSchema,
  SurfaceTransparencySchema,
} from './surfaceEffects'

export const CARD_SIZE_LIMITS = {
  min: 2,
  max: 12,
} as const

export const CARD_CORNER_RADIUS_LIMITS = {
  min: 0,
  max: 50,
} as const

export const LegacyCardSizeSchema = z.enum([
  'compact',
  'default',
  'comfortable',
])

export const CardSizeSchema = z.object({
  columns: z.number().int().min(CARD_SIZE_LIMITS.min).max(CARD_SIZE_LIMITS.max),
  rows: z.number().int().min(CARD_SIZE_LIMITS.min).max(CARD_SIZE_LIMITS.max),
})

export const CardCornerRadiusSchema = z
  .number()
  .min(CARD_CORNER_RADIUS_LIMITS.min)
  .max(CARD_CORNER_RADIUS_LIMITS.max)

export const DEFAULT_CARD_SIZE = {
  columns: 5,
  rows: 5,
} satisfies z.infer<typeof CardSizeSchema>

export const DEFAULT_CARD_CORNER_RADIUS = 10
export const DEFAULT_CARD_SHOW_TITLE = true
export const DEFAULT_CARD_SHOW_IMAGE = true

export const LinkCardSchema = z.object({
  id: z.string().min(1),
  url: z.url(),
  title: z.string().trim(),
  faviconUrl: z.string(),
  faviconOverrideImageId: z.string().min(1).optional(),
  positionX: z.number(),
  positionY: z.number(),
  size: CardSizeSchema,
  cornerRadius: CardCornerRadiusSchema.optional(),
  showTitle: z.boolean().optional(),
  showImage: z.boolean().optional(),
  fillPresetIndex: CardColorPresetIndexSchema.optional(),
  borderPresetIndex: CardColorPresetIndexSchema.optional(),
  fillColor: CardColorHexSchema.optional(),
  borderColor: CardColorHexSchema.optional(),
  surfaceTransparency: SurfaceTransparencySchema.optional(),
  shadowStyle: SurfaceShadowStyleSchema.optional(),
  groupId: z.string().min(1).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CardSize = z.infer<typeof CardSizeSchema>
export type LegacyCardSize = z.infer<typeof LegacyCardSizeSchema>
export type LinkCard = z.infer<typeof LinkCardSchema>

const LEGACY_CARD_SIZE_MAP: Record<LegacyCardSize, CardSize> = {
  compact: { columns: 4, rows: 4 },
  default: { columns: 5, rows: 5 },
  comfortable: { columns: 6, rows: 6 },
}

function clampCardSizeValue(value: number) {
  return Math.min(
    CARD_SIZE_LIMITS.max,
    Math.max(CARD_SIZE_LIMITS.min, Math.round(value)),
  )
}

export function clampCardCornerRadius(value: number) {
  return Math.min(
    CARD_CORNER_RADIUS_LIMITS.max,
    Math.max(CARD_CORNER_RADIUS_LIMITS.min, Math.round(value)),
  )
}

export function getLegacyCardSize(size: LegacyCardSize): CardSize {
  return LEGACY_CARD_SIZE_MAP[size]
}

export function coerceCardSize(
  value: unknown,
  fallback: CardSize = DEFAULT_CARD_SIZE,
): CardSize {
  const legacyCardSize = LegacyCardSizeSchema.safeParse(value)

  if (legacyCardSize.success) {
    return getLegacyCardSize(legacyCardSize.data)
  }

  if (typeof value === 'object' && value !== null) {
    const candidate = value as {
      columns?: unknown
      rows?: unknown
      width?: unknown
      height?: unknown
    }
    const rawColumns = candidate.columns ?? candidate.width
    const rawRows = candidate.rows ?? candidate.height

    if (typeof rawColumns === 'number' && typeof rawRows === 'number') {
      return {
        columns: clampCardSizeValue(rawColumns),
        rows: clampCardSizeValue(rawRows),
      }
    }
  }

  return fallback
}

export function coerceCardVisibility(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

export function coerceCardVisibilityDefault(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

export function coerceLinkCardColors(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return {
      fillColor: undefined,
      borderColor: undefined,
      fillPresetIndex: undefined,
      borderPresetIndex: undefined,
    }
  }

  const candidate = value as {
    fillColor?: unknown
    borderColor?: unknown
    groupId?: unknown
    fillPresetIndex?: unknown
    borderPresetIndex?: unknown
    faviconOverrideImageId?: unknown
  }

  return {
    fillColor: coerceCardColor(candidate.fillColor),
    borderColor: coerceCardColor(candidate.borderColor),
    fillPresetIndex: coerceCardColorPresetIndex(candidate.fillPresetIndex),
    borderPresetIndex: coerceCardColorPresetIndex(candidate.borderPresetIndex),
    faviconOverrideImageId:
      typeof candidate.faviconOverrideImageId === 'string' &&
      candidate.faviconOverrideImageId.length > 0
        ? candidate.faviconOverrideImageId
        : undefined,
    groupId:
      typeof candidate.groupId === 'string' && candidate.groupId.length > 0
        ? candidate.groupId
        : undefined,
  }
}

export function coerceCardCornerRadius(
  value: unknown,
  fallback = DEFAULT_CARD_CORNER_RADIUS,
) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }

  return clampCardCornerRadius(value)
}

export function parseCardSizeDraft(
  columnsDraft: string,
  rowsDraft: string,
): CardSize | null {
  const columns = Number(columnsDraft)
  const rows = Number(rowsDraft)

  if (!Number.isInteger(columns) || !Number.isInteger(rows)) {
    return null
  }

  const parsed = CardSizeSchema.safeParse({ columns, rows })

  return parsed.success ? parsed.data : null
}
