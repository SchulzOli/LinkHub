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
import {
  APPEARANCE_STYLE_PRESETS,
  createStyleTokens,
  UI_FONT_MONO,
} from '../appearance/stylePresets'

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

const lightMinimalTokens = createStyleTokens({
  mode: 'light',
  canvas: '#ffffff',
  shell: '#fafafa',
  surface: '#ffffff',
  border: '#ebebeb',
  inputBorder: '#e0e0e0',
  text: '#0a0a0a',
  muted: '#737373',
  accent: '#171717',
  accentStrong: '#000000',
  hover: '#f5f5f5',
  active: '#ededed',
  grid: 'rgba(0, 0, 0, 0.04)',
  shadowTint: '0, 0, 0',
})

const darkMinimalTokens = createStyleTokens({
  mode: 'dark',
  canvas: '#0a0a0a',
  shell: '#0f0f0f',
  surface: '#141414',
  border: '#262626',
  inputBorder: '#2e2e2e',
  text: '#fafafa',
  muted: '#a3a3a3',
  accent: '#e5e5e5',
  accentStrong: '#ffffff',
  hover: '#1c1c1c',
  active: '#242424',
  grid: 'rgba(255, 255, 255, 0.035)',
})

// ── Nord ─────────────────────────────────────────────────

const lightNordTokens = createStyleTokens({
  mode: 'light',
  canvas: '#f3f5f9',
  shell: '#eceff4',
  surface: '#ffffff',
  border: '#dde3ec',
  inputBorder: '#d3dae6',
  text: '#2e3440',
  muted: '#5f6b80',
  accent: '#5e81ac',
  accentStrong: '#4c6a93',
  hover: '#eef1f6',
  active: '#e5e9f0',
  grid: 'rgba(46, 52, 64, 0.055)',
  shadowTint: '46, 52, 64',
})

const darkNordTokens = createStyleTokens({
  mode: 'dark',
  canvas: '#2b303b',
  shell: '#2e3440',
  surface: '#353b48',
  border: '#424a5a',
  inputBorder: '#4a5366',
  text: '#eceff4',
  muted: '#a9b5c6',
  accent: '#88c0d0',
  accentStrong: '#a3d4e0',
  hover: '#3c4351',
  active: '#434c5e',
  grid: 'rgba(216, 222, 233, 0.05)',
})

// ── Sunset ───────────────────────────────────────────────

const lightSunsetTokens = createStyleTokens({
  mode: 'light',
  canvas: '#fcf9f5',
  shell: '#f8f2ea',
  surface: '#fffdfa',
  border: '#efe4d6',
  inputBorder: '#e7d8c6',
  text: '#33210f',
  muted: '#86694d',
  accent: '#d9772b',
  accentStrong: '#b85f18',
  hover: '#f8efe4',
  active: '#f2e5d5',
  grid: 'rgba(140, 90, 40, 0.06)',
  shadowTint: '80, 48, 20',
})

const darkSunsetTokens = createStyleTokens({
  mode: 'dark',
  canvas: '#15100b',
  shell: '#1a140e',
  surface: '#201811',
  border: '#36291c',
  inputBorder: '#403122',
  text: '#f3e6d6',
  muted: '#b49a7d',
  accent: '#f0a054',
  accentStrong: '#f7bd82',
  hover: '#2a2017',
  active: '#33271c',
  grid: 'rgba(240, 160, 84, 0.05)',
})

// ── Neon ─────────────────────────────────────────────────

const NEON_RADIUS = { sm: '0.375rem', md: '0.5rem', lg: '0.625rem' }

const lightNeonTokens = createStyleTokens({
  mode: 'light',
  canvas: '#f5f7fa',
  shell: '#eef1f5',
  surface: '#ffffff',
  border: '#dfe3ea',
  inputBorder: '#d4d9e2',
  text: '#0b0f17',
  muted: '#5b6472',
  accent: '#0a84ff',
  accentStrong: '#0066d6',
  hover: '#eef2f7',
  active: '#e3e8f0',
  grid: 'rgba(10, 132, 255, 0.06)',
  font: UI_FONT_MONO,
  radius: NEON_RADIUS,
})

const darkNeonTokens = createStyleTokens({
  mode: 'dark',
  canvas: '#07080c',
  shell: '#0a0b11',
  surface: '#0e1017',
  border: '#1b2230',
  inputBorder: '#232c3d',
  text: '#e3ebf3',
  muted: '#7d8a99',
  accent: '#00f08a',
  accentStrong: '#6bffbe',
  hover: '#141824',
  active: '#1a1f2d',
  grid: 'rgba(0, 240, 138, 0.045)',
  font: UI_FONT_MONO,
  radius: NEON_RADIUS,
})

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
    fillPresets: ['#ffffff', '#f5f5f5', '#fafafa', '#f0f0f0', '#e8e8e8'],
    borderPresets: ['#ebebeb', '#171717', '#a3a3a3', '#d4d4d4', '#525252'],
  },
  dark: {
    fillPresets: ['#141414', '#1c1c1c', '#202020', '#262626', '#0f0f0f'],
    borderPresets: ['#262626', '#e5e5e5', '#525252', '#3a3a3a', '#a3a3a3'],
  },
}

const nordColors = {
  light: {
    fillPresets: ['#ffffff', '#eef3f9', '#edf6f7', '#f1f6ee', '#f6f0f5'],
    borderPresets: ['#dde3ec', '#5e81ac', '#88c0d0', '#a3be8c', '#b48ead'],
  },
  dark: {
    fillPresets: ['#353b48', '#36425a', '#344a52', '#3a4a40', '#45394f'],
    borderPresets: ['#424a5a', '#81a1c1', '#88c0d0', '#a3be8c', '#b48ead'],
  },
}

const sunsetColors = {
  light: {
    fillPresets: ['#fffdfa', '#fdf1e4', '#fdebe3', '#f4f3e4', '#fbeef1'],
    borderPresets: ['#efe4d6', '#d9772b', '#d4643a', '#8f9a3e', '#c96079'],
  },
  dark: {
    fillPresets: ['#201811', '#2e2014', '#2f1c16', '#262414', '#2e1a1e'],
    borderPresets: ['#36291c', '#f0a054', '#e8794a', '#b7ad52', '#e07a8c'],
  },
}

const neonColors = {
  light: {
    fillPresets: ['#ffffff', '#eaf4ff', '#e9f8f0', '#f2edff', '#ffedf6'],
    borderPresets: ['#dfe3ea', '#0a84ff', '#00b466', '#8b5cf6', '#ec4899'],
  },
  dark: {
    fillPresets: ['#0e1017', '#0b1a14', '#0c1424', '#15102a', '#1e0e1c'],
    borderPresets: ['#1b2230', '#00f08a', '#3b9eff', '#a970ff', '#ff4fb0'],
  },
}

export const BUILTIN_THEMES: readonly ThemeDocument[] = [
  createBuiltinTheme(
    'excalidraw',
    'Excalidraw',
    'Clean neutral surfaces with the Excalidraw violet accent.',
    APPEARANCE_STYLE_PRESETS.excalidraw.modes,
    excalidrawColors,
  ),
  createBuiltinTheme(
    'blueprint',
    'Blueprint',
    'Cool drafting tones with a crisp blue accent.',
    APPEARANCE_STYLE_PRESETS.blueprint.modes,
    blueprintColors,
  ),
  createBuiltinTheme(
    'minimal',
    'Minimal',
    'Pure monochrome. No color, just type, space and hairlines.',
    { light: lightMinimalTokens, dark: darkMinimalTokens },
    minimalColors,
  ),
  createBuiltinTheme(
    'nord',
    'Nord',
    'Calm arctic greys with Frost blue accents.',
    { light: lightNordTokens, dark: darkNordTokens },
    nordColors,
  ),
  createBuiltinTheme(
    'sunset',
    'Sunset',
    'Warm paper tones with an amber accent.',
    { light: lightSunsetTokens, dark: darkSunsetTokens },
    sunsetColors,
  ),
  createBuiltinTheme(
    'neon',
    'Neon',
    'Deep dark base, neon accent and monospace type.',
    { light: lightNeonTokens, dark: darkNeonTokens },
    neonColors,
  ),
]

export function findBuiltinTheme(themeId: string) {
  return BUILTIN_THEMES.find((theme) => theme.id === themeId) ?? null
}
