import { describe, expect, it } from 'vitest'

import { defaultAppearanceProfile } from '../../../../src/contracts/appearanceProfile'
import {
  findPresetSlotForColor,
  resolveCardColors,
} from '../../../../src/features/appearance/cardColorPalette'
import { getAppearanceStyleTokens } from '../../../../src/features/appearance/stylePresets'

describe('cardColorPalette', () => {
  it('resolves preset-based card colors against the active theme row', () => {
    const lightAppearance = {
      ...defaultAppearanceProfile,
      themeMode: 'light' as const,
      fillPresetsByTheme: {
        ...defaultAppearanceProfile.fillPresetsByTheme,
        light: ['#111111', '#222222', '#333333', '#444444', '#555555'],
      },
      borderPresetsByTheme: {
        ...defaultAppearanceProfile.borderPresetsByTheme,
        light: ['#aaaaaa', '#bbbbbb', '#cccccc', '#dddddd', '#eeeeee'],
      },
    }
    const darkAppearance = {
      ...lightAppearance,
      themeMode: 'dark' as const,
      fillPresetsByTheme: {
        ...lightAppearance.fillPresetsByTheme,
        dark: ['#101010', '#202020', '#303030', '#404040', '#505050'],
      },
      borderPresetsByTheme: {
        ...lightAppearance.borderPresetsByTheme,
        dark: ['#ababab', '#bcbcbc', '#cdcdcd', '#dedede', '#efefef'],
      },
    }
    const lightTokens = getAppearanceStyleTokens(
      lightAppearance.stylePreset,
      lightAppearance.themeMode,
    )
    const darkTokens = getAppearanceStyleTokens(
      darkAppearance.stylePreset,
      darkAppearance.themeMode,
    )

    expect(
      resolveCardColors(
        { fillPresetIndex: 1, borderPresetIndex: 3 },
        lightAppearance,
        {
          fillColor: lightTokens.cardBg,
          borderColor: lightTokens.cardBorder,
        },
      ),
    ).toEqual({
      fillColor: '#222222',
      borderColor: '#dddddd',
    })

    expect(
      resolveCardColors(
        { fillPresetIndex: 1, borderPresetIndex: 3 },
        darkAppearance,
        {
          fillColor: darkTokens.cardBg,
          borderColor: darkTokens.cardBorder,
        },
      ),
    ).toEqual({
      fillColor: '#202020',
      borderColor: '#dedede',
    })
  })

  it('lets a stored hex that matches a preset follow the light/dark switch', () => {
    const appearance = {
      ...defaultAppearanceProfile,
      fillPresetsByTheme: {
        light: ['#ffffff', '#f3f2ff', '#eef5ff', '#ecfaf5', '#fff0f3'],
        dark: ['#1a1a1f', '#25233a', '#1c2738', '#182c27', '#2e1d25'],
      },
      borderPresetsByTheme: {
        light: ['#e6e6ec', '#6965db', '#5b8def', '#3fae8c', '#e5718f'],
        dark: ['#2a2a31', '#a8a5ff', '#7aa7ff', '#5cc6a7', '#ff8fae'],
      },
    }
    // Saved in dark mode as raw hex (custom colour input, format painter).
    const group = { fillColor: '#25233A', borderColor: '#a8a5ff' }
    const fallback = { fillColor: '#000000', borderColor: '#000000' }

    expect(findPresetSlotForColor('#25233a', 'fill', appearance)).toBe(1)
    expect(
      resolveCardColors(group, { ...appearance, themeMode: 'light' }, fallback),
    ).toEqual({ fillColor: '#f3f2ff', borderColor: '#6965db' })
    expect(
      resolveCardColors(group, { ...appearance, themeMode: 'dark' }, fallback),
    ).toEqual({ fillColor: '#25233a', borderColor: '#a8a5ff' })
    // A colour that is no preset stays as chosen.
    expect(
      resolveCardColors(
        { fillColor: '#123456' },
        { ...appearance, themeMode: 'light' },
        fallback,
      ).fillColor,
    ).toBe('#123456')
  })
})
