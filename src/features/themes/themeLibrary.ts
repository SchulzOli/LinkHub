import type { AppearanceProfile } from '../../contracts/appearanceProfile'
import {
  THEME_DOCUMENT_FORMAT,
  THEME_DOCUMENT_VERSION,
  ThemeDocumentSchema,
  type ThemeContent,
  type ThemeDocument,
} from '../../contracts/theme'
import { createId } from '../../utils/id'

export function applyThemeToAppearance(
  appearance: AppearanceProfile,
  themeId: string,
  content: ThemeContent,
): AppearanceProfile {
  return {
    ...appearance,
    activeThemeId: themeId,
    styleTokens: {
      light: { ...content.tokens.light },
      dark: { ...content.tokens.dark },
    },
    defaultCardSize: content.cardDefaults.defaultCardSize,
    defaultCardCornerRadius: content.cardDefaults.defaultCardCornerRadius,
    defaultCardShowTitle: content.cardDefaults.defaultCardShowTitle,
    defaultCardShowImage: content.cardDefaults.defaultCardShowImage,
    defaultCardOpenInNewTab: content.cardDefaults.defaultCardOpenInNewTab,
    defaultSurfaceTransparency: content.cardDefaults.defaultSurfaceTransparency,
    defaultSurfaceShadowStyle: content.cardDefaults.defaultSurfaceShadowStyle,
    fillPresetsByTheme: {
      light: [...content.colorPresets.fillPresetsByTheme.light],
      dark: [...content.colorPresets.fillPresetsByTheme.dark],
    },
    borderPresetsByTheme: {
      light: [...content.colorPresets.borderPresetsByTheme.light],
      dark: [...content.colorPresets.borderPresetsByTheme.dark],
    },
    defaultFillPresetIndexByTheme: {
      ...content.colorPresets.defaultFillPresetIndexByTheme,
    },
    defaultBorderPresetIndexByTheme: {
      ...content.colorPresets.defaultBorderPresetIndexByTheme,
    },
  }
}

export function createThemeFromAppearance(
  appearance: AppearanceProfile,
  name: string,
  description?: string,
): ThemeDocument {
  const now = new Date().toISOString()

  return {
    format: THEME_DOCUMENT_FORMAT,
    version: THEME_DOCUMENT_VERSION,
    id: createId(),
    name: name.trim(),
    description: description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    content: {
      tokens: {
        light: { ...appearance.styleTokens.light },
        dark: { ...appearance.styleTokens.dark },
      },
      cardDefaults: {
        defaultCardSize: appearance.defaultCardSize,
        defaultCardCornerRadius: appearance.defaultCardCornerRadius,
        defaultCardShowTitle: appearance.defaultCardShowTitle,
        defaultCardShowImage: appearance.defaultCardShowImage,
        defaultCardOpenInNewTab: appearance.defaultCardOpenInNewTab,
        defaultSurfaceTransparency: appearance.defaultSurfaceTransparency,
        defaultSurfaceShadowStyle: appearance.defaultSurfaceShadowStyle,
      },
      colorPresets: {
        fillPresetsByTheme: {
          light: [...appearance.fillPresetsByTheme.light],
          dark: [...appearance.fillPresetsByTheme.dark],
        },
        borderPresetsByTheme: {
          light: [...appearance.borderPresetsByTheme.light],
          dark: [...appearance.borderPresetsByTheme.dark],
        },
        defaultFillPresetIndexByTheme: {
          ...appearance.defaultFillPresetIndexByTheme,
        },
        defaultBorderPresetIndexByTheme: {
          ...appearance.defaultBorderPresetIndexByTheme,
        },
      },
    },
  }
}

export function duplicateTheme(theme: ThemeDocument): ThemeDocument {
  const now = new Date().toISOString()

  return {
    ...theme,
    id: createId(),
    name: `${theme.name} copy`,
    createdAt: now,
    updatedAt: now,
  }
}

export function parseThemeFile(raw: unknown): ThemeDocument | null {
  const parsed = ThemeDocumentSchema.safeParse(raw)

  return parsed.success ? parsed.data : null
}
