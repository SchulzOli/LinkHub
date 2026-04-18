import { z } from 'zod'

import {
  CARD_COLOR_PRESET_COUNT,
  CardColorHexSchema,
  CardColorPresetIndexSchema,
} from './cardColors'
import { CardCornerRadiusSchema, CardSizeSchema } from './linkCard'
import {
  SurfaceShadowStyleSchema,
  SurfaceTransparencySchema,
} from './surfaceEffects'

export const THEME_DOCUMENT_FORMAT = 'linkhub.theme'
export const THEME_DOCUMENT_VERSION = 1

export const BUILTIN_THEME_PREFIX = 'builtin:'

export const StyleTokensSchema = z.object({
  uiFont: z.string(),
  bgCanvas: z.string(),
  bgShell: z.string(),
  panelBg: z.string(),
  panelBorder: z.string(),
  panelShadow: z.string(),
  cardBg: z.string(),
  cardBorder: z.string(),
  inputBg: z.string(),
  inputBorder: z.string(),
  gridColor: z.string(),
  textPrimary: z.string(),
  textMuted: z.string(),
  accent: z.string(),
  accentStrong: z.string(),
  buttonHoverBg: z.string(),
  buttonActiveBg: z.string(),
  menuBg: z.string(),
  menuBorder: z.string(),
  menuShadow: z.string(),
  menuItemHoverBg: z.string(),
  tabBg: z.string(),
  tabActiveBg: z.string(),
  tabActiveBorder: z.string(),
  focusRing: z.string(),
  radiusSm: z.string(),
  radiusMd: z.string(),
  radiusLg: z.string(),
})

export const ThemeTokensByModeSchema = z.object({
  light: StyleTokensSchema,
  dark: StyleTokensSchema,
})

export const CardColorPresetRowSchema = z
  .array(CardColorHexSchema)
  .length(CARD_COLOR_PRESET_COUNT)

export const ThemeColorPresetMapSchema = z.object({
  light: CardColorPresetRowSchema,
  dark: CardColorPresetRowSchema,
})

export const ThemePresetIndexMapSchema = z.object({
  light: CardColorPresetIndexSchema,
  dark: CardColorPresetIndexSchema,
})

export const ThemeCardDefaultsSchema = z.object({
  defaultCardSize: CardSizeSchema,
  defaultCardCornerRadius: CardCornerRadiusSchema,
  defaultCardShowTitle: z.boolean(),
  defaultCardShowImage: z.boolean(),
  defaultCardOpenInNewTab: z.boolean(),
  defaultSurfaceTransparency: SurfaceTransparencySchema,
  defaultSurfaceShadowStyle: SurfaceShadowStyleSchema,
})

export const ThemeColorPresetsSchema = z.object({
  fillPresetsByTheme: ThemeColorPresetMapSchema,
  borderPresetsByTheme: ThemeColorPresetMapSchema,
  defaultFillPresetIndexByTheme: ThemePresetIndexMapSchema,
  defaultBorderPresetIndexByTheme: ThemePresetIndexMapSchema,
})

export const ThemeContentSchema = z.object({
  tokens: ThemeTokensByModeSchema,
  cardDefaults: ThemeCardDefaultsSchema,
  colorPresets: ThemeColorPresetsSchema,
})

export const ThemeDocumentSchema = z.object({
  format: z.literal(THEME_DOCUMENT_FORMAT),
  version: z.literal(THEME_DOCUMENT_VERSION),
  id: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().max(400).optional(),
  author: z.string().trim().max(100).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  content: ThemeContentSchema,
})

export type StyleTokensByMode = z.infer<typeof ThemeTokensByModeSchema>
export type ThemeCardDefaults = z.infer<typeof ThemeCardDefaultsSchema>
export type ThemeColorPresets = z.infer<typeof ThemeColorPresetsSchema>
export type ThemeContent = z.infer<typeof ThemeContentSchema>
export type ThemeDocument = z.infer<typeof ThemeDocumentSchema>

export function isBuiltinThemeId(themeId: string) {
  return themeId.startsWith(BUILTIN_THEME_PREFIX)
}
