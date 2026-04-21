import { describe, expect, it } from 'vitest'

import {
  hexToRgb,
  mixHexColors,
  withAlpha,
} from '../../../../src/features/appearance/colorMath'

describe('hexToRgb', () => {
  it('parses six-digit hex values', () => {
    expect(hexToRgb('#ff8800')).toEqual({ red: 255, green: 136, blue: 0 })
  })

  it('expands three-digit shorthand', () => {
    expect(hexToRgb('#0af')).toEqual({ red: 0, green: 170, blue: 255 })
  })

  it('accepts values without a leading hash', () => {
    expect(hexToRgb('123456')).toEqual({ red: 18, green: 52, blue: 86 })
  })

  it('returns null for unsupported lengths', () => {
    expect(hexToRgb('#12')).toBeNull()
    expect(hexToRgb('#12345')).toBeNull()
  })

  it('returns null for non-hex characters', () => {
    expect(hexToRgb('#zzzzzz')).toBeNull()
  })
})

describe('withAlpha', () => {
  it('returns an rgba string for a valid color', () => {
    expect(withAlpha('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)')
  })

  it('clamps alpha into the [0, 1] range', () => {
    expect(withAlpha('#00ff00', 2)).toBe('rgba(0, 255, 0, 1)')
    expect(withAlpha('#00ff00', -1)).toBe('rgba(0, 255, 0, 0)')
  })

  it('returns the original value when the color cannot be parsed', () => {
    expect(withAlpha('not-a-color', 0.5)).toBe('not-a-color')
  })
})

describe('mixHexColors', () => {
  it('returns the left color when ratio is 0', () => {
    expect(mixHexColors('#000000', '#ffffff', 0)).toBe('rgb(0, 0, 0)')
  })

  it('returns the right color when ratio is 1', () => {
    expect(mixHexColors('#000000', '#ffffff', 1)).toBe('rgb(255, 255, 255)')
  })

  it('mixes evenly at 0.5', () => {
    expect(mixHexColors('#000000', '#ffffff', 0.5)).toBe('rgb(128, 128, 128)')
  })

  it('clamps the ratio to [0, 1]', () => {
    expect(mixHexColors('#000000', '#ffffff', 5)).toBe('rgb(255, 255, 255)')
    expect(mixHexColors('#000000', '#ffffff', -5)).toBe('rgb(0, 0, 0)')
  })

  it('returns the left color when either input is invalid', () => {
    expect(mixHexColors('bogus', '#ffffff', 0.5)).toBe('bogus')
    expect(mixHexColors('#000000', 'bogus', 0.5)).toBe('#000000')
  })
})
