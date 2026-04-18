import { describe, expect, it } from 'vitest'

import {
  SURFACE_SHADOW_STYLE_LABELS,
  getSurfaceShadow,
} from '../../../../src/features/appearance/surfaceEffects'

describe('surfaceEffects', () => {
  it('uses updated user-facing labels for the node shadow presets', () => {
    expect(SURFACE_SHADOW_STYLE_LABELS).toEqual({
      none: 'Off',
      short: 'Tight',
      soft: 'Balanced',
      hard: 'Defined',
      long: 'Lifted',
    })
  })

  it('returns no box shadow for the off preset', () => {
    expect(getSurfaceShadow('none', { themeMode: 'dark' })).toBe('none')
    expect(getSurfaceShadow('none', { themeMode: 'light' }, 2.1)).toBe('none')
  })

  it('keeps the balanced shadow compact and readable in both theme modes', () => {
    expect(getSurfaceShadow('soft', { themeMode: 'dark' })).toBe(
      '0px 7px 18px -2px rgba(0, 0, 0, 0.32), 0px 2px 6px 0px rgba(0, 0, 0, 0.18), 0px 0px 0px 1px rgba(255, 255, 255, 0.05)',
    )
    expect(getSurfaceShadow('soft', { themeMode: 'light' })).toBe(
      '0px 7px 18px -3px rgba(15, 23, 42, 0.12), 0px 2px 6px 0px rgba(15, 23, 42, 0.06), 0px 0px 0px 1px rgba(15, 23, 42, 0.05)',
    )
  })

  it('scales long shadows inversely to the canvas zoom', () => {
    expect(getSurfaceShadow('long', { themeMode: 'dark' }, 2)).toBe(
      '0px 6px 13px -2px rgba(0, 0, 0, 0.34), 0px 2px 5px 0px rgba(0, 0, 0, 0.18), 0px 0px 0px 0.5px rgba(255, 255, 255, 0.06)',
    )
    expect(getSurfaceShadow('hard', { themeMode: 'light' }, 2.5)).toBe(
      '0px 2px 4.8px -0.4px rgba(15, 23, 42, 0.14), 0px 0px 0px 0.4px rgba(15, 23, 42, 0.12)',
    )
  })
})
