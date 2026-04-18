import { z } from 'zod'

export const CARD_COLOR_PRESET_COUNT = 5
export const DEFAULT_CARD_COLOR_PRESET_INDEX = 0
export const CARD_COLOR_HEX_PATTERN = /^#[0-9a-f]{6}$/i

export const CardColorHexSchema = z.string().regex(CARD_COLOR_HEX_PATTERN)
export const CardColorPresetIndexSchema = z
  .number()
  .int()
  .min(0)
  .max(CARD_COLOR_PRESET_COUNT - 1)

export function normalizeCardColor(value: string) {
  return value.trim().toLowerCase()
}

export function isCardColor(value: unknown): value is string {
  return typeof value === 'string' && CARD_COLOR_HEX_PATTERN.test(value.trim())
}

export function coerceCardColor(value: unknown, fallback?: string) {
  if (isCardColor(value)) {
    return normalizeCardColor(value)
  }

  return fallback
}

export function coerceCardColorPresetIndex(
  value: unknown,
  fallback = DEFAULT_CARD_COLOR_PRESET_INDEX,
) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return Math.min(CARD_COLOR_PRESET_COUNT - 1, Math.max(0, value))
  }

  return fallback
}

export function coerceCardColorPresetRow(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return [...fallback]
  }

  const nextColors = fallback.map((fallbackColor, index) => {
    const candidate = value[index]

    return coerceCardColor(candidate, fallbackColor) ?? fallbackColor
  })

  return nextColors.slice(0, CARD_COLOR_PRESET_COUNT)
}

export function areCardColorsEqual(left: string | null, right: string | null) {
  if (!left || !right) {
    return false
  }

  return normalizeCardColor(left) === normalizeCardColor(right)
}
