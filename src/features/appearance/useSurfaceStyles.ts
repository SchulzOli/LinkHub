import type { AppearanceProfile } from '../../contracts/appearanceProfile'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'
import {
  getActiveThemeCardColorSettings,
  getDefaultCardColorPresets,
  resolveCardColors,
} from './cardColorPalette'
import { getAppearanceStyleTokens } from './stylePresets'
import {
  resolveSurfaceShadowStyle,
  resolveSurfaceTransparency,
} from './surfaceEffects'

type SurfaceStyleEntity = {
  borderColor?: string
  borderPresetIndex?: number
  fillColor?: string
  fillPresetIndex?: number
  shadowStyle?: SurfaceShadowStyle
  surfaceTransparency?: SurfaceTransparency
}

type SurfaceStyleDrafts = {
  borderColorDraft: string | null
  borderPresetIndexDraft: number | null
  fillColorDraft: string | null
  fillPresetIndexDraft: number | null
}

type SurfaceStyleArgs = {
  appearance: AppearanceProfile
  drafts: SurfaceStyleDrafts
  entity: SurfaceStyleEntity
}

export function getSurfaceStyles({
  appearance,
  drafts,
  entity,
}: SurfaceStyleArgs) {
  const defaultColorPresets = getDefaultCardColorPresets(
    appearance.stylePreset,
    appearance.themeMode,
  )
  const activeColorSettings = getActiveThemeCardColorSettings(appearance)
  const appearanceTokens = getAppearanceStyleTokens(
    appearance.stylePreset,
    appearance.themeMode,
  )
  const resolvedColors = resolveCardColors(entity, appearance, {
    fillColor: appearanceTokens.cardBg,
    borderColor: appearanceTokens.cardBorder,
  })
  const resolvedSurfaceTransparency = resolveSurfaceTransparency(
    entity.surfaceTransparency,
    appearance,
  )
  const resolvedShadowStyle = resolveSurfaceShadowStyle(
    entity.shadowStyle,
    appearance,
  )
  const selectedFillColor =
    drafts.fillPresetIndexDraft !== null
      ? (activeColorSettings.fillPresets[drafts.fillPresetIndexDraft] ?? null)
      : drafts.fillColorDraft
  const selectedBorderColor =
    drafts.borderPresetIndexDraft !== null
      ? (activeColorSettings.borderPresets[drafts.borderPresetIndexDraft] ??
        null)
      : drafts.borderColorDraft

  return {
    activeColorSettings,
    defaultColorPresets,
    resolvedColors,
    resolvedShadowStyle,
    resolvedSurfaceTransparency,
    selectedBorderColor,
    selectedFillColor,
  }
}

export function useSurfaceStyles({
  appearance,
  drafts,
  entity,
}: SurfaceStyleArgs) {
  return getSurfaceStyles({ appearance, drafts, entity })
}
