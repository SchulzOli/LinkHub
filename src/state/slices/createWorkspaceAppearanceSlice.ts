import type { StateCreator } from 'zustand'

import {
  replaceAppearance,
  replacePlacementGuide,
  replaceViewport,
} from '../../contracts/workspace'
import {
  getDefaultCardColorPresetMap,
  getDefaultCardPresetIndex,
} from '../../features/appearance/cardColorPalette'
import { APPEARANCE_STYLE_PRESETS } from '../../features/appearance/stylePresets'
import { applyThemeToAppearance } from '../../features/themes/themeLibrary'
import {
  commitWorkspaceChange,
  resetAppearanceNonColorOptions,
} from '../workspaceStoreHelpers'
import type {
  WorkspaceAppearanceState,
  WorkspaceState,
} from '../workspaceStoreTypes'

export const createWorkspaceAppearanceSlice: StateCreator<
  WorkspaceState,
  [],
  [],
  WorkspaceAppearanceState
> = (set) => ({
  setViewport: (viewport) =>
    set((state) => ({ workspace: replaceViewport(state.workspace, viewport) })),
  setThemeMode: (themeMode) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, {
          ...state.workspace.appearance,
          themeMode,
        }),
      ),
    })),
  setDefaultCardSize: (defaultCardSize) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, {
          ...state.workspace.appearance,
          defaultCardSize,
        }),
      ),
    })),
  setDefaultCardCornerRadius: (defaultCardCornerRadius) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, {
          ...state.workspace.appearance,
          defaultCardCornerRadius,
        }),
      ),
    })),
  setDefaultCardShowTitle: (defaultCardShowTitle) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, {
          ...state.workspace.appearance,
          defaultCardShowTitle,
        }),
      ),
    })),
  setDefaultCardShowImage: (defaultCardShowImage) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, {
          ...state.workspace.appearance,
          defaultCardShowImage,
        }),
      ),
    })),
  setDefaultCardOpenInNewTab: (defaultCardOpenInNewTab) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, {
          ...state.workspace.appearance,
          defaultCardOpenInNewTab,
        }),
      ),
    })),
  setDefaultSurfaceTransparency: (defaultSurfaceTransparency) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, {
          ...state.workspace.appearance,
          defaultSurfaceTransparency,
        }),
      ),
    })),
  setDefaultSurfaceShadowStyle: (defaultSurfaceShadowStyle) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, {
          ...state.workspace.appearance,
          defaultSurfaceShadowStyle,
        }),
      ),
    })),
  setFillPresets: (fillPresets) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, {
          ...state.workspace.appearance,
          fillPresetsByTheme: {
            ...state.workspace.appearance.fillPresetsByTheme,
            [state.workspace.appearance.themeMode]: [...fillPresets],
          },
        }),
      ),
    })),
  setBorderPresets: (borderPresets) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, {
          ...state.workspace.appearance,
          borderPresetsByTheme: {
            ...state.workspace.appearance.borderPresetsByTheme,
            [state.workspace.appearance.themeMode]: [...borderPresets],
          },
        }),
      ),
    })),
  setDefaultFillPresetIndex: (defaultFillPresetIndex) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, {
          ...state.workspace.appearance,
          defaultFillPresetIndexByTheme: {
            ...state.workspace.appearance.defaultFillPresetIndexByTheme,
            [state.workspace.appearance.themeMode]: defaultFillPresetIndex,
          },
        }),
      ),
    })),
  setDefaultBorderPresetIndex: (defaultBorderPresetIndex) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, {
          ...state.workspace.appearance,
          defaultBorderPresetIndexByTheme: {
            ...state.workspace.appearance.defaultBorderPresetIndexByTheme,
            [state.workspace.appearance.themeMode]: defaultBorderPresetIndex,
          },
        }),
      ),
    })),
  resetAppearanceOptions: () =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        resetAppearanceNonColorOptions(state.workspace),
      ),
    })),
  setStylePreset: (stylePreset) =>
    set((state) => {
      const presetTokens = APPEARANCE_STYLE_PRESETS[stylePreset].modes
      const colorPresets = getDefaultCardColorPresetMap(stylePreset)
      const defaultIndex = getDefaultCardPresetIndex()

      return {
        ...commitWorkspaceChange(
          state,
          replaceAppearance(state.workspace, {
            ...state.workspace.appearance,
            stylePreset,
            activeThemeId: `builtin:${stylePreset}`,
            styleTokens: {
              light: { ...presetTokens.light },
              dark: { ...presetTokens.dark },
            },
            fillPresetsByTheme: {
              light: [...colorPresets.light.fillPresets],
              dark: [...colorPresets.dark.fillPresets],
            },
            borderPresetsByTheme: {
              light: [...colorPresets.light.borderPresets],
              dark: [...colorPresets.dark.borderPresets],
            },
            defaultFillPresetIndexByTheme: {
              light: defaultIndex,
              dark: defaultIndex,
            },
            defaultBorderPresetIndexByTheme: {
              light: defaultIndex,
              dark: defaultIndex,
            },
          }),
        ),
      }
    }),
  setPlacementGuide: (placementGuide) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replacePlacementGuide(state.workspace, placementGuide),
      ),
    })),
  setAppearance: (appearance) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, appearance),
      ),
    })),
  applyTheme: (themeId, content) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(
          state.workspace,
          applyThemeToAppearance(state.workspace.appearance, themeId, content),
        ),
      ),
    })),
  setStyleToken: (mode, tokenKey, value) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAppearance(state.workspace, {
          ...state.workspace.appearance,
          activeThemeId: null,
          styleTokens: {
            ...state.workspace.appearance.styleTokens,
            [mode]: {
              ...state.workspace.appearance.styleTokens[mode],
              [tokenKey]: value,
            },
          },
        }),
      ),
    })),
  resetStyleTokens: () =>
    set((state) => {
      const presetTokens =
        APPEARANCE_STYLE_PRESETS[state.workspace.appearance.stylePreset].modes

      return {
        ...commitWorkspaceChange(
          state,
          replaceAppearance(state.workspace, {
            ...state.workspace.appearance,
            activeThemeId: null,
            styleTokens: {
              light: { ...presetTokens.light },
              dark: { ...presetTokens.dark },
            },
          }),
        ),
      }
    }),
})
