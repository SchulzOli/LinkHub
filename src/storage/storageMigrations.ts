import {
  defaultAppearanceProfile,
  resetAppearanceNonColorOptions,
  type AppearanceProfile,
  type ThemeMode,
} from '../contracts/appearanceProfile'
import {
  coerceCardColorPresetIndex,
  coerceCardColorPresetRow,
} from '../contracts/cardColors'
import { coerceCardGroup, type CardGroup } from '../contracts/cardGroup'
import {
  coerceCardCornerRadius,
  coerceCardSize,
  coerceCardVisibility,
  coerceCardVisibilityDefault,
  coerceLinkCardColors,
  DEFAULT_CARD_CORNER_RADIUS,
  DEFAULT_CARD_SIZE,
  type LinkCard,
} from '../contracts/linkCard'
import { coercePictureNode, type PictureNode } from '../contracts/pictureNode'
import {
  coerceSurfaceShadowStyle,
  coerceSurfaceTransparency,
  DEFAULT_SURFACE_SHADOW_STYLE,
  DEFAULT_SURFACE_TRANSPARENCY,
} from '../contracts/surfaceEffects'
import type { StyleTokensByMode } from '../contracts/theme'
import {
  createDefaultWorkspace,
  LATEST_WORKSPACE_SCHEMA_VERSION,
  WorkspaceSchema,
  type Workspace,
} from '../contracts/workspace'
import { coerceWorkspaceAnalytics } from '../contracts/workspaceAnalytics'
import { getDefaultCardColorPresetMap } from '../features/appearance/cardColorPalette'
import { APPEARANCE_STYLE_PRESETS } from '../features/appearance/stylePresets'

function coerceStyleTokens(
  raw: unknown,
  stylePreset: 'excalidraw' | 'blueprint',
): StyleTokensByMode {
  const preset = APPEARANCE_STYLE_PRESETS[stylePreset]

  if (typeof raw !== 'object' || raw === null) {
    return { light: { ...preset.modes.light }, dark: { ...preset.modes.dark } }
  }

  const candidate = raw as Partial<StyleTokensByMode>
  const lightBase = preset.modes.light
  const darkBase = preset.modes.dark

  return {
    light:
      typeof candidate.light === 'object' && candidate.light !== null
        ? { ...lightBase, ...candidate.light }
        : { ...lightBase },
    dark:
      typeof candidate.dark === 'object' && candidate.dark !== null
        ? { ...darkBase, ...candidate.dark }
        : { ...darkBase },
  }
}

function migrateAppearance(rawAppearance: unknown): AppearanceProfile {
  if (typeof rawAppearance !== 'object' || rawAppearance === null) {
    return defaultAppearanceProfile
  }

  const appearance = rawAppearance as Partial<AppearanceProfile> & {
    densityMode?: unknown
    defaultCardSize?: unknown
    defaultCardCornerRadius?: unknown
    defaultCardShowTitle?: unknown
    defaultCardShowImage?: unknown
    defaultCardOpenInNewTab?: unknown
    defaultSurfaceTransparency?: unknown
    defaultSurfaceEdgeFade?: unknown
    defaultSurfaceShadowStyle?: unknown
    fillPresetsByTheme?: unknown
    borderPresetsByTheme?: unknown
    defaultFillPresetIndexByTheme?: unknown
    defaultBorderPresetIndexByTheme?: unknown
    fillPresets?: unknown
    borderPresets?: unknown
    defaultFillPresetIndex?: unknown
    defaultBorderPresetIndex?: unknown
    styleTokens?: unknown
    activeThemeId?: unknown
  }

  const themeMode =
    appearance.themeMode === 'light' || appearance.themeMode === 'dark'
      ? appearance.themeMode
      : defaultAppearanceProfile.themeMode
  const stylePreset =
    appearance.stylePreset === 'blueprint' ||
    appearance.stylePreset === 'excalidraw'
      ? appearance.stylePreset
      : defaultAppearanceProfile.stylePreset
  const defaultPresetMap = getDefaultCardColorPresetMap(stylePreset)

  const coerceThemeRows = (
    rawMap: unknown,
    legacyRow: unknown,
    key: 'fillPresets' | 'borderPresets',
  ) => {
    const candidate = rawMap as Partial<Record<ThemeMode, unknown>> | undefined

    return {
      light: coerceCardColorPresetRow(
        candidate?.light,
        defaultPresetMap.light[key],
      ),
      dark: coerceCardColorPresetRow(
        candidate?.dark,
        defaultPresetMap.dark[key],
      ),
      [themeMode]: coerceCardColorPresetRow(
        legacyRow,
        defaultPresetMap[themeMode][key],
      ),
    }
  }

  const coerceThemeIndexes = (
    rawMap: unknown,
    legacyValue: unknown,
    fallbackKey:
      | 'defaultFillPresetIndexByTheme'
      | 'defaultBorderPresetIndexByTheme',
  ) => {
    const candidate = rawMap as Partial<Record<ThemeMode, unknown>> | undefined

    return {
      light: coerceCardColorPresetIndex(
        candidate?.light,
        defaultAppearanceProfile[fallbackKey].light,
      ),
      dark: coerceCardColorPresetIndex(
        candidate?.dark,
        defaultAppearanceProfile[fallbackKey].dark,
      ),
      [themeMode]: coerceCardColorPresetIndex(
        legacyValue,
        defaultAppearanceProfile[fallbackKey][themeMode],
      ),
    }
  }

  return {
    ...resetAppearanceNonColorOptions(defaultAppearanceProfile),
    ...defaultAppearanceProfile,
    ...appearance,
    themeMode,
    stylePreset,
    defaultCardSize: coerceCardSize(
      appearance.defaultCardSize ?? appearance.densityMode,
      DEFAULT_CARD_SIZE,
    ),
    defaultCardCornerRadius: coerceCardCornerRadius(
      appearance.defaultCardCornerRadius,
      DEFAULT_CARD_CORNER_RADIUS,
    ),
    defaultCardShowTitle: coerceCardVisibilityDefault(
      appearance.defaultCardShowTitle,
      defaultAppearanceProfile.defaultCardShowTitle,
    ),
    defaultCardShowImage: coerceCardVisibilityDefault(
      appearance.defaultCardShowImage,
      defaultAppearanceProfile.defaultCardShowImage,
    ),
    defaultCardOpenInNewTab: coerceCardVisibilityDefault(
      appearance.defaultCardOpenInNewTab,
      defaultAppearanceProfile.defaultCardOpenInNewTab,
    ),
    defaultSurfaceTransparency: coerceSurfaceTransparency(
      appearance.defaultSurfaceTransparency ??
        appearance.defaultSurfaceEdgeFade,
      defaultAppearanceProfile.defaultSurfaceTransparency,
    ),
    defaultSurfaceShadowStyle: coerceSurfaceShadowStyle(
      appearance.defaultSurfaceShadowStyle,
      defaultAppearanceProfile.defaultSurfaceShadowStyle,
    ),
    fillPresetsByTheme: coerceThemeRows(
      appearance.fillPresetsByTheme,
      appearance.fillPresets,
      'fillPresets',
    ),
    borderPresetsByTheme: coerceThemeRows(
      appearance.borderPresetsByTheme,
      appearance.borderPresets,
      'borderPresets',
    ),
    defaultFillPresetIndexByTheme: coerceThemeIndexes(
      appearance.defaultFillPresetIndexByTheme,
      appearance.defaultFillPresetIndex,
      'defaultFillPresetIndexByTheme',
    ),
    defaultBorderPresetIndexByTheme: coerceThemeIndexes(
      appearance.defaultBorderPresetIndexByTheme,
      appearance.defaultBorderPresetIndex,
      'defaultBorderPresetIndexByTheme',
    ),
    activeThemeId:
      typeof appearance.activeThemeId === 'string'
        ? appearance.activeThemeId
        : null,
    styleTokens: coerceStyleTokens(appearance.styleTokens, stylePreset),
  }
}

function migrateCards(rawCards: unknown): LinkCard[] {
  if (!Array.isArray(rawCards)) {
    return []
  }

  return rawCards.flatMap((rawCard) => {
    if (typeof rawCard !== 'object' || rawCard === null) {
      return []
    }

    const card = rawCard as LinkCard & {
      size?: unknown
      openInNewTab?: unknown
    }
    const cardWithoutLegacyOpenTarget = { ...card }

    delete cardWithoutLegacyOpenTarget.openInNewTab
    const colors = coerceLinkCardColors(card)

    return [
      {
        ...cardWithoutLegacyOpenTarget,
        size: coerceCardSize(card.size, DEFAULT_CARD_SIZE),
        cornerRadius: coerceCardCornerRadius(card.cornerRadius),
        showTitle: coerceCardVisibility(card.showTitle),
        showImage: coerceCardVisibility(
          (card as { showImage?: unknown }).showImage,
        ),
        fillPresetIndex: colors.fillPresetIndex,
        borderPresetIndex: colors.borderPresetIndex,
        fillColor: colors.fillColor,
        borderColor: colors.borderColor,
        surfaceTransparency: coerceSurfaceTransparency(
          (card as { surfaceTransparency?: unknown; edgeFade?: unknown })
            .surfaceTransparency ?? (card as { edgeFade?: unknown }).edgeFade,
          DEFAULT_SURFACE_TRANSPARENCY,
        ),
        shadowStyle: coerceSurfaceShadowStyle(
          (card as { shadowStyle?: unknown }).shadowStyle,
          DEFAULT_SURFACE_SHADOW_STYLE,
        ),
        groupId:
          typeof (card as { groupId?: unknown }).groupId === 'string' &&
          (card as { groupId?: string }).groupId
            ? (card as { groupId?: string }).groupId
            : undefined,
        faviconOverrideImageId:
          typeof (card as { faviconOverrideImageId?: unknown })
            .faviconOverrideImageId === 'string' &&
          (card as { faviconOverrideImageId?: string }).faviconOverrideImageId
            ? (card as { faviconOverrideImageId?: string })
                .faviconOverrideImageId
            : undefined,
      },
    ]
  })
}

function migrateGroups(rawGroups: unknown): CardGroup[] {
  if (!Array.isArray(rawGroups)) {
    return []
  }

  return rawGroups.flatMap((rawGroup) => {
    const group = coerceCardGroup(rawGroup)

    return group ? [group] : []
  })
}

function migratePictures(rawPictures: unknown): PictureNode[] {
  if (!Array.isArray(rawPictures)) {
    return []
  }

  return rawPictures.flatMap((rawPicture) => {
    const picture = coercePictureNode(rawPicture)

    return picture ? [picture] : []
  })
}

/**
 * Normalizes persisted workspace data from any supported historic shape into
 * the current contract. This is the central migration entry point used when
 * loading stored user data.
 *
 * Records, die bereits mit der aktuellen `LATEST_WORKSPACE_SCHEMA_VERSION`
 * getagged sind, werden ohne Coercer-Lauf zurückgegeben. Alle anderen Pfade
 * stempeln das Ergebnis mit `schemaVersion: LATEST_WORKSPACE_SCHEMA_VERSION`,
 * damit der nächste Read die Schnell-Pfad-Prüfung nimmt.
 */
export function ensureLatestWorkspace(raw: unknown): Workspace {
  const parsed = WorkspaceSchema.safeParse(raw)

  if (parsed.success) {
    if (parsed.data.schemaVersion === LATEST_WORKSPACE_SCHEMA_VERSION) {
      return parsed.data
    }

    return {
      ...parsed.data,
      schemaVersion: LATEST_WORKSPACE_SCHEMA_VERSION,
      pictures: migratePictures(parsed.data.pictures),
    }
  }

  if (typeof raw === 'object' && raw !== null) {
    const workspace = raw as Partial<Workspace> & {
      appearance?: unknown
      analytics?: unknown
      cards?: unknown
      groups?: unknown
      pictures?: unknown
    }

    return createDefaultWorkspace({
      ...workspace,
      schemaVersion: LATEST_WORKSPACE_SCHEMA_VERSION,
      appearance: migrateAppearance(workspace.appearance),
      analytics: coerceWorkspaceAnalytics(workspace.analytics),
      groups: migrateGroups(workspace.groups),
      cards: migrateCards(workspace.cards),
      pictures: migratePictures(workspace.pictures),
    })
  }

  return createDefaultWorkspace()
}
