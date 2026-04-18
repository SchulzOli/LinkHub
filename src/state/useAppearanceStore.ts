import { useWorkspaceStore } from './useWorkspaceStore'

export function useAppearanceStore() {
  const appearance = useWorkspaceStore((state) => state.workspace.appearance)
  const setThemeMode = useWorkspaceStore((state) => state.setThemeMode)
  const setDefaultCardSize = useWorkspaceStore(
    (state) => state.setDefaultCardSize,
  )
  const setDefaultCardCornerRadius = useWorkspaceStore(
    (state) => state.setDefaultCardCornerRadius,
  )
  const setDefaultCardShowTitle = useWorkspaceStore(
    (state) => state.setDefaultCardShowTitle,
  )
  const setDefaultCardShowImage = useWorkspaceStore(
    (state) => state.setDefaultCardShowImage,
  )
  const setDefaultCardOpenInNewTab = useWorkspaceStore(
    (state) => state.setDefaultCardOpenInNewTab,
  )
  const setDefaultSurfaceTransparency = useWorkspaceStore(
    (state) => state.setDefaultSurfaceTransparency,
  )
  const setDefaultSurfaceShadowStyle = useWorkspaceStore(
    (state) => state.setDefaultSurfaceShadowStyle,
  )
  const setFillPresets = useWorkspaceStore((state) => state.setFillPresets)
  const setBorderPresets = useWorkspaceStore((state) => state.setBorderPresets)
  const setDefaultFillPresetIndex = useWorkspaceStore(
    (state) => state.setDefaultFillPresetIndex,
  )
  const setDefaultBorderPresetIndex = useWorkspaceStore(
    (state) => state.setDefaultBorderPresetIndex,
  )
  const resetAppearanceOptions = useWorkspaceStore(
    (state) => state.resetAppearanceOptions,
  )
  const setStylePreset = useWorkspaceStore((state) => state.setStylePreset)
  const applyTheme = useWorkspaceStore((state) => state.applyTheme)
  const setStyleToken = useWorkspaceStore((state) => state.setStyleToken)
  const resetStyleTokens = useWorkspaceStore((state) => state.resetStyleTokens)

  return {
    appearance,
    setBorderPresets,
    setThemeMode,
    setDefaultCardCornerRadius,
    setDefaultCardSize,
    setDefaultCardShowTitle,
    setDefaultCardShowImage,
    setDefaultCardOpenInNewTab,
    setDefaultSurfaceTransparency,
    setDefaultSurfaceShadowStyle,
    setDefaultBorderPresetIndex,
    setDefaultFillPresetIndex,
    setFillPresets,
    resetAppearanceOptions,
    setStylePreset,
    applyTheme,
    setStyleToken,
    resetStyleTokens,
  }
}
