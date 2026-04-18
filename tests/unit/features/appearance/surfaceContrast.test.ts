import { describe, expect, it } from 'vitest'

import {
  getReadableTextColor,
  isDarkSurfaceColor,
} from '../../../../src/features/appearance/surfaceContrast'

const LIGHT_TITLE_TEXT_COLOR = '#e3e3e8'
const DARK_TITLE_TEXT_COLOR = '#1f1f25'

describe('surfaceContrast', () => {
  it('detects dark hex surfaces', () => {
    expect(isDarkSurfaceColor('#232329')).toBe(true)
    expect(isDarkSurfaceColor('#ffffff')).toBe(false)
  })

  it('detects dark rgb surfaces', () => {
    expect(isDarkSurfaceColor('rgb(17, 33, 47)')).toBe(true)
    expect(isDarkSurfaceColor('rgba(255, 255, 255, 0.96)')).toBe(false)
  })

  it('picks the lighter title color on dark surfaces', () => {
    expect(
      getReadableTextColor({
        backgroundColor: '#232329',
        lightTextColor: LIGHT_TITLE_TEXT_COLOR,
        darkTextColor: DARK_TITLE_TEXT_COLOR,
      }),
    ).toBe(LIGHT_TITLE_TEXT_COLOR)
  })

  it('picks the darker title color on light surfaces', () => {
    expect(
      getReadableTextColor({
        backgroundColor: '#ffffff',
        lightTextColor: LIGHT_TITLE_TEXT_COLOR,
        darkTextColor: DARK_TITLE_TEXT_COLOR,
      }),
    ).toBe(DARK_TITLE_TEXT_COLOR)
  })

  it('accounts for the canvas backdrop when surfaces are translucent', () => {
    expect(
      getReadableTextColor({
        backgroundColor: 'rgba(17, 33, 47, 0.72)',
        backgroundBackdropColor: '#ffffff',
        lightTextColor: LIGHT_TITLE_TEXT_COLOR,
        darkTextColor: DARK_TITLE_TEXT_COLOR,
      }),
    ).toBe(LIGHT_TITLE_TEXT_COLOR)

    expect(
      getReadableTextColor({
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
        backgroundBackdropColor: '#09131d',
        lightTextColor: LIGHT_TITLE_TEXT_COLOR,
        darkTextColor: DARK_TITLE_TEXT_COLOR,
      }),
    ).toBe(DARK_TITLE_TEXT_COLOR)
  })

  it('keeps edge-to-edge image title scrims on the lighter title color', () => {
    expect(
      getReadableTextColor({
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backgroundBackdropColor: '#ffffff',
        lightTextColor: LIGHT_TITLE_TEXT_COLOR,
        darkTextColor: DARK_TITLE_TEXT_COLOR,
      }),
    ).toBe(LIGHT_TITLE_TEXT_COLOR)
  })
})
