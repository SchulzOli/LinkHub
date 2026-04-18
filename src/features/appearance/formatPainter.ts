import type { CardGroup, GroupSize } from '../../contracts/cardGroup'
import {
  CARD_SIZE_LIMITS,
  type CardSize,
  type LinkCard,
} from '../../contracts/linkCard'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'

type FormatPainterSource = {
  id: string
  kind: 'card' | 'group'
}

type FormatPainterSize = {
  columns: number
  rows: number
}

type FormatPainterStyleFields = {
  borderColor?: string
  borderPresetIndex?: number
  cornerRadius?: number
  fillColor?: string
  fillPresetIndex?: number
  shadowStyle?: SurfaceShadowStyle
  showImage?: boolean
  showTitle?: boolean
  size?: FormatPainterSize
  surfaceTransparency?: SurfaceTransparency
}

export type FormatPainterPayload = FormatPainterSource &
  FormatPainterStyleFields

export type FormatPainterCardUpdates = {
  borderColor?: string
  borderPresetIndex?: number
  cornerRadius?: number
  fillColor?: string
  fillPresetIndex?: number
  shadowStyle?: SurfaceShadowStyle
  showImage?: boolean
  showTitle?: boolean
  size?: CardSize
  surfaceTransparency?: SurfaceTransparency
}

export type FormatPainterGroupUpdates = {
  borderColor?: string
  borderPresetIndex?: number
  cornerRadius?: number
  fillColor?: string
  fillPresetIndex?: number
  shadowStyle?: SurfaceShadowStyle
  showTitle?: boolean
  size?: CardSize
  surfaceTransparency?: SurfaceTransparency
}

type CardFormatSource = Pick<
  LinkCard,
  | 'id'
  | 'cornerRadius'
  | 'size'
  | 'showTitle'
  | 'showImage'
  | 'fillPresetIndex'
  | 'borderPresetIndex'
  | 'fillColor'
  | 'borderColor'
  | 'surfaceTransparency'
  | 'shadowStyle'
>

type GroupFormatSource = Pick<
  CardGroup,
  | 'id'
  | 'cornerRadius'
  | 'size'
  | 'showTitle'
  | 'fillPresetIndex'
  | 'borderPresetIndex'
  | 'fillColor'
  | 'borderColor'
  | 'surfaceTransparency'
  | 'shadowStyle'
>

function resolveColorSelection(input: {
  color?: string
  presetIndex?: number
}): {
  color?: string
  presetIndex?: number
} {
  if (input.presetIndex !== undefined) {
    return {
      color: undefined,
      presetIndex: input.presetIndex,
    }
  }

  return {
    color: input.color,
    presetIndex: undefined,
  }
}

function clampCardSizeValue(value: number) {
  return Math.min(
    CARD_SIZE_LIMITS.max,
    Math.max(CARD_SIZE_LIMITS.min, Math.round(value)),
  )
}

function cloneSize(size: FormatPainterSize): FormatPainterSize {
  return {
    columns: size.columns,
    rows: size.rows,
  }
}

function clampSizeForCard(size: FormatPainterSize): CardSize {
  return {
    columns: clampCardSizeValue(size.columns),
    rows: clampCardSizeValue(size.rows),
  }
}

function normalizeSizeForGroup(size: FormatPainterSize): GroupSize {
  return {
    columns: Math.max(2, Math.round(size.columns)),
    rows: Math.max(2, Math.round(size.rows)),
  }
}

export function createFormatPainterFromCard(
  card: CardFormatSource,
): FormatPainterPayload {
  return {
    id: card.id,
    kind: 'card',
    cornerRadius: card.cornerRadius,
    size: cloneSize(card.size),
    showTitle: card.showTitle,
    showImage: card.showImage,
    fillPresetIndex: card.fillPresetIndex,
    borderPresetIndex: card.borderPresetIndex,
    fillColor: card.fillColor,
    borderColor: card.borderColor,
    surfaceTransparency: card.surfaceTransparency,
    shadowStyle: card.shadowStyle,
  }
}

export function createFormatPainterFromGroup(
  group: GroupFormatSource,
): FormatPainterPayload {
  return {
    id: group.id,
    kind: 'group',
    cornerRadius: group.cornerRadius,
    size: cloneSize(group.size),
    showTitle: group.showTitle,
    fillPresetIndex: group.fillPresetIndex,
    borderPresetIndex: group.borderPresetIndex,
    fillColor: group.fillColor,
    borderColor: group.borderColor,
    surfaceTransparency: group.surfaceTransparency,
    shadowStyle: group.shadowStyle,
  }
}

export function getCardUpdatesFromFormatPainter(
  payload: FormatPainterPayload,
): FormatPainterCardUpdates {
  const fillSelection = resolveColorSelection({
    color: payload.fillColor,
    presetIndex: payload.fillPresetIndex,
  })
  const borderSelection = resolveColorSelection({
    color: payload.borderColor,
    presetIndex: payload.borderPresetIndex,
  })

  return {
    borderColor: borderSelection.color,
    borderPresetIndex: borderSelection.presetIndex,
    cornerRadius: payload.cornerRadius,
    fillColor: fillSelection.color,
    fillPresetIndex: fillSelection.presetIndex,
    shadowStyle: payload.shadowStyle,
    showImage: payload.kind === 'card' ? payload.showImage : undefined,
    showTitle: payload.showTitle,
    size: payload.size ? clampSizeForCard(payload.size) : undefined,
    surfaceTransparency: payload.surfaceTransparency,
  }
}

export function getGroupUpdatesFromFormatPainter(
  payload: FormatPainterPayload,
): FormatPainterGroupUpdates {
  const fillSelection = resolveColorSelection({
    color: payload.fillColor,
    presetIndex: payload.fillPresetIndex,
  })
  const borderSelection = resolveColorSelection({
    color: payload.borderColor,
    presetIndex: payload.borderPresetIndex,
  })

  return {
    borderColor: borderSelection.color,
    borderPresetIndex: borderSelection.presetIndex,
    cornerRadius: payload.cornerRadius,
    fillColor: fillSelection.color,
    fillPresetIndex: fillSelection.presetIndex,
    shadowStyle: payload.shadowStyle,
    showTitle: payload.showTitle,
    size: payload.size ? normalizeSizeForGroup(payload.size) : undefined,
    surfaceTransparency: payload.surfaceTransparency,
  }
}

export function isFormatPainterSourceMatch(
  payload: FormatPainterPayload | null,
  candidate: { id: string; kind: 'card' | 'group' },
) {
  return payload?.id === candidate.id && payload.kind === candidate.kind
}
