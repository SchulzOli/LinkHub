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
      fillPresets: ['#ffffff', '#f3f2ff', '#eef5ff', '#ecfaf5', '#fff0f3'],
      borderPresets: ['#e6e6ec', '#6965db', '#5b8def', '#3fae8c', '#e5718f'],
    },
    dark: {
      fillPresets: ['#1a1a1f', '#25233a', '#1c2738', '#182c27', '#2e1d25'],
      borderPresets: ['#2a2a31', '#a8a5ff', '#7aa7ff', '#5cc6a7', '#ff8fae'],
    },
  },
  blueprint: {
    light: {
      fillPresets: ['#ffffff', '#ebf2ff', '#e8f8fb', '#ebf8f0', '#fff4e8'],
      borderPresets: ['#e1e8f0', '#2563eb', '#0ea5c6', '#22a06b', '#e08a2e'],
    },
    dark: {
      fillPresets: ['#111b27', '#142640', '#112e36', '#122c24', '#2c2117'],
      borderPresets: ['#1f2c3b', '#60a5fa', '#38bdf8', '#4ade80', '#fbbf24'],
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

/**
 * A stored hex colour that is one of the theme presets (light or dark,
 * current or built-in palette) is treated as that preset slot, so it follows
 * the light/dark switch. Older workspaces, the custom colour input and the
 * format painter can store such a hex instead of the preset index.
 */
export function findPresetSlotForColor(
  color: string | undefined,
  kind: 'fill' | 'border',
  appearance: Pick<
    AppearanceProfile,
    'fillPresetsByTheme' | 'borderPresetsByTheme'
  >,
): number | undefined {
  if (!color) {
    return undefined
  }

  const needle = color.trim().toLowerCase()
  const stored =
    kind === 'fill'
      ? appearance.fillPresetsByTheme
      : appearance.borderPresetsByTheme
  const builtin = (Object.keys(CARD_COLOR_PRESETS) as StylePreset[]).flatMap(
    (preset) =>
      (['light', 'dark'] as const).map((mode) =>
        kind === 'fill'
          ? CARD_COLOR_PRESETS[preset][mode].fillPresets
          : CARD_COLOR_PRESETS[preset][mode].borderPresets,
      ),
  )

  // Themes may reuse a hex in several slots. Only an unambiguous match is a
  // preset; anything else stays a custom colour.
  const slots = new Set<number>()

  for (const row of [stored.light, stored.dark, ...builtin]) {
    row.forEach((entry, index) => {
      if (entry.toLowerCase() === needle) {
        slots.add(index)
      }
    })
  }

  return slots.size === 1 ? [...slots][0] : undefined
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
  const fillIndex =
    card.fillPresetIndex ??
    findPresetSlotForColor(card.fillColor, 'fill', appearance)
  const borderIndex =
    card.borderPresetIndex ??
    findPresetSlotForColor(card.borderColor, 'border', appearance)

  return {
    fillColor:
      (typeof fillIndex === 'number'
        ? activeSettings.fillPresets[fillIndex]
        : undefined) ??
      card.fillColor ??
      fallback.fillColor,
    borderColor:
      (typeof borderIndex === 'number'
        ? activeSettings.borderPresets[borderIndex]
        : undefined) ??
      card.borderColor ??
      fallback.borderColor,
  }
}
