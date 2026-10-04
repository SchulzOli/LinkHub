import panelStyles from '../ui/panel/Panel.module.css'
import styles from './OptionsMenu.module.css'

import type { AppearanceProfile } from '../../contracts/appearanceProfile'
import {
  CARD_CORNER_RADIUS_LIMITS,
  CARD_SIZE_LIMITS,
  clampCardCornerRadius,
} from '../../contracts/linkCard'
import {
  SURFACE_TRANSPARENCY_LIMITS,
  clampSurfaceTransparency,
  type SurfaceShadowStyle,
} from '../../contracts/surfaceEffects'
import {
  isHtmlInCanvasSupported,
  setCanvasEffectsEnabled,
  useCanvasEffectsEnabled,
} from '../../effects'
import {
  getDefaultCardColorPresets,
  type getActiveThemeCardColorSettings,
} from '../../features/appearance/cardColorPalette'
import {
  SURFACE_SHADOW_STYLE_LABELS,
  SURFACE_SHADOW_STYLE_OPTIONS,
} from '../../features/appearance/surfaceEffects'
import { ColorPresetPicker } from '../ui/ColorPresetPicker'
import { PanelSection, SettingRow, Slider, Switch } from '../ui/panel/Panel'
import { SelectMenu } from '../ui/SelectMenu'

type OptionsAppearanceSectionProps = {
  appearance: AppearanceProfile
  activeColorSettings: ReturnType<typeof getActiveThemeCardColorSettings>
  menuId: string
  resetAppearanceOptions: () => void
  setBorderPresets: (colors: string[]) => void
  setDefaultBorderPresetIndex: (index: number) => void
  setDefaultCardCornerRadius: (value: number) => void
  setDefaultCardShowImage: (value: boolean) => void
  setDefaultCardShowTitle: (value: boolean) => void
  setDefaultCardOpenInNewTab: (value: boolean) => void
  setDefaultCardSize: (size: AppearanceProfile['defaultCardSize']) => void
  setDefaultFillPresetIndex: (index: number) => void
  setFaviconsOfflineOnly: (value: boolean) => void
  setDefaultSurfaceShadowStyle: (value: SurfaceShadowStyle) => void
  setDefaultSurfaceTransparency: (value: number) => void
  setFillPresets: (colors: string[]) => void
  setThemeMode: (value: AppearanceProfile['themeMode']) => void
  tabListId: string
}

export function OptionsAppearanceSection({
  appearance,
  activeColorSettings,
  menuId,
  resetAppearanceOptions,
  setBorderPresets,
  setDefaultBorderPresetIndex,
  setDefaultCardCornerRadius,
  setDefaultCardShowImage,
  setDefaultCardShowTitle,
  setDefaultCardOpenInNewTab,
  setDefaultCardSize,
  setFaviconsOfflineOnly,
  setDefaultFillPresetIndex,
  setDefaultSurfaceShadowStyle,
  setDefaultSurfaceTransparency,
  setFillPresets,
  setThemeMode,
  tabListId,
}: OptionsAppearanceSectionProps) {
  const canvasEffectsEnabled = useCanvasEffectsEnabled()
  const canvasEffectsSupported = isHtmlInCanvasSupported()
  const defaultColorPresets = getDefaultCardColorPresets(
    appearance.stylePreset,
    appearance.themeMode,
  )

  const setSizePart = (part: 'columns' | 'rows', nextValue: number) => {
    if (
      Number.isInteger(nextValue) &&
      nextValue >= CARD_SIZE_LIMITS.min &&
      nextValue <= CARD_SIZE_LIMITS.max
    ) {
      setDefaultCardSize({ ...appearance.defaultCardSize, [part]: nextValue })
    }
  }

  return (
    <div
      aria-labelledby={`${tabListId}-options`}
      className={styles.panelBody}
      id={`${menuId}-options`}
      role="tabpanel"
    >
      <div className={panelStyles.stack}>
        <PanelSection title="Appearance">
          <SettingRow
            hint="Light or dark variant of the active theme."
            label="Color mode"
          >
            <SelectMenu
              ariaLabel="Color mode"
              className={styles.compactSelect}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
              value={appearance.themeMode}
              onChange={(nextValue) =>
                setThemeMode(nextValue as typeof appearance.themeMode)
              }
            />
          </SettingRow>
          <SettingRow
            hint={
              canvasEffectsSupported
                ? 'Hover glint and ripple on new cards. This device only.'
                : 'Needs Chromium with chrome://flags/#canvas-draw-element.'
            }
            label="Card effects"
          >
            <Switch
              ariaLabel="Card effects"
              checked={canvasEffectsEnabled && canvasEffectsSupported}
              disabled={!canvasEffectsSupported}
              onChange={setCanvasEffectsEnabled}
            />
          </SettingRow>
        </PanelSection>

        <PanelSection title="Links">
          <SettingRow
            hint="Applies to every link card in this workspace."
            label="Open links in new tab"
          >
            <Switch
              ariaLabel="Open links in new tab"
              checked={appearance.defaultCardOpenInNewTab}
              onChange={setDefaultCardOpenInNewTab}
            />
          </SettingRow>
          <SettingRow
            hint="Skip the Google favicon service and use only the site's favicon.ico."
            label="Favicons offline-only"
          >
            <Switch
              ariaLabel="Favicons offline-only"
              checked={appearance.faviconsOfflineOnly}
              onChange={setFaviconsOfflineOnly}
            />
          </SettingRow>
        </PanelSection>

        <PanelSection
          description="Used when you create cards and groups. Existing nodes keep their style."
          title="New nodes"
        >
          <SettingRow hint="Grid cells, width × height." label="Size">
            <input
              aria-label="Default width"
              className={panelStyles.numberInput}
              max={CARD_SIZE_LIMITS.max}
              min={CARD_SIZE_LIMITS.min}
              type="number"
              value={appearance.defaultCardSize.columns}
              onChange={(event) =>
                setSizePart('columns', event.currentTarget.valueAsNumber)
              }
            />
            <span aria-hidden="true" className={styles.times}>
              ×
            </span>
            <input
              aria-label="Default height"
              className={panelStyles.numberInput}
              max={CARD_SIZE_LIMITS.max}
              min={CARD_SIZE_LIMITS.min}
              type="number"
              value={appearance.defaultCardSize.rows}
              onChange={(event) =>
                setSizePart('rows', event.currentTarget.valueAsNumber)
              }
            />
          </SettingRow>
          <SettingRow label="Corner radius" stacked>
            <Slider
              ariaLabel="Default corner radius"
              max={CARD_CORNER_RADIUS_LIMITS.max}
              min={CARD_CORNER_RADIUS_LIMITS.min}
              value={appearance.defaultCardCornerRadius}
              onChange={(value) =>
                setDefaultCardCornerRadius(clampCardCornerRadius(value))
              }
            />
          </SettingRow>
          <SettingRow label="Transparency" stacked>
            <Slider
              ariaLabel="Default transparency"
              max={SURFACE_TRANSPARENCY_LIMITS.max}
              min={SURFACE_TRANSPARENCY_LIMITS.min}
              value={appearance.defaultSurfaceTransparency}
              onChange={(value) =>
                setDefaultSurfaceTransparency(clampSurfaceTransparency(value))
              }
            />
          </SettingRow>
          <SettingRow label="Shadow">
            <SelectMenu
              ariaLabel="Default shadow"
              className={styles.compactSelect}
              options={SURFACE_SHADOW_STYLE_OPTIONS.map((value) => ({
                value,
                label: SURFACE_SHADOW_STYLE_LABELS[value],
              }))}
              value={appearance.defaultSurfaceShadowStyle}
              onChange={(nextValue) =>
                setDefaultSurfaceShadowStyle(
                  nextValue as typeof appearance.defaultSurfaceShadowStyle,
                )
              }
            />
          </SettingRow>
          <SettingRow label="Show title">
            <Switch
              ariaLabel="Default show title"
              checked={appearance.defaultCardShowTitle}
              onChange={setDefaultCardShowTitle}
            />
          </SettingRow>
          <SettingRow label="Show image">
            <Switch
              ariaLabel="Default show image"
              checked={appearance.defaultCardShowImage}
              onChange={setDefaultCardShowImage}
            />
          </SettingRow>
          <div className={`${panelStyles.row} ${panelStyles.rowStacked}`}>
            <ColorPresetPicker
              colors={activeColorSettings.fillPresets}
              hint="Default for new cards. Edit to change the five saved presets."
              kind="fill"
              label="Default fill"
              onResetPresets={() =>
                setFillPresets(defaultColorPresets.fillPresets)
              }
              onSavePresets={setFillPresets}
              onSelectPreset={setDefaultFillPresetIndex}
              selectedIndex={activeColorSettings.defaultFillPresetIndex}
              showDefaultBadge
            />
          </div>
          <div className={`${panelStyles.row} ${panelStyles.rowStacked}`}>
            <ColorPresetPicker
              colors={activeColorSettings.borderPresets}
              hint="Default for new cards. Edit to change the five saved presets."
              kind="border"
              label="Default border"
              onResetPresets={() =>
                setBorderPresets(defaultColorPresets.borderPresets)
              }
              onSavePresets={setBorderPresets}
              onSelectPreset={setDefaultBorderPresetIndex}
              selectedIndex={activeColorSettings.defaultBorderPresetIndex}
              showDefaultBadge
            />
          </div>
        </PanelSection>

        <div className={styles.footerRow}>
          <span className={panelStyles.rowHint}>
            Restores all options above. Saved color presets are kept.
          </span>
          <button
            aria-label="Reset options"
            className={`${panelStyles.button} ${panelStyles.buttonQuiet}`}
            onClick={resetAppearanceOptions}
            type="button"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
