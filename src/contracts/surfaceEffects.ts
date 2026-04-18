import { z } from 'zod'

export const SURFACE_TRANSPARENCY_LIMITS = {
  min: 0,
  max: 100,
} as const

export const SurfaceShadowStyleSchema = z.enum([
  'none',
  'short',
  'soft',
  'hard',
  'long',
])

export const SurfaceTransparencySchema = z
  .number()
  .int()
  .min(SURFACE_TRANSPARENCY_LIMITS.min)
  .max(SURFACE_TRANSPARENCY_LIMITS.max)

export type SurfaceTransparency = z.infer<typeof SurfaceTransparencySchema>
export type SurfaceShadowStyle = z.infer<typeof SurfaceShadowStyleSchema>

export const DEFAULT_SURFACE_TRANSPARENCY: SurfaceTransparency = 0
export const DEFAULT_SURFACE_SHADOW_STYLE: SurfaceShadowStyle = 'soft'

const LEGACY_EDGE_FADE_TO_TRANSPARENCY = {
  none: 0,
  soft: 14,
  medium: 28,
  strong: 42,
} as const

export function clampSurfaceTransparency(value: number) {
  return Math.min(
    SURFACE_TRANSPARENCY_LIMITS.max,
    Math.max(SURFACE_TRANSPARENCY_LIMITS.min, Math.round(value)),
  )
}

export function coerceSurfaceTransparency(
  value: unknown,
  fallback: SurfaceTransparency = DEFAULT_SURFACE_TRANSPARENCY,
): SurfaceTransparency {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampSurfaceTransparency(value)
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase()

    if (normalizedValue in LEGACY_EDGE_FADE_TO_TRANSPARENCY) {
      return LEGACY_EDGE_FADE_TO_TRANSPARENCY[
        normalizedValue as keyof typeof LEGACY_EDGE_FADE_TO_TRANSPARENCY
      ]
    }

    const numericValue = Number(normalizedValue)

    if (Number.isFinite(numericValue)) {
      return clampSurfaceTransparency(numericValue)
    }
  }

  return fallback
}

export function coerceSurfaceShadowStyle(
  value: unknown,
  fallback: SurfaceShadowStyle = DEFAULT_SURFACE_SHADOW_STYLE,
): SurfaceShadowStyle {
  const parsed = SurfaceShadowStyleSchema.safeParse(value)

  return parsed.success ? parsed.data : fallback
}
