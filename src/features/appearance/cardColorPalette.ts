import type {
  AppearanceProfile,
  StylePreset,
  ThemeMode,
} from '../../contracts/appearanceProfile'
import { DEFAULT_CARD_COLOR_PRESET_INDEX } from '../../contracts/cardColors'
import type { LinkCard } from '../../contracts/linkCard'

type CardColorPresetBundle = {
  fillPresets: [string, string, string, string, string]
  borderPresets: [string, string, string, string, string]
}

const CARD_COLOR_PRESETS: Record<
  StylePreset,
  Record<ThemeMode, CardColorPresetBundle>
> = {
  excalidraw: {
    light: {
      fillPresets: ['#ffffff', '#f4efff', '#edf4ff', '#eefbf7', '#fff0f4'],
      borderPresets: ['#d9d8ec', '#8a78ff', '#78a9ff', '#4eb79a', '#ef7fa2'],
    },
    dark: {
      fillPresets: ['#232329', '#312b47', '#24364a', '#1f3a35', '#402733'],
      borderPresets: ['#3a3947', '#b1a5ff', '#88b6ff', '#66c7b5', '#ff9db9'],
    },
  },
  blueprint: {
    light: {
      fillPresets: ['#ffffff', '#e8f2ff', '#e6fbff', '#eef9f2', '#fff3e8'],
      borderPresets: ['#8eb6de', '#1274c4', '#1ca6c9', '#4da46f', '#d28a32'],
    },
    dark: {
      fillPresets: ['#11212f', '#17324a', '#153946', '#17372f', '#3b2b1f'],
      borderPresets: ['#7fb8eb', '#7fc0ff', '#72d2ea', '#71c08f', '#e0a65f'],
    },
  },
}

export function getDefaultCardColorPresets(
  stylePreset: StylePreset,
  themeMode: ThemeMode,
) {
  const presets = CARD_COLOR_PRESETS[stylePreset][themeMode]

  return {
    fillPresets: [...presets.fillPresets],
    borderPresets: [...presets.borderPresets],
  }
}

export function getDefaultCardColorPresetMap(stylePreset: StylePreset) {
  return {
    light: getDefaultCardColorPresets(stylePreset, 'light'),
    dark: getDefaultCardColorPresets(stylePreset, 'dark'),
  }
}

export function getDefaultCardPresetIndex() {
  return DEFAULT_CARD_COLOR_PRESET_INDEX
}

export function getActiveThemeCardColorSettings(
  appearance: Pick<
    AppearanceProfile,
    | 'themeMode'
    | 'fillPresetsByTheme'
    | 'borderPresetsByTheme'
    | 'defaultFillPresetIndexByTheme'
    | 'defaultBorderPresetIndexByTheme'
  >,
) {
  return {
    fillPresets: appearance.fillPresetsByTheme[appearance.themeMode],
    borderPresets: appearance.borderPresetsByTheme[appearance.themeMode],
    defaultFillPresetIndex:
      appearance.defaultFillPresetIndexByTheme[appearance.themeMode],
    defaultBorderPresetIndex:
      appearance.defaultBorderPresetIndexByTheme[appearance.themeMode],
  }
}

export function getCardColorsFromAppearance(
  appearance: Pick<
    AppearanceProfile,
    | 'themeMode'
    | 'defaultFillPresetIndexByTheme'
    | 'defaultBorderPresetIndexByTheme'
    | 'defaultCardCornerRadius'
    | 'defaultCardShowTitle'
    | 'defaultCardShowImage'
    | 'defaultSurfaceTransparency'
    | 'defaultSurfaceShadowStyle'
  >,
) {
  return {
    fillPresetIndex:
      appearance.defaultFillPresetIndexByTheme[appearance.themeMode] ??
      getDefaultCardPresetIndex(),
    borderPresetIndex:
      appearance.defaultBorderPresetIndexByTheme[appearance.themeMode] ??
      getDefaultCardPresetIndex(),
    cornerRadius: appearance.defaultCardCornerRadius,
    showTitle: appearance.defaultCardShowTitle,
    showImage: appearance.defaultCardShowImage,
    surfaceTransparency: appearance.defaultSurfaceTransparency,
    shadowStyle: appearance.defaultSurfaceShadowStyle,
  }
}

export function resolveCardColors(
  card: Pick<
    LinkCard,
    'fillPresetIndex' | 'fillColor' | 'borderPresetIndex' | 'borderColor'
  >,
  appearance: Pick<
    AppearanceProfile,
    'themeMode' | 'fillPresetsByTheme' | 'borderPresetsByTheme'
  >,
  fallback: { fillColor: string; borderColor: string },
) {
  const activeSettings = getActiveThemeCardColorSettings({
    ...appearance,
    defaultFillPresetIndexByTheme: { light: 0, dark: 0 },
    defaultBorderPresetIndexByTheme: { light: 0, dark: 0 },
  })

  return {
    fillColor:
      (typeof card.fillPresetIndex === 'number'
        ? activeSettings.fillPresets[card.fillPresetIndex]
        : undefined) ??
      card.fillColor ??
      fallback.fillColor,
    borderColor:
      (typeof card.borderPresetIndex === 'number'
        ? activeSettings.borderPresets[card.borderPresetIndex]
        : undefined) ??
      card.borderColor ??
      fallback.borderColor,
  }
}
