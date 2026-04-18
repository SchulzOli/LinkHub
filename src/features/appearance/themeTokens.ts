import type { StylePreset } from '../../contracts/appearanceProfile'
import type { CardSize } from '../../contracts/linkCard'

import { APPEARANCE_STYLE_PRESETS } from './stylePresets'

export const CARD_GAP_GRID_CELLS = 1

export const STYLE_PRESET_LABELS: Record<StylePreset, string> = {
  excalidraw: APPEARANCE_STYLE_PRESETS.excalidraw.label,
  blueprint: APPEARANCE_STYLE_PRESETS.blueprint.label,
}

export function getCardPixelDimensions(size: CardSize, gridSize: number) {
  return {
    width: size.columns * gridSize,
    height: size.rows * gridSize,
  }
}

export function getOverlayActionMetrics(width: number, height: number) {
  const compactDimension = Math.min(width, height)
  const buttonSize = Math.round(
    Math.max(18, Math.min(36, compactDimension * 0.22)),
  )
  const iconSize = Math.round(Math.max(10, Math.min(16, buttonSize * 0.5)))
  const gap = Math.round(Math.max(3, Math.min(6, buttonSize * 0.18)))
  const offset = Math.round(Math.max(6, Math.min(12, buttonSize * 0.34)))

  return {
    buttonSize,
    iconSize,
    gap,
    offset,
  }
}
