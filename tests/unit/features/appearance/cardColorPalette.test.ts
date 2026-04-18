import { describe, expect, it } from 'vitest'

import { defaultAppearanceProfile } from '../../../../src/contracts/appearanceProfile'
import { resolveCardColors } from '../../../../src/features/appearance/cardColorPalette'
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
})
