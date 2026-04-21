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

const lightExcalidrawTokens: AppearanceStyleTokens = {
  uiFont: 'Assistant, "Segoe UI", system-ui, sans-serif',
  bgCanvas: '#ffffff',
  bgShell: '#f6f6f9',
  panelBg: 'rgba(255, 255, 255, 0.96)',
  panelBorder: '#d9d8ec',
  panelShadow:
    '0 0 1px rgba(0, 0, 0, 0.17), 0 0 3px rgba(0, 0, 0, 0.08), 0 7px 14px rgba(0, 0, 0, 0.05)',
  cardBg: '#ffffff',
  cardBorder: '#d9d8ec',
  inputBg: '#ffffff',
  inputBorder: '#d9d8ec',
  gridColor: 'rgba(18, 18, 18, 0.08)',
  textPrimary: '#1f1f25',
  textMuted: '#6f6a86',
  accent: '#6965db',
  accentStrong: '#4e49bf',
  buttonHoverBg: '#f1f0ff',
  buttonActiveBg: '#e7e5ff',
  menuBg: 'rgba(255, 255, 255, 0.98)',
  menuBorder: '#d9d8ec',
  menuShadow:
    '0 10px 30px rgba(17, 16, 44, 0.12), 0 2px 10px rgba(17, 16, 44, 0.08)',
  menuItemHoverBg: '#f1f0ff',
  tabBg: '#ececf4',
  tabActiveBg: '#ffffff',
  tabActiveBorder: '#6965db',
  focusRing: 'rgba(105, 101, 219, 0.22)',
  radiusSm: '0.5rem',
  radiusMd: '0.625rem',
  radiusLg: '0.875rem',
}

const darkExcalidrawTokens: AppearanceStyleTokens = {
  uiFont: 'Assistant, "Segoe UI", system-ui, sans-serif',
  bgCanvas: '#121212',
  bgShell: '#1c1c22',
  panelBg: 'rgba(35, 35, 41, 0.96)',
  panelBorder: '#3a3947',
  panelShadow: '0 20px 44px rgba(0, 0, 0, 0.48), 0 4px 10px rgba(0, 0, 0, 0.2)',
  cardBg: '#232329',
  cardBorder: '#3a3947',
  inputBg: '#1c1c22',
  inputBorder: '#3a3947',
  gridColor: 'rgba(227, 227, 232, 0.07)',
  textPrimary: '#e3e3e8',
  textMuted: '#c4c3d4',
  accent: '#a8a5ff',
  accentStrong: '#cac8ff',
  buttonHoverBg: '#2e2d39',
  buttonActiveBg: '#3b3a49',
  menuBg: 'rgba(35, 35, 41, 0.98)',
  menuBorder: '#3a3947',
  menuShadow: '0 22px 50px rgba(0, 0, 0, 0.5), 0 6px 14px rgba(0, 0, 0, 0.24)',
  menuItemHoverBg: '#2e2d39',
  tabBg: '#1a1a20',
  tabActiveBg: '#2e2d39',
  tabActiveBorder: '#a8a5ff',
  focusRing: 'rgba(168, 165, 255, 0.24)',
  radiusSm: '0.5rem',
  radiusMd: '0.625rem',
  radiusLg: '0.875rem',
}

const lightBlueprintTokens: AppearanceStyleTokens = {
  uiFont: '"Aptos", "Segoe UI", system-ui, sans-serif',
  bgCanvas: '#eef5fb',
  bgShell: '#dfeaf5',
  panelBg: 'rgba(248, 251, 255, 0.94)',
  panelBorder: 'rgba(21, 63, 102, 0.18)',
  panelShadow: '0 18px 36px rgba(24, 65, 105, 0.14)',
  cardBg: 'rgba(255, 255, 255, 0.96)',
  cardBorder: 'rgba(21, 63, 102, 0.16)',
  inputBg: '#ffffff',
  inputBorder: 'rgba(24, 73, 117, 0.2)',
  gridColor: 'rgba(44, 110, 167, 0.12)',
  textPrimary: '#16334d',
  textMuted: '#4f6c87',
  accent: '#1274c4',
  accentStrong: '#0a5998',
  buttonHoverBg: '#ddefff',
  buttonActiveBg: '#cbe6ff',
  menuBg: 'rgba(248, 251, 255, 0.98)',
  menuBorder: 'rgba(21, 63, 102, 0.18)',
  menuShadow: '0 24px 52px rgba(24, 65, 105, 0.16)',
  menuItemHoverBg: '#ddefff',
  tabBg: '#e2edf8',
  tabActiveBg: '#ffffff',
  tabActiveBorder: '#1274c4',
  focusRing: 'rgba(18, 116, 196, 0.22)',
  radiusSm: '0.75rem',
  radiusMd: '1rem',
  radiusLg: '1.25rem',
}

const darkBlueprintTokens: AppearanceStyleTokens = {
  uiFont: '"Aptos", "Segoe UI", system-ui, sans-serif',
  bgCanvas: '#09131d',
  bgShell: '#0f1c29',
  panelBg: 'rgba(15, 28, 41, 0.94)',
  panelBorder: 'rgba(127, 184, 235, 0.18)',
  panelShadow: '0 24px 48px rgba(0, 0, 0, 0.42)',
  cardBg: 'rgba(17, 33, 47, 0.96)',
  cardBorder: 'rgba(127, 184, 235, 0.18)',
  inputBg: '#11212f',
  inputBorder: 'rgba(127, 184, 235, 0.18)',
  gridColor: 'rgba(95, 169, 233, 0.12)',
  textPrimary: '#e6f1fb',
  textMuted: '#9cb6cf',
  accent: '#7fc0ff',
  accentStrong: '#b6dcff',
  buttonHoverBg: '#193247',
  buttonActiveBg: '#214562',
  menuBg: 'rgba(15, 28, 41, 0.98)',
  menuBorder: 'rgba(127, 184, 235, 0.18)',
  menuShadow: '0 26px 54px rgba(0, 0, 0, 0.5)',
  menuItemHoverBg: '#193247',
  tabBg: '#102131',
  tabActiveBg: '#193247',
  tabActiveBorder: '#7fc0ff',
  focusRing: 'rgba(127, 192, 255, 0.24)',
  radiusSm: '0.75rem',
  radiusMd: '1rem',
  radiusLg: '1.25rem',
}

export const APPEARANCE_STYLE_PRESETS: Record<
  StylePreset,
  AppearanceStyleDefinition
> = {
  excalidraw: {
    label: 'Excalidraw',
    description: 'Soft island surfaces and the Excalidraw purple accent.',
    modes: {
      light: lightExcalidrawTokens,
      dark: darkExcalidrawTokens,
    },
  },
  blueprint: {
    label: 'Blueprint',
    description: 'Cooler drafting surfaces with brighter canvas contrast.',
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
