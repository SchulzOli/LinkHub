import type { AppearanceProfile } from '../../contracts/appearanceProfile'
import {
  DEFAULT_SURFACE_SHADOW_STYLE,
  DEFAULT_SURFACE_TRANSPARENCY,
  type SurfaceShadowStyle,
  type SurfaceTransparency,
} from '../../contracts/surfaceEffects'

export const SURFACE_SHADOW_STYLE_OPTIONS: SurfaceShadowStyle[] = [
  'none',
  'short',
  'soft',
  'hard',
  'long',
]

export const SURFACE_SHADOW_STYLE_LABELS: Record<SurfaceShadowStyle, string> = {
  none: 'Off',
  short: 'Tight',
  soft: 'Balanced',
  hard: 'Defined',
  long: 'Lifted',
}

type ShadowLayer = readonly [
  offsetX: number,
  offsetY: number,
  blurRadius: number,
  spreadRadius: number,
  color: string,
]

const SURFACE_SHADOW_LAYERS: Record<
  Exclude<SurfaceShadowStyle, 'none'>,
  Record<'light' | 'dark', readonly ShadowLayer[]>
> = {
  short: {
    dark: [
      [0, 3, 8, 0, 'rgba(0, 0, 0, 0.24)'],
      [0, 0, 0, 1, 'rgba(255, 255, 255, 0.05)'],
    ],
    light: [
      [0, 2, 8, 0, 'rgba(15, 23, 42, 0.1)'],
      [0, 0, 0, 1, 'rgba(15, 23, 42, 0.06)'],
    ],
  },
  soft: {
    dark: [
      [0, 7, 18, -2, 'rgba(0, 0, 0, 0.32)'],
      [0, 2, 6, 0, 'rgba(0, 0, 0, 0.18)'],
      [0, 0, 0, 1, 'rgba(255, 255, 255, 0.05)'],
    ],
    light: [
      [0, 7, 18, -3, 'rgba(15, 23, 42, 0.12)'],
      [0, 2, 6, 0, 'rgba(15, 23, 42, 0.06)'],
      [0, 0, 0, 1, 'rgba(15, 23, 42, 0.05)'],
    ],
  },
  hard: {
    dark: [
      [0, 6, 12, -1, 'rgba(0, 0, 0, 0.4)'],
      [0, 0, 0, 1, 'rgba(255, 255, 255, 0.09)'],
    ],
    light: [
      [0, 5, 12, -1, 'rgba(15, 23, 42, 0.14)'],
      [0, 0, 0, 1, 'rgba(15, 23, 42, 0.12)'],
    ],
  },
  long: {
    dark: [
      [0, 12, 26, -4, 'rgba(0, 0, 0, 0.34)'],
      [0, 4, 10, 0, 'rgba(0, 0, 0, 0.18)'],
      [0, 0, 0, 1, 'rgba(255, 255, 255, 0.06)'],
    ],
    light: [
      [0, 12, 26, -4, 'rgba(15, 23, 42, 0.13)'],
      [0, 4, 10, 0, 'rgba(15, 23, 42, 0.07)'],
      [0, 0, 0, 1, 'rgba(15, 23, 42, 0.06)'],
    ],
  },
}

function scaleShadowLength(value: number, zoom: number) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  return `${Number((value / safeZoom).toFixed(2))}px`
}

export function getScaledShadow(layers: readonly ShadowLayer[], zoom = 1) {
  return layers
    .map(
      ([offsetX, offsetY, blurRadius, spreadRadius, color]) =>
        `${scaleShadowLength(offsetX, zoom)} ${scaleShadowLength(offsetY, zoom)} ${scaleShadowLength(blurRadius, zoom)} ${scaleShadowLength(spreadRadius, zoom)} ${color}`,
    )
    .join(', ')
}

export function resolveSurfaceTransparency(
  surfaceTransparency: SurfaceTransparency | undefined,
  appearance: Pick<AppearanceProfile, 'defaultSurfaceTransparency'>,
) {
  return (
    surfaceTransparency ??
    appearance.defaultSurfaceTransparency ??
    DEFAULT_SURFACE_TRANSPARENCY
  )
}

export function resolveSurfaceShadowStyle(
  shadowStyle: SurfaceShadowStyle | undefined,
  appearance: Pick<AppearanceProfile, 'defaultSurfaceShadowStyle'>,
) {
  return (
    shadowStyle ??
    appearance.defaultSurfaceShadowStyle ??
    DEFAULT_SURFACE_SHADOW_STYLE
  )
}

export function getSurfaceLayerColor(
  color: string,
  surfaceTransparency: SurfaceTransparency,
  baseOpacity = 100,
) {
  const opacity = Number(
    Math.max(
      0,
      Math.min(100, ((100 - surfaceTransparency) * baseOpacity) / 100),
    ).toFixed(2),
  )

  if (opacity <= 0) {
    return 'transparent'
  }

  if (opacity >= 100) {
    return color
  }

  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`
}

export function getSurfaceShadow(
  shadowStyle: SurfaceShadowStyle,
  appearance: Pick<AppearanceProfile, 'themeMode'>,
  zoom = 1,
) {
  if (shadowStyle === 'none') {
    return 'none'
  }

  return getScaledShadow(
    SURFACE_SHADOW_LAYERS[shadowStyle][appearance.themeMode],
    zoom,
  )
}
