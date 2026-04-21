import { useShallow } from 'zustand/react/shallow'

import { useWorkspaceStore } from './useWorkspaceStore'

export function useAppearanceStore() {
  return useWorkspaceStore(
    useShallow((state) => ({
      appearance: state.workspace.appearance,
      setThemeMode: state.setThemeMode,
      setDefaultCardSize: state.setDefaultCardSize,
      setDefaultCardCornerRadius: state.setDefaultCardCornerRadius,
      setDefaultCardShowTitle: state.setDefaultCardShowTitle,
      setDefaultCardShowImage: state.setDefaultCardShowImage,
      setDefaultCardOpenInNewTab: state.setDefaultCardOpenInNewTab,
      setDefaultSurfaceTransparency: state.setDefaultSurfaceTransparency,
      setDefaultSurfaceShadowStyle: state.setDefaultSurfaceShadowStyle,
      setFillPresets: state.setFillPresets,
      setBorderPresets: state.setBorderPresets,
      setDefaultFillPresetIndex: state.setDefaultFillPresetIndex,
      setDefaultBorderPresetIndex: state.setDefaultBorderPresetIndex,
      resetAppearanceOptions: state.resetAppearanceOptions,
      setStylePreset: state.setStylePreset,
      applyTheme: state.applyTheme,
      setStyleToken: state.setStyleToken,
      resetStyleTokens: state.resetStyleTokens,
    })),
  )
}
