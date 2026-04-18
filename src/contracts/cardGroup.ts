import { z } from 'zod'

import {
  CardColorHexSchema,
  CardColorPresetIndexSchema,
  coerceCardColor,
  coerceCardColorPresetIndex,
} from './cardColors'
import {
  CardCornerRadiusSchema,
  DEFAULT_CARD_CORNER_RADIUS,
  DEFAULT_CARD_SIZE,
  clampCardCornerRadius,
  coerceCardVisibility,
  type CardSize,
} from './linkCard'
import {
  DEFAULT_SURFACE_SHADOW_STYLE,
  DEFAULT_SURFACE_TRANSPARENCY,
  SurfaceShadowStyleSchema,
  SurfaceTransparencySchema,
  coerceSurfaceShadowStyle,
  coerceSurfaceTransparency,
} from './surfaceEffects'

export const GROUP_SIZE_LIMITS = {
  min: 2,
} as const

export const GROUP_CHROME_LIMITS = {
  minPaddingPx: 3,
  maxPaddingPx: 8,
  minGapPx: 2,
  maxGapPx: 6,
  minHeaderHeightPx: 16,
  maxHeaderHeightPx: 24,
} as const

export const GroupSizeSchema = z.object({
  columns: z.number().int().min(GROUP_SIZE_LIMITS.min),
  rows: z.number().int().min(GROUP_SIZE_LIMITS.min),
})

export type GroupSize = z.infer<typeof GroupSizeSchema>

export const COLLAPSED_GROUP_ROWS = 2 as const

function resolveGroupLayoutSize(
  size: GroupSize,
  collapsed?: boolean,
): GroupSize {
  return collapsed
    ? {
        columns: size.columns,
        rows: Math.min(size.rows, COLLAPSED_GROUP_ROWS),
      }
    : size
}

export function getGroupChromeMetrics(size: GroupSize, gridSize: number) {
  const pixelWidth = size.columns * gridSize
  const pixelHeight = size.rows * gridSize
  const compactDimension = Math.min(pixelWidth, pixelHeight)
  const padding = Math.max(
    GROUP_CHROME_LIMITS.minPaddingPx,
    Math.min(
      GROUP_CHROME_LIMITS.maxPaddingPx,
      Math.round(compactDimension * 0.05),
    ),
  )
  const gap = Math.max(
    GROUP_CHROME_LIMITS.minGapPx,
    Math.min(
      GROUP_CHROME_LIMITS.maxGapPx,
      Math.round(compactDimension * 0.025),
    ),
  )
  const headerHeight = Math.max(
    GROUP_CHROME_LIMITS.minHeaderHeightPx,
    Math.min(
      GROUP_CHROME_LIMITS.maxHeaderHeightPx,
      Math.round(pixelHeight * 0.14),
    ),
  )

  return {
    padding,
    gap,
    headerHeight,
    pixelWidth,
    pixelHeight,
  }
}

export function getGroupCornerRadii(input: {
  collapsed?: boolean
  cornerRadius: number
  gridSize: number
  size: GroupSize
}) {
  const layoutSize = resolveGroupLayoutSize(input.size, input.collapsed)
  const metrics = getGroupChromeMetrics(layoutSize, input.gridSize)
  const expandedMetrics = getGroupChromeMetrics(input.size, input.gridSize)
  const compactDimension = Math.min(
    expandedMetrics.pixelWidth,
    expandedMetrics.pixelHeight,
  )
  const shellRadius = Math.max(
    0,
    Math.min(
      expandedMetrics.pixelWidth / 2,
      expandedMetrics.pixelHeight / 2,
      Math.round((compactDimension * input.cornerRadius) / 100),
    ),
  )
  const innerRadius = Math.max(0, shellRadius - expandedMetrics.padding)
  const headerTopRadius = Math.min(
    innerRadius,
    expandedMetrics.headerHeight / 2,
  )
  const headerBottomRadius = headerTopRadius
  const bodyTopRadius = Math.min(innerRadius, metrics.headerHeight / 3)
  const bodyBottomRadius = Math.min(
    innerRadius,
    Math.max(0, (metrics.pixelHeight - metrics.padding * 2) / 2),
  )

  return {
    shellTopRadius: Math.min(
      shellRadius,
      expandedMetrics.padding + headerTopRadius,
    ),
    shellBottomRadius: input.collapsed
      ? Math.min(shellRadius, expandedMetrics.padding + headerBottomRadius)
      : shellRadius,
    headerTopRadius,
    headerBottomRadius,
    bodyTopRadius,
    bodyBottomRadius,
  }
}

export function getGroupBodyBounds(
  group: {
    positionX: number
    positionY: number
    size: GroupSize
    collapsed?: boolean
  },
  gridSize: number,
) {
  const layoutSize = resolveGroupLayoutSize(group.size, group.collapsed)
  const metrics = getGroupChromeMetrics(layoutSize, gridSize)
  const left = group.positionX + metrics.padding
  const top =
    group.positionY + metrics.padding + metrics.headerHeight + metrics.gap
  const right = Math.max(
    left,
    group.positionX + metrics.pixelWidth - metrics.padding,
  )

  if (group.collapsed) {
    return {
      left,
      top,
      right,
      bottom: top,
    }
  }

  const bottom = Math.max(
    top,
    group.positionY + metrics.pixelHeight - metrics.padding,
  )

  return {
    left,
    top,
    right,
    bottom,
  }
}

function getSnappedPlacementSlotCount(
  groupSize: GroupSize,
  cardSize: CardSize,
  gridSize: number,
) {
  const bodyBounds = getGroupBodyBounds(
    {
      positionX: 0,
      positionY: 0,
      size: groupSize,
    },
    gridSize,
  )
  const cardWidth = cardSize.columns * gridSize
  const cardHeight = cardSize.rows * gridSize
  const minColumn = Math.ceil(bodyBounds.left / gridSize)
  const maxColumn = Math.floor((bodyBounds.right - cardWidth) / gridSize)
  const minRow = Math.ceil(bodyBounds.top / gridSize)
  const maxRow = Math.floor((bodyBounds.bottom - cardHeight) / gridSize)

  return {
    columns: Math.max(0, maxColumn - minColumn + 1),
    rows: Math.max(0, maxRow - minRow + 1),
  }
}

export function getDefaultGroupSize(
  cardSize: CardSize,
  gridSize: number,
): GroupSize {
  let nextSize: GroupSize = {
    columns: Math.max(GROUP_SIZE_LIMITS.min, cardSize.columns + 3),
    rows: Math.max(GROUP_SIZE_LIMITS.min, cardSize.rows + 3),
  }

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const placementSlots = getSnappedPlacementSlotCount(
      nextSize,
      cardSize,
      gridSize,
    )

    if (placementSlots.columns >= 2 && placementSlots.rows >= 2) {
      return nextSize
    }

    nextSize = {
      columns:
        placementSlots.columns >= 2 ? nextSize.columns : nextSize.columns + 1,
      rows: placementSlots.rows >= 2 ? nextSize.rows : nextSize.rows + 1,
    }
  }

  return nextSize
}

function clampGroupSizeValue(value: number) {
  return Math.max(GROUP_SIZE_LIMITS.min, Math.round(value))
}

export function coerceGroupSize(
  value: unknown,
  fallback: GroupSize = DEFAULT_CARD_SIZE,
): GroupSize {
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
        columns: clampGroupSizeValue(rawColumns),
        rows: clampGroupSizeValue(rawRows),
      }
    }
  }

  return fallback
}

export function parseGroupSizeDraft(
  columnsDraft: string,
  rowsDraft: string,
): GroupSize | null {
  const columns = Number(columnsDraft)
  const rows = Number(rowsDraft)

  if (!Number.isInteger(columns) || !Number.isInteger(rows)) {
    return null
  }

  const parsed = GroupSizeSchema.safeParse({ columns, rows })

  return parsed.success ? parsed.data : null
}

export const CardGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  positionX: z.number(),
  positionY: z.number(),
  size: GroupSizeSchema,
  parentGroupId: z.string().min(1).optional(),
  collapsed: z.boolean().optional(),
  cornerRadius: CardCornerRadiusSchema.optional(),
  showTitle: z.boolean().optional(),
  fillPresetIndex: CardColorPresetIndexSchema.optional(),
  borderPresetIndex: CardColorPresetIndexSchema.optional(),
  fillColor: CardColorHexSchema.optional(),
  borderColor: CardColorHexSchema.optional(),
  surfaceTransparency: SurfaceTransparencySchema.optional(),
  shadowStyle: SurfaceShadowStyleSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CardGroup = z.infer<typeof CardGroupSchema>

export function getGroupLayoutSize(
  group: Pick<CardGroup, 'size' | 'collapsed'>,
): GroupSize {
  return resolveGroupLayoutSize(group.size, group.collapsed)
}

export function coerceCardGroup(value: unknown): CardGroup | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<CardGroup> & {
    size?: unknown
    parentGroupId?: unknown
    collapsed?: unknown
    cornerRadius?: unknown
    showTitle?: unknown
    fillPresetIndex?: unknown
    borderPresetIndex?: unknown
    fillColor?: unknown
    borderColor?: unknown
    surfaceTransparency?: unknown
    edgeFade?: unknown
    shadowStyle?: unknown
  }

  if (
    typeof candidate.id !== 'string' ||
    candidate.id.length === 0 ||
    typeof candidate.name !== 'string' ||
    candidate.name.trim().length === 0 ||
    typeof candidate.positionX !== 'number' ||
    typeof candidate.positionY !== 'number' ||
    typeof candidate.createdAt !== 'string' ||
    typeof candidate.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: candidate.id,
    name: candidate.name.trim(),
    positionX: candidate.positionX,
    positionY: candidate.positionY,
    size: coerceGroupSize(candidate.size, DEFAULT_CARD_SIZE),
    parentGroupId:
      typeof candidate.parentGroupId === 'string' && candidate.parentGroupId
        ? candidate.parentGroupId
        : undefined,
    collapsed: candidate.collapsed === true ? true : undefined,
    cornerRadius:
      typeof candidate.cornerRadius === 'number'
        ? clampCardCornerRadius(candidate.cornerRadius)
        : DEFAULT_CARD_CORNER_RADIUS,
    showTitle: coerceCardVisibility(candidate.showTitle),
    fillPresetIndex: coerceCardColorPresetIndex(candidate.fillPresetIndex),
    borderPresetIndex: coerceCardColorPresetIndex(candidate.borderPresetIndex),
    fillColor: coerceCardColor(candidate.fillColor),
    borderColor: coerceCardColor(candidate.borderColor),
    surfaceTransparency: coerceSurfaceTransparency(
      candidate.surfaceTransparency ?? candidate.edgeFade,
      DEFAULT_SURFACE_TRANSPARENCY,
    ),
    shadowStyle: coerceSurfaceShadowStyle(
      candidate.shadowStyle,
      DEFAULT_SURFACE_SHADOW_STYLE,
    ),
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  }
}
