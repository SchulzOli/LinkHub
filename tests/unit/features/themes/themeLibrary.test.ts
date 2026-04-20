import { describe, expect, it } from 'vitest'

import { defaultAppearanceProfile } from '../../../../src/contracts/appearanceProfile'
import {
  THEME_DOCUMENT_FORMAT,
  THEME_DOCUMENT_VERSION,
  type ThemeDocument,
} from '../../../../src/contracts/theme'
import {
  applyThemeToAppearance,
  createThemeFromAppearance,
  duplicateTheme,
  parseThemeFile,
} from '../../../../src/features/themes/themeLibrary'

describe('themeLibrary', () => {
  it('creates a theme document from an appearance profile', () => {
    const theme = createThemeFromAppearance(
      defaultAppearanceProfile,
      '  My Theme  ',
      '  a description  ',
    )

    expect(theme.format).toBe(THEME_DOCUMENT_FORMAT)
    expect(theme.version).toBe(THEME_DOCUMENT_VERSION)
    expect(theme.name).toBe('My Theme')
    expect(theme.description).toBe('a description')
    expect(theme.id).toMatch(/.+/)
    expect(theme.createdAt).toBe(theme.updatedAt)
    expect(theme.content.cardDefaults.defaultCardSize).toEqual(
      defaultAppearanceProfile.defaultCardSize,
    )
    expect(theme.content.tokens.light).toEqual(
      defaultAppearanceProfile.styleTokens.light,
    )
  })

  it('omits the description when only whitespace is provided', () => {
    const theme = createThemeFromAppearance(
      defaultAppearanceProfile,
      'Name',
      '   ',
    )

    expect(theme.description).toBeUndefined()
  })

  it('applies a theme content back onto an appearance profile', () => {
    const theme = createThemeFromAppearance(defaultAppearanceProfile, 'Name')
    const modifiedContent = {
      ...theme.content,
      cardDefaults: {
        ...theme.content.cardDefaults,
        defaultCardShowTitle: false,
        defaultCardOpenInNewTab: false,
      },
    }

    const appearance = applyThemeToAppearance(
      defaultAppearanceProfile,
      'theme-1',
      modifiedContent,
    )

    expect(appearance.activeThemeId).toBe('theme-1')
    expect(appearance.defaultCardShowTitle).toBe(false)
    expect(appearance.defaultCardOpenInNewTab).toBe(false)
    expect(appearance.styleTokens.light).toEqual(theme.content.tokens.light)
    // Must be a fresh copy, not a reference share.
    expect(appearance.styleTokens.light).not.toBe(theme.content.tokens.light)
  })

  it('duplicates a theme with a new id and copy suffix', () => {
    const original: ThemeDocument = createThemeFromAppearance(
      defaultAppearanceProfile,
      'Original',
    )

    const copy = duplicateTheme(original)

    expect(copy.id).not.toBe(original.id)
    expect(copy.name).toBe('Original copy')
    expect(copy.content).toEqual(original.content)
  })

  it('parses valid theme payloads', () => {
    const original = createThemeFromAppearance(
      defaultAppearanceProfile,
      'Parseable',
    )

    const parsed = parseThemeFile(JSON.parse(JSON.stringify(original)))

    expect(parsed).not.toBeNull()
    expect(parsed?.id).toBe(original.id)
  })

  it('returns null for invalid theme payloads', () => {
    expect(parseThemeFile(null)).toBeNull()
    expect(parseThemeFile({ format: 'other' })).toBeNull()
  })
})
