import type { z } from 'zod'
import type {
  AppearanceProfile,
  StylePreset,
  ThemeMode,
} from '../../contracts/appearanceProfile'
import type { StyleTokensSchema } from '../../contracts/theme'

export type AppearanceStyleTokens = z.infer<typeof StyleTokensSchema>

export interface AppearanceStyleDefinition {
  label: string
  description: string
  modes: Record<ThemeMode, AppearanceStyleTokens>
}

export const UI_FONT_SANS =
  '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif'
export const UI_FONT_MONO =
  '"JetBrains Mono", "Cascadia Code", ui-monospace, "SFMono-Regular", Menlo, monospace'

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value
  const red = parseInt(full.slice(0, 2), 16)
  const green = parseInt(full.slice(2, 4), 16)
  const blue = parseInt(full.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export type StyleTokenSeed = {
  mode: ThemeMode
  /** Canvas background. */
  canvas: string
  /** App chrome behind the canvas (taskbar backdrop, shell). */
  shell: string
  /** Panels, menus, cards. */
  surface: string
  /** Hairline borders. */
  border: string
  /** Slightly stronger border for inputs. */
  inputBorder?: string
  text: string
  muted: string
  accent: string
  accentStrong: string
  /** Hover / pressed fills for buttons and menu items. */
  hover: string
  active: string
  grid: string
  font?: string
  radius?: { sm: string; md: string; lg: string }
  /** Override for tinted shadows (rgb triplet), defaults to neutral. */
  shadowTint?: string
}

const DEFAULT_RADIUS = { sm: '0.5rem', md: '0.75rem', lg: '1rem' }

/**
 * Builds a complete token set from a small seed so every theme shares the
 * same structure: hairline borders, soft layered shadows, one accent.
 */
export function createStyleTokens(seed: StyleTokenSeed): AppearanceStyleTokens {
  const radius = seed.radius ?? DEFAULT_RADIUS
  const tint =
    seed.shadowTint ?? (seed.mode === 'dark' ? '0, 0, 0' : '16, 24, 40')
  const isDark = seed.mode === 'dark'

  return {
    uiFont: seed.font ?? UI_FONT_SANS,
    bgCanvas: seed.canvas,
    bgShell: seed.shell,
    panelBg: seed.surface,
    panelBorder: seed.border,
    panelShadow: isDark
      ? `0 1px 2px rgba(${tint}, 0.4), 0 12px 32px -8px rgba(${tint}, 0.6)`
      : `0 1px 2px rgba(${tint}, 0.05), 0 12px 32px -8px rgba(${tint}, 0.14)`,
    cardBg: seed.surface,
    cardBorder: seed.border,
    inputBg: seed.surface,
    inputBorder: seed.inputBorder ?? seed.border,
    gridColor: seed.grid,
    textPrimary: seed.text,
    textMuted: seed.muted,
    accent: seed.accent,
    accentStrong: seed.accentStrong,
    buttonHoverBg: seed.hover,
    buttonActiveBg: seed.active,
    menuBg: seed.surface,
    menuBorder: seed.border,
    menuShadow: isDark
      ? `0 2px 6px rgba(${tint}, 0.4), 0 24px 56px -12px rgba(${tint}, 0.7)`
      : `0 2px 6px rgba(${tint}, 0.05), 0 24px 56px -12px rgba(${tint}, 0.2)`,
    menuItemHoverBg: seed.hover,
    tabBg: seed.hover,
    tabActiveBg: seed.surface,
    tabActiveBorder: seed.accent,
    focusRing: hexToRgba(seed.accent, isDark ? 0.32 : 0.24),
    radiusSm: radius.sm,
    radiusMd: radius.md,
    radiusLg: radius.lg,
  }
}

const lightExcalidrawTokens = createStyleTokens({
  mode: 'light',
  canvas: '#fafafb',
  shell: '#f4f4f6',
  surface: '#ffffff',
  border: '#e6e6ec',
  inputBorder: '#dcdce4',
  text: '#18181b',
  muted: '#6b6b76',
  accent: '#6965db',
  accentStrong: '#4f4ac4',
  hover: '#f4f4f7',
  active: '#ececf1',
  grid: 'rgba(24, 24, 27, 0.045)',
})

const darkExcalidrawTokens = createStyleTokens({
  mode: 'dark',
  canvas: '#0f0f12',
  shell: '#141418',
  surface: '#1a1a1f',
  border: '#2a2a31',
  inputBorder: '#33333b',
  text: '#ededf0',
  muted: '#9b9ba6',
  accent: '#a8a5ff',
  accentStrong: '#c9c7ff',
  hover: '#232329',
  active: '#2c2c33',
  grid: 'rgba(237, 237, 240, 0.045)',
})

const lightBlueprintTokens = createStyleTokens({
  mode: 'light',
  canvas: '#f6f9fc',
  shell: '#eef3f8',
  surface: '#ffffff',
  border: '#e1e8f0',
  inputBorder: '#d5dfea',
  text: '#0f2133',
  muted: '#5b6b7d',
  accent: '#2563eb',
  accentStrong: '#1d4ed8',
  hover: '#f0f5fb',
  active: '#e5edf7',
  grid: 'rgba(37, 99, 235, 0.07)',
  shadowTint: '15, 33, 51',
})

const darkBlueprintTokens = createStyleTokens({
  mode: 'dark',
  canvas: '#0a1018',
  shell: '#0d1520',
  surface: '#111b27',
  border: '#1f2c3b',
  inputBorder: '#273748',
  text: '#e6eef7',
  muted: '#8ea2b8',
  accent: '#60a5fa',
  accentStrong: '#93c5fd',
  hover: '#172433',
  active: '#1d2d3f',
  grid: 'rgba(96, 165, 250, 0.07)',
})

export const APPEARANCE_STYLE_PRESETS: Record<
  StylePreset,
  AppearanceStyleDefinition
> = {
  excalidraw: {
    label: 'Excalidraw',
    description: 'Clean neutral surfaces with the Excalidraw violet accent.',
    modes: {
      light: lightExcalidrawTokens,
      dark: darkExcalidrawTokens,
    },
  },
  blueprint: {
    label: 'Blueprint',
    description: 'Cool drafting tones with a crisp blue accent.',
    modes: {
      light: lightBlueprintTokens,
      dark: darkBlueprintTokens,
    },
  },
}

const CSS_VARIABLE_BY_TOKEN_KEY: Record<keyof AppearanceStyleTokens, string> = {
  uiFont: '--ui-font',
  bgCanvas: '--bg-canvas',
  bgShell: '--bg-shell',
  panelBg: '--panel-bg',
  panelBorder: '--panel-border',
  panelShadow: '--panel-shadow',
  cardBg: '--card-bg',
  cardBorder: '--card-border',
  inputBg: '--input-bg',
  inputBorder: '--input-border',
  gridColor: '--grid-color',
  textPrimary: '--text-primary',
  textMuted: '--text-muted',
  accent: '--accent',
  accentStrong: '--accent-strong',
  buttonHoverBg: '--button-hover-bg',
  buttonActiveBg: '--button-active-bg',
  menuBg: '--menu-bg',
  menuBorder: '--menu-border',
  menuShadow: '--menu-shadow',
  menuItemHoverBg: '--menu-item-hover-bg',
  tabBg: '--tab-bg',
  tabActiveBg: '--tab-active-bg',
  tabActiveBorder: '--tab-active-border',
  focusRing: '--focus-ring',
  radiusSm: '--radius-sm',
  radiusMd: '--radius-md',
  radiusLg: '--radius-lg',
}

export function getAppearanceStyleTokens(
  stylePreset: StylePreset,
  themeMode: ThemeMode,
) {
  return APPEARANCE_STYLE_PRESETS[stylePreset].modes[themeMode]
}

export function applyAppearanceStyle(
  root: HTMLElement,
  appearance: Pick<
    AppearanceProfile,
    'stylePreset' | 'themeMode' | 'styleTokens'
  >,
) {
  root.dataset.stylePreset = appearance.stylePreset
  root.dataset.themeMode = appearance.themeMode

  const tokens = appearance.styleTokens
    ? appearance.styleTokens[appearance.themeMode]
    : getAppearanceStyleTokens(appearance.stylePreset, appearance.themeMode)

  ;(
    Object.keys(CSS_VARIABLE_BY_TOKEN_KEY) as Array<keyof AppearanceStyleTokens>
  ).forEach((tokenKey) => {
    root.style.setProperty(
      CSS_VARIABLE_BY_TOKEN_KEY[tokenKey],
      tokens[tokenKey],
    )
  })
}
