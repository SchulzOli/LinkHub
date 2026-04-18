import { describe, expect, it } from 'vitest'

import { defaultAppearanceProfile } from '../../../../src/contracts/appearanceProfile'
import { getSurfaceStyles } from '../../../../src/features/appearance/useSurfaceStyles'

describe('useSurfaceStyles', () => {
  it('resolves theme-aware colors and draft selections through one shared path', () => {
    const appearance = {
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

    const result = getSurfaceStyles({
      appearance,
      drafts: {
        borderColorDraft: '#121212',
        borderPresetIndexDraft: null,
        fillColorDraft: null,
        fillPresetIndexDraft: 3,
      },
      entity: {
        borderColor: '#f0f0f0',
        fillPresetIndex: 1,
        shadowStyle: 'hard',
        surfaceTransparency: 25,
      },
    })

    expect(result.defaultColorPresets.fillPresets).toEqual([
      '#ffffff',
      '#f4efff',
      '#edf4ff',
      '#eefbf7',
      '#fff0f4',
    ])
    expect(result.activeColorSettings.fillPresets).toEqual([
      '#111111',
      '#222222',
      '#333333',
      '#444444',
      '#555555',
    ])
    expect(result.resolvedColors).toEqual({
      borderColor: '#f0f0f0',
      fillColor: '#222222',
    })
    expect(result.resolvedSurfaceTransparency).toBe(25)
    expect(result.resolvedShadowStyle).toBe('hard')
    expect(result.selectedFillColor).toBe('#444444')
    expect(result.selectedBorderColor).toBe('#121212')
  })

  it('falls back to appearance defaults when the entity has no explicit surface values', () => {
    const result = getSurfaceStyles({
      appearance: defaultAppearanceProfile,
      drafts: {
        borderColorDraft: null,
        borderPresetIndexDraft:
          defaultAppearanceProfile.defaultBorderPresetIndexByTheme.dark,
        fillColorDraft: '#abcdef',
        fillPresetIndexDraft: null,
      },
      entity: {},
    })

    expect(result.resolvedSurfaceTransparency).toBe(
      defaultAppearanceProfile.defaultSurfaceTransparency,
    )
    expect(result.resolvedShadowStyle).toBe(
      defaultAppearanceProfile.defaultSurfaceShadowStyle,
    )
    expect(result.selectedFillColor).toBe('#abcdef')
    expect(result.selectedBorderColor).toBe(
      defaultAppearanceProfile.borderPresetsByTheme.dark[
        defaultAppearanceProfile.defaultBorderPresetIndexByTheme.dark
      ],
    )
    expect(result.resolvedColors).toEqual({
      borderColor: '#3a3947',
      fillColor: '#232329',
    })
  })
})
