import { describe, expect, it } from 'vitest'

import {
  CARD_CORNER_RADIUS_LIMITS,
  CARD_SIZE_LIMITS,
  clampCardCornerRadius,
  coerceCardCornerRadius,
  coerceCardSize,
  coerceCardVisibility,
  coerceCardVisibilityDefault,
  coerceLinkCardColors,
  DEFAULT_CARD_CORNER_RADIUS,
  DEFAULT_CARD_SIZE,
  getLegacyCardSize,
  parseCardSizeDraft,
} from '../../../src/contracts/linkCard'

describe('clampCardCornerRadius', () => {
  it('clamps values above the maximum', () => {
    expect(clampCardCornerRadius(CARD_CORNER_RADIUS_LIMITS.max + 10)).toBe(
      CARD_CORNER_RADIUS_LIMITS.max,
    )
  })

  it('clamps values below the minimum', () => {
    expect(clampCardCornerRadius(-5)).toBe(CARD_CORNER_RADIUS_LIMITS.min)
  })

  it('rounds non-integer values', () => {
    expect(clampCardCornerRadius(12.7)).toBe(13)
  })
})

describe('coerceCardCornerRadius', () => {
  it('returns the fallback when the value is not numeric', () => {
    expect(coerceCardCornerRadius(undefined)).toBe(DEFAULT_CARD_CORNER_RADIUS)
    expect(coerceCardCornerRadius('12')).toBe(DEFAULT_CARD_CORNER_RADIUS)
  })

  it('returns the fallback for NaN', () => {
    expect(coerceCardCornerRadius(Number.NaN, 4)).toBe(4)
  })

  it('clamps numeric values into range', () => {
    expect(coerceCardCornerRadius(9999)).toBe(CARD_CORNER_RADIUS_LIMITS.max)
  })
})

describe('getLegacyCardSize', () => {
  it('maps legacy sizes to the documented grid sizes', () => {
    expect(getLegacyCardSize('compact')).toEqual({ columns: 4, rows: 4 })
    expect(getLegacyCardSize('default')).toEqual({ columns: 5, rows: 5 })
    expect(getLegacyCardSize('comfortable')).toEqual({ columns: 6, rows: 6 })
  })
})

describe('coerceCardSize', () => {
  it('converts legacy string sizes', () => {
    expect(coerceCardSize('comfortable')).toEqual({ columns: 6, rows: 6 })
  })

  it('reads columns/rows from an object shape', () => {
    expect(coerceCardSize({ columns: 7, rows: 3 })).toEqual({
      columns: 7,
      rows: 3,
    })
  })

  it('accepts legacy width/height aliases', () => {
    expect(coerceCardSize({ width: 8, height: 9 })).toEqual({
      columns: 8,
      rows: 9,
    })
  })

  it('clamps into the allowed size range', () => {
    expect(coerceCardSize({ columns: 999, rows: -5 })).toEqual({
      columns: CARD_SIZE_LIMITS.max,
      rows: CARD_SIZE_LIMITS.min,
    })
  })

  it('returns the fallback when the value cannot be interpreted', () => {
    expect(coerceCardSize(null)).toEqual(DEFAULT_CARD_SIZE)
    expect(coerceCardSize('totally-invalid')).toEqual(DEFAULT_CARD_SIZE)
    expect(coerceCardSize({ columns: 'x', rows: 'y' })).toEqual(
      DEFAULT_CARD_SIZE,
    )
  })
})

describe('coerceCardVisibility', () => {
  it('passes through booleans', () => {
    expect(coerceCardVisibility(true)).toBe(true)
    expect(coerceCardVisibility(false)).toBe(false)
  })

  it('returns undefined for non-booleans', () => {
    expect(coerceCardVisibility('yes')).toBeUndefined()
    expect(coerceCardVisibility(undefined)).toBeUndefined()
  })
})

describe('coerceCardVisibilityDefault', () => {
  it('returns the fallback when the value is not boolean', () => {
    expect(coerceCardVisibilityDefault('x', true)).toBe(true)
    expect(coerceCardVisibilityDefault(undefined, false)).toBe(false)
  })

  it('returns the provided boolean otherwise', () => {
    expect(coerceCardVisibilityDefault(false, true)).toBe(false)
  })
})

describe('coerceLinkCardColors', () => {
  it('returns empty slots for non-object input', () => {
    expect(coerceLinkCardColors(null)).toEqual({
      fillColor: undefined,
      borderColor: undefined,
      fillPresetIndex: undefined,
      borderPresetIndex: undefined,
    })
  })

  it('passes through valid color and preset fields and strips unknowns', () => {
    const result = coerceLinkCardColors({
      fillColor: '#aabbcc',
      borderColor: '#112233',
      fillPresetIndex: 2,
      borderPresetIndex: 4,
      faviconOverrideImageId: 'icon-1',
      groupId: 'group-1',
      somethingElse: true,
    })

    expect(result).toEqual({
      fillColor: '#aabbcc',
      borderColor: '#112233',
      fillPresetIndex: 2,
      borderPresetIndex: 4,
      faviconOverrideImageId: 'icon-1',
      groupId: 'group-1',
    })
  })

  it('drops empty string identifiers', () => {
    const result = coerceLinkCardColors({
      faviconOverrideImageId: '',
      groupId: '',
    })

    expect(result.faviconOverrideImageId).toBeUndefined()
    expect(result.groupId).toBeUndefined()
  })
})

describe('parseCardSizeDraft', () => {
  it('parses integer strings into a card size', () => {
    expect(parseCardSizeDraft('5', '7')).toEqual({ columns: 5, rows: 7 })
  })

  it('returns null for non-integer input', () => {
    expect(parseCardSizeDraft('5.5', '3')).toBeNull()
    expect(parseCardSizeDraft('abc', '3')).toBeNull()
  })

  it('returns null for values outside the allowed range', () => {
    expect(parseCardSizeDraft('0', '3')).toBeNull()
    expect(parseCardSizeDraft('3', '99')).toBeNull()
  })
})
