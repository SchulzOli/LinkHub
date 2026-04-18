import { z } from 'zod'

import {
  getDefaultCardColorPresetMap,
  getDefaultCardPresetIndex,
} from '../features/appearance/cardColorPalette'
import { APPEARANCE_STYLE_PRESETS } from '../features/appearance/stylePresets'
import {
  CardCornerRadiusSchema,
  CardSizeSchema,
  DEFAULT_CARD_CORNER_RADIUS,
  DEFAULT_CARD_SIZE,
  type CardSize,
} from './linkCard'
import {
  DEFAULT_SURFACE_SHADOW_STYLE,
  DEFAULT_SURFACE_TRANSPARENCY,
  SurfaceShadowStyleSchema,
  SurfaceTransparencySchema,
} from './surfaceEffects'
import {
  CardColorPresetRowSchema,
  ThemeColorPresetMapSchema,
  ThemePresetIndexMapSchema,
  ThemeTokensByModeSchema,
} from './theme'

export {
  CardColorPresetRowSchema,
  ThemeColorPresetMapSchema,
  ThemePresetIndexMapSchema,
}

export const ThemeModeSchema = z.enum(['light', 'dark'])
export const StylePresetSchema = z.enum(['excalidraw', 'blueprint'])

export const AppearanceProfileSchema = z.object({
  themeMode: ThemeModeSchema,
  defaultCardSize: CardSizeSchema,
  defaultCardCornerRadius: CardCornerRadiusSchema,
  defaultCardShowTitle: z.boolean(),
  defaultCardShowImage: z.boolean(),
  defaultCardOpenInNewTab: z.boolean(),
  defaultSurfaceTransparency: SurfaceTransparencySchema,
  defaultSurfaceShadowStyle: SurfaceShadowStyleSchema,
  stylePreset: StylePresetSchema,
  contrastPreset: z.literal('high-contrast'),
  fillPresetsByTheme: ThemeColorPresetMapSchema,
  borderPresetsByTheme: ThemeColorPresetMapSchema,
  defaultFillPresetIndexByTheme: ThemePresetIndexMapSchema,
  defaultBorderPresetIndexByTheme: ThemePresetIndexMapSchema,
  activeThemeId: z.string().nullable(),
  styleTokens: ThemeTokensByModeSchema,
})

export type ThemeMode = z.infer<typeof ThemeModeSchema>
export type StylePreset = z.infer<typeof StylePresetSchema>
export type AppearanceProfile = z.infer<typeof AppearanceProfileSchema>
export type { CardSize }

const defaultCardColorPresetMap = getDefaultCardColorPresetMap('excalidraw')
const defaultStyleTokens = APPEARANCE_STYLE_PRESETS.excalidraw.modes

export const defaultAppearanceProfile: AppearanceProfile = {
  themeMode: 'dark',
  defaultCardSize: DEFAULT_CARD_SIZE,
  defaultCardCornerRadius: DEFAULT_CARD_CORNER_RADIUS,
  defaultCardShowTitle: true,
  defaultCardShowImage: true,
  defaultCardOpenInNewTab: true,
  defaultSurfaceTransparency: DEFAULT_SURFACE_TRANSPARENCY,
  defaultSurfaceShadowStyle: DEFAULT_SURFACE_SHADOW_STYLE,
  stylePreset: 'excalidraw',
  contrastPreset: 'high-contrast',
  fillPresetsByTheme: {
    light: [...defaultCardColorPresetMap.light.fillPresets],
    dark: [...defaultCardColorPresetMap.dark.fillPresets],
  },
  borderPresetsByTheme: {
    light: [...defaultCardColorPresetMap.light.borderPresets],
    dark: [...defaultCardColorPresetMap.dark.borderPresets],
  },
  defaultFillPresetIndexByTheme: {
    light: getDefaultCardPresetIndex(),
    dark: getDefaultCardPresetIndex(),
  },
  defaultBorderPresetIndexByTheme: {
    light: getDefaultCardPresetIndex(),
    dark: getDefaultCardPresetIndex(),
  },
  activeThemeId: 'builtin:excalidraw',
  styleTokens: {
    light: { ...defaultStyleTokens.light },
    dark: { ...defaultStyleTokens.dark },
  },
}

export function resetAppearanceNonColorOptions(
  appearance: AppearanceProfile,
): AppearanceProfile {
  return {
    ...defaultAppearanceProfile,
    fillPresetsByTheme: appearance.fillPresetsByTheme,
    borderPresetsByTheme: appearance.borderPresetsByTheme,
    defaultFillPresetIndexByTheme: appearance.defaultFillPresetIndexByTheme,
    defaultBorderPresetIndexByTheme: appearance.defaultBorderPresetIndexByTheme,
  }
}
