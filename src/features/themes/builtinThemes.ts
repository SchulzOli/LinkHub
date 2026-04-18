import {
  DEFAULT_CARD_CORNER_RADIUS,
  DEFAULT_CARD_SIZE,
} from '../../contracts/linkCard'
import {
  DEFAULT_SURFACE_SHADOW_STYLE,
  DEFAULT_SURFACE_TRANSPARENCY,
} from '../../contracts/surfaceEffects'
import {
  BUILTIN_THEME_PREFIX,
  THEME_DOCUMENT_FORMAT,
  THEME_DOCUMENT_VERSION,
  type ThemeDocument,
} from '../../contracts/theme'
import {
  getDefaultCardColorPresetMap,
  getDefaultCardPresetIndex,
} from '../appearance/cardColorPalette'
import type { AppearanceStyleTokens } from '../appearance/stylePresets'
import { APPEARANCE_STYLE_PRESETS } from '../appearance/stylePresets'

function createBuiltinTheme(
  slug: string,
  name: string,
  description: string,
  tokens: { light: AppearanceStyleTokens; dark: AppearanceStyleTokens },
  colorPresets: {
    light: { fillPresets: string[]; borderPresets: string[] }
    dark: { fillPresets: string[]; borderPresets: string[] }
  },
): ThemeDocument {
  const defaultIndex = getDefaultCardPresetIndex()

  return {
    format: THEME_DOCUMENT_FORMAT,
    version: THEME_DOCUMENT_VERSION,
    id: `${BUILTIN_THEME_PREFIX}${slug}`,
    name,
    description,
    author: 'LinkHub',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    content: {
      tokens: { light: { ...tokens.light }, dark: { ...tokens.dark } },
      cardDefaults: {
        defaultCardSize: DEFAULT_CARD_SIZE,
        defaultCardCornerRadius: DEFAULT_CARD_CORNER_RADIUS,
        defaultCardShowTitle: true,
        defaultCardShowImage: true,
        defaultCardOpenInNewTab: true,
        defaultSurfaceTransparency: DEFAULT_SURFACE_TRANSPARENCY,
        defaultSurfaceShadowStyle: DEFAULT_SURFACE_SHADOW_STYLE,
      },
      colorPresets: {
        fillPresetsByTheme: {
          light: colorPresets.light.fillPresets as [
            string,
            string,
            string,
            string,
            string,
          ],
          dark: colorPresets.dark.fillPresets as [
            string,
            string,
            string,
            string,
            string,
          ],
        },
        borderPresetsByTheme: {
          light: colorPresets.light.borderPresets as [
            string,
            string,
            string,
            string,
            string,
          ],
          dark: colorPresets.dark.borderPresets as [
            string,
            string,
            string,
            string,
            string,
          ],
        },
        defaultFillPresetIndexByTheme: {
          light: defaultIndex,
          dark: defaultIndex,
        },
        defaultBorderPresetIndexByTheme: {
          light: defaultIndex,
          dark: defaultIndex,
        },
      },
    },
  }
}

// ── Minimal ──────────────────────────────────────────────

const lightMinimalTokens: AppearanceStyleTokens = {
  uiFont: '"Inter", "Segoe UI", system-ui, sans-serif',
  bgCanvas: '#ffffff',
  bgShell: '#fafafa',
  panelBg: 'rgba(255, 255, 255, 0.97)',
  panelBorder: '#e0e0e0',
  panelShadow: '0 1px 4px rgba(0, 0, 0, 0.06), 0 6px 16px rgba(0, 0, 0, 0.04)',
  cardBg: '#ffffff',
  cardBorder: '#e0e0e0',
  inputBg: '#ffffff',
  inputBorder: '#d4d4d4',
  gridColor: 'rgba(0, 0, 0, 0.05)',
  textPrimary: '#171717',
  textMuted: '#737373',
  accent: '#525252',
  accentStrong: '#262626',
  buttonHoverBg: '#f5f5f5',
  buttonActiveBg: '#e5e5e5',
  menuBg: 'rgba(255, 255, 255, 0.98)',
  menuBorder: '#e0e0e0',
  menuShadow: '0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
  menuItemHoverBg: '#f5f5f5',
  tabBg: '#f0f0f0',
  tabActiveBg: '#ffffff',
  tabActiveBorder: '#525252',
  focusRing: 'rgba(82, 82, 82, 0.2)',
  radiusSm: '0.375rem',
  radiusMd: '0.5rem',
  radiusLg: '0.625rem',
}

const darkMinimalTokens: AppearanceStyleTokens = {
  uiFont: '"Inter", "Segoe UI", system-ui, sans-serif',
  bgCanvas: '#0a0a0a',
  bgShell: '#141414',
  panelBg: 'rgba(23, 23, 23, 0.97)',
  panelBorder: '#2e2e2e',
  panelShadow: '0 1px 4px rgba(0, 0, 0, 0.24), 0 8px 20px rgba(0, 0, 0, 0.2)',
  cardBg: '#171717',
  cardBorder: '#2e2e2e',
  inputBg: '#141414',
  inputBorder: '#2e2e2e',
  gridColor: 'rgba(255, 255, 255, 0.04)',
  textPrimary: '#ededed',
  textMuted: '#a0a0a0',
  accent: '#a0a0a0',
  accentStrong: '#d4d4d4',
  buttonHoverBg: '#1f1f1f',
  buttonActiveBg: '#292929',
  menuBg: 'rgba(23, 23, 23, 0.98)',
  menuBorder: '#2e2e2e',
  menuShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2)',
  menuItemHoverBg: '#1f1f1f',
  tabBg: '#121212',
  tabActiveBg: '#1f1f1f',
  tabActiveBorder: '#a0a0a0',
  focusRing: 'rgba(160, 160, 160, 0.2)',
  radiusSm: '0.375rem',
  radiusMd: '0.5rem',
  radiusLg: '0.625rem',
}

// ── Nord ─────────────────────────────────────────────────

const lightNordTokens: AppearanceStyleTokens = {
  uiFont: '"Source Sans 3", "Segoe UI", system-ui, sans-serif',
  bgCanvas: '#eceff4',
  bgShell: '#e5e9f0',
  panelBg: 'rgba(236, 239, 244, 0.96)',
  panelBorder: '#d8dee9',
  panelShadow:
    '0 4px 14px rgba(46, 52, 64, 0.08), 0 1px 4px rgba(46, 52, 64, 0.06)',
  cardBg: '#eceff4',
  cardBorder: '#d8dee9',
  inputBg: '#eceff4',
  inputBorder: '#d8dee9',
  gridColor: 'rgba(46, 52, 64, 0.07)',
  textPrimary: '#2e3440',
  textMuted: '#4c566a',
  accent: '#5e81ac',
  accentStrong: '#4c6a93',
  buttonHoverBg: '#dfe4ed',
  buttonActiveBg: '#d3dae6',
  menuBg: 'rgba(236, 239, 244, 0.98)',
  menuBorder: '#d8dee9',
  menuShadow:
    '0 12px 28px rgba(46, 52, 64, 0.1), 0 2px 8px rgba(46, 52, 64, 0.06)',
  menuItemHoverBg: '#dfe4ed',
  tabBg: '#e0e5ee',
  tabActiveBg: '#eceff4',
  tabActiveBorder: '#5e81ac',
  focusRing: 'rgba(94, 129, 172, 0.22)',
  radiusSm: '0.5rem',
  radiusMd: '0.625rem',
  radiusLg: '0.875rem',
}

const darkNordTokens: AppearanceStyleTokens = {
  uiFont: '"Source Sans 3", "Segoe UI", system-ui, sans-serif',
  bgCanvas: '#2e3440',
  bgShell: '#3b4252',
  panelBg: 'rgba(59, 66, 82, 0.96)',
  panelBorder: '#434c5e',
  panelShadow: '0 8px 24px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.16)',
  cardBg: '#3b4252',
  cardBorder: '#434c5e',
  inputBg: '#3b4252',
  inputBorder: '#434c5e',
  gridColor: 'rgba(216, 222, 233, 0.06)',
  textPrimary: '#eceff4',
  textMuted: '#a4b5c9',
  accent: '#88c0d0',
  accentStrong: '#8fbcbb',
  buttonHoverBg: '#434c5e',
  buttonActiveBg: '#4c566a',
  menuBg: 'rgba(59, 66, 82, 0.98)',
  menuBorder: '#434c5e',
  menuShadow: '0 16px 36px rgba(0, 0, 0, 0.36), 0 4px 12px rgba(0, 0, 0, 0.2)',
  menuItemHoverBg: '#434c5e',
  tabBg: '#353c4a',
  tabActiveBg: '#434c5e',
  tabActiveBorder: '#88c0d0',
  focusRing: 'rgba(136, 192, 208, 0.24)',
  radiusSm: '0.5rem',
  radiusMd: '0.625rem',
  radiusLg: '0.875rem',
}

// ── Sunset ───────────────────────────────────────────────

const lightSunsetTokens: AppearanceStyleTokens = {
  uiFont: '"DM Sans", "Segoe UI", system-ui, sans-serif',
  bgCanvas: '#fdf8f3',
  bgShell: '#f7efe5',
  panelBg: 'rgba(253, 248, 243, 0.96)',
  panelBorder: '#e8d5be',
  panelShadow:
    '0 4px 14px rgba(120, 72, 30, 0.08), 0 1px 4px rgba(120, 72, 30, 0.05)',
  cardBg: '#fdf8f3',
  cardBorder: '#e8d5be',
  inputBg: '#fdf8f3',
  inputBorder: '#e0ccb3',
  gridColor: 'rgba(140, 90, 40, 0.07)',
  textPrimary: '#3d2510',
  textMuted: '#8c6d50',
  accent: '#c87f33',
  accentStrong: '#a8671e',
  buttonHoverBg: '#f2e6d6',
  buttonActiveBg: '#ebdbc7',
  menuBg: 'rgba(253, 248, 243, 0.98)',
  menuBorder: '#e8d5be',
  menuShadow:
    '0 12px 28px rgba(120, 72, 30, 0.1), 0 2px 8px rgba(120, 72, 30, 0.06)',
  menuItemHoverBg: '#f2e6d6',
  tabBg: '#f0e2d0',
  tabActiveBg: '#fdf8f3',
  tabActiveBorder: '#c87f33',
  focusRing: 'rgba(200, 127, 51, 0.22)',
  radiusSm: '0.625rem',
  radiusMd: '0.75rem',
  radiusLg: '1rem',
}

const darkSunsetTokens: AppearanceStyleTokens = {
  uiFont: '"DM Sans", "Segoe UI", system-ui, sans-serif',
  bgCanvas: '#1a120a',
  bgShell: '#241a10',
  panelBg: 'rgba(36, 26, 16, 0.96)',
  panelBorder: '#4a3520',
  panelShadow: '0 8px 24px rgba(0, 0, 0, 0.36), 0 2px 8px rgba(0, 0, 0, 0.2)',
  cardBg: '#2a1e12',
  cardBorder: '#4a3520',
  inputBg: '#241a10',
  inputBorder: '#4a3520',
  gridColor: 'rgba(200, 160, 100, 0.06)',
  textPrimary: '#f0e0cc',
  textMuted: '#b89a78',
  accent: '#e5a853',
  accentStrong: '#f0c878',
  buttonHoverBg: '#33261a',
  buttonActiveBg: '#3d2e20',
  menuBg: 'rgba(36, 26, 16, 0.98)',
  menuBorder: '#4a3520',
  menuShadow: '0 16px 36px rgba(0, 0, 0, 0.44), 0 4px 12px rgba(0, 0, 0, 0.24)',
  menuItemHoverBg: '#33261a',
  tabBg: '#1f1610',
  tabActiveBg: '#33261a',
  tabActiveBorder: '#e5a853',
  focusRing: 'rgba(229, 168, 83, 0.24)',
  radiusSm: '0.625rem',
  radiusMd: '0.75rem',
  radiusLg: '1rem',
}

// ── Neon ─────────────────────────────────────────────────

const lightNeonTokens: AppearanceStyleTokens = {
  uiFont: '"JetBrains Mono", "Cascadia Code", monospace',
  bgCanvas: '#f0f2f5',
  bgShell: '#e4e7ec',
  panelBg: 'rgba(240, 242, 245, 0.96)',
  panelBorder: '#c8cdd5',
  panelShadow: '0 4px 14px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04)',
  cardBg: '#f0f2f5',
  cardBorder: '#c8cdd5',
  inputBg: '#f0f2f5',
  inputBorder: '#c0c5ce',
  gridColor: 'rgba(0, 0, 0, 0.06)',
  textPrimary: '#0f1218',
  textMuted: '#5a6270',
  accent: '#0090ff',
  accentStrong: '#0070cc',
  buttonHoverBg: '#e0e4ea',
  buttonActiveBg: '#d0d5dd',
  menuBg: 'rgba(240, 242, 245, 0.98)',
  menuBorder: '#c8cdd5',
  menuShadow: '0 12px 28px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
  menuItemHoverBg: '#e0e4ea',
  tabBg: '#dce0e6',
  tabActiveBg: '#f0f2f5',
  tabActiveBorder: '#0090ff',
  focusRing: 'rgba(0, 144, 255, 0.22)',
  radiusSm: '0.25rem',
  radiusMd: '0.375rem',
  radiusLg: '0.5rem',
}

const darkNeonTokens: AppearanceStyleTokens = {
  uiFont: '"JetBrains Mono", "Cascadia Code", monospace',
  bgCanvas: '#0a0a0f',
  bgShell: '#0e0e16',
  panelBg: 'rgba(14, 14, 22, 0.96)',
  panelBorder: 'rgba(0, 255, 136, 0.15)',
  panelShadow:
    '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 12px rgba(0, 255, 136, 0.05)',
  cardBg: '#111118',
  cardBorder: 'rgba(0, 255, 136, 0.15)',
  inputBg: '#0e0e16',
  inputBorder: 'rgba(0, 255, 136, 0.18)',
  gridColor: 'rgba(0, 255, 136, 0.04)',
  textPrimary: '#e0e8f0',
  textMuted: '#7a8a98',
  accent: '#00ff88',
  accentStrong: '#66ffbb',
  buttonHoverBg: '#151520',
  buttonActiveBg: '#1c1c2a',
  menuBg: 'rgba(14, 14, 22, 0.98)',
  menuBorder: 'rgba(0, 255, 136, 0.15)',
  menuShadow:
    '0 16px 36px rgba(0, 0, 0, 0.5), 0 0 16px rgba(0, 255, 136, 0.06)',
  menuItemHoverBg: '#151520',
  tabBg: '#0c0c14',
  tabActiveBg: '#151520',
  tabActiveBorder: '#00ff88',
  focusRing: 'rgba(0, 255, 136, 0.2)',
  radiusSm: '0.25rem',
  radiusMd: '0.375rem',
  radiusLg: '0.5rem',
}

// ── Built-in theme catalog ────────────────────────────────

const excalidrawColors = {
  light: getDefaultCardColorPresetMap('excalidraw').light,
  dark: getDefaultCardColorPresetMap('excalidraw').dark,
}

const blueprintColors = {
  light: getDefaultCardColorPresetMap('blueprint').light,
  dark: getDefaultCardColorPresetMap('blueprint').dark,
}

const minimalColors = {
  light: {
    fillPresets: ['#ffffff', '#f5f5f5', '#e5e5e5', '#fafafa', '#f0f0f0'],
    borderPresets: ['#d4d4d4', '#737373', '#a0a0a0', '#8a8a8a', '#999999'],
  },
  dark: {
    fillPresets: ['#171717', '#1f1f1f', '#262626', '#1a1a1a', '#222222'],
    borderPresets: ['#404040', '#a0a0a0', '#666666', '#808080', '#555555'],
  },
}

const nordColors = {
  light: {
    fillPresets: ['#eceff4', '#e5e9f0', '#d8dee9', '#edf5f5', '#f0edf5'],
    borderPresets: ['#b8c4d4', '#5e81ac', '#88c0d0', '#a3be8c', '#b48ead'],
  },
  dark: {
    fillPresets: ['#3b4252', '#434c5e', '#4c566a', '#3a4555', '#44395a'],
    borderPresets: ['#546484', '#81a1c1', '#88c0d0', '#a3be8c', '#b48ead'],
  },
}

const sunsetColors = {
  light: {
    fillPresets: ['#fdf8f3', '#faf0e0', '#fde8d8', '#f5f0e5', '#fdf5ed'],
    borderPresets: ['#d4b48a', '#c87f33', '#d16e3a', '#8c9940', '#c4607a'],
  },
  dark: {
    fillPresets: ['#2a1e12', '#332415', '#3a241a', '#2a2618', '#33201e'],
    borderPresets: ['#7a5530', '#e5a853', '#e07840', '#b0a040', '#d8707a'],
  },
}

const neonColors = {
  light: {
    fillPresets: ['#f0f2f5', '#e8f8f0', '#e5f0ff', '#f5f0ff', '#fff0f5'],
    borderPresets: ['#c8cdd5', '#0090ff', '#00b060', '#8844ee', '#ee44aa'],
  },
  dark: {
    fillPresets: ['#111118', '#0f1a14', '#0f1420', '#14101f', '#1a0f18'],
    borderPresets: ['#252530', '#00ff88', '#0090ff', '#aa55ff', '#ff44aa'],
  },
}

export const BUILTIN_THEMES: readonly ThemeDocument[] = [
  createBuiltinTheme(
    'excalidraw',
    'Excalidraw',
    'Soft island surfaces and the Excalidraw purple accent.',
    APPEARANCE_STYLE_PRESETS.excalidraw.modes,
    excalidrawColors,
  ),
  createBuiltinTheme(
    'blueprint',
    'Blueprint',
    'Cooler drafting surfaces with brighter canvas contrast.',
    APPEARANCE_STYLE_PRESETS.blueprint.modes,
    blueprintColors,
  ),
  createBuiltinTheme(
    'minimal',
    'Minimal',
    'Clean monochrome — no coloured accents, only greys and subtle shadows.',
    { light: lightMinimalTokens, dark: darkMinimalTokens },
    minimalColors,
  ),
  createBuiltinTheme(
    'nord',
    'Nord',
    'Muted arctic palette with Polar Night backgrounds and Frost accents.',
    { light: lightNordTokens, dark: darkNordTokens },
    nordColors,
  ),
  createBuiltinTheme(
    'sunset',
    'Sunset',
    'Warm amber accents, terracotta borders, and creamy surfaces.',
    { light: lightSunsetTokens, dark: darkSunsetTokens },
    sunsetColors,
  ),
  createBuiltinTheme(
    'neon',
    'Neon',
    'Dark base with bright neon accents — high contrast, monospace font.',
    { light: lightNeonTokens, dark: darkNeonTokens },
    neonColors,
  ),
]

export function findBuiltinTheme(themeId: string) {
  return BUILTIN_THEMES.find((theme) => theme.id === themeId) ?? null
}
