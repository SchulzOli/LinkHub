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
  getDefaultCardColorPresets,
  type getActiveThemeCardColorSettings,
} from '../../features/appearance/cardColorPalette'
import {
  SURFACE_SHADOW_STYLE_LABELS,
  SURFACE_SHADOW_STYLE_OPTIONS,
} from '../../features/appearance/surfaceEffects'
import { ColorPresetPicker } from '../ui/ColorPresetPicker'
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
  setDefaultFillPresetIndex,
  setDefaultSurfaceShadowStyle,
  setDefaultSurfaceTransparency,
  setFillPresets,
  setThemeMode,
  tabListId,
}: OptionsAppearanceSectionProps) {
  const defaultColorPresets = getDefaultCardColorPresets(
    appearance.stylePreset,
    appearance.themeMode,
  )

  return (
    <div
      aria-labelledby={`${tabListId}-options`}
      className={styles.panelBody}
      id={`${menuId}-options`}
      role="tabpanel"
    >
      <div className={styles.fieldGrid}>
        <section className={styles.settingsSection}>
          <div className={styles.settingsSectionHeader}>
            <span className={styles.settingsSectionEyebrow}>System</span>
            <div className={styles.settingsSectionCopy}>
              <h3 className={styles.sectionTitle}>Workspace appearance</h3>
              <span className={styles.sectionMeta}>
                Affects the menu and overall theme mode for the current
                workspace.
              </span>
            </div>
          </div>
          <div className={styles.sectionFields}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Color mode</span>
              <span className={styles.fieldHint}>
                Switch between the light and dark variants of the active theme.
              </span>
              <SelectMenu
                ariaLabel="Color mode"
                className={styles.select}
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                ]}
                value={appearance.themeMode}
                onChange={(nextValue) =>
                  setThemeMode(nextValue as typeof appearance.themeMode)
                }
              />
            </label>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Link opening</span>
              <span className={styles.fieldHint}>
                Applies to every link card in this workspace and is not set per
                node.
              </span>
              <div className={styles.toggleGrid}>
                <label className={styles.toggleField}>
                  <input
                    aria-label="Open links in new tab"
                    checked={appearance.defaultCardOpenInNewTab}
                    type="checkbox"
                    onChange={(event) =>
                      setDefaultCardOpenInNewTab(event.currentTarget.checked)
                    }
                  />
                  <span>Open links in new tab</span>
                </label>
              </div>
            </div>
          </div>
        </section>
        <section className={styles.settingsSection}>
          <div className={styles.settingsSectionHeader}>
            <span className={styles.settingsSectionEyebrow}>Nodes</span>
            <div className={styles.settingsSectionCopy}>
              <h3 className={styles.sectionTitle}>Defaults for new nodes</h3>
              <span className={styles.sectionMeta}>
                These values are used when you create new cards and groups, not
                on existing nodes.
              </span>
            </div>
          </div>
          <div className={styles.sectionFields}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Default size</span>
              <span className={styles.fieldHint}>
                New cards start with these grid dimensions. The default stays at
                5x5.
              </span>
              <div className={styles.sizeInputs}>
                <label className={styles.sizeField}>
                  <span className={styles.sizeFieldLabel}>Width</span>
                  <input
                    aria-label="Default width"
                    className={styles.sizeInput}
                    max={CARD_SIZE_LIMITS.max}
                    min={CARD_SIZE_LIMITS.min}
                    type="number"
                    value={appearance.defaultCardSize.columns}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.valueAsNumber

                      if (
                        Number.isInteger(nextValue) &&
                        nextValue >= CARD_SIZE_LIMITS.min &&
                        nextValue <= CARD_SIZE_LIMITS.max
                      ) {
                        setDefaultCardSize({
                          ...appearance.defaultCardSize,
                          columns: nextValue,
                        })
                      }
                    }}
                  />
                </label>
                <label className={styles.sizeField}>
                  <span className={styles.sizeFieldLabel}>Height</span>
                  <input
                    aria-label="Default height"
                    className={styles.sizeInput}
                    max={CARD_SIZE_LIMITS.max}
                    min={CARD_SIZE_LIMITS.min}
                    type="number"
                    value={appearance.defaultCardSize.rows}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.valueAsNumber

                      if (
                        Number.isInteger(nextValue) &&
                        nextValue >= CARD_SIZE_LIMITS.min &&
                        nextValue <= CARD_SIZE_LIMITS.max
                      ) {
                        setDefaultCardSize({
                          ...appearance.defaultCardSize,
                          rows: nextValue,
                        })
                      }
                    }}
                  />
                </label>
              </div>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Default corner radius</span>
              <span className={styles.fieldHint}>
                Set how rounded new cards start, from hard corners to a full 50%
                pill shape.
              </span>
              <div className={styles.sliderRow}>
                <input
                  aria-label="Default corner radius"
                  className={styles.slider}
                  max={CARD_CORNER_RADIUS_LIMITS.max}
                  min={CARD_CORNER_RADIUS_LIMITS.min}
                  type="range"
                  value={appearance.defaultCardCornerRadius}
                  onChange={(event) =>
                    setDefaultCardCornerRadius(
                      clampCardCornerRadius(Number(event.currentTarget.value)),
                    )
                  }
                />
                <span className={styles.sliderValue}>
                  {appearance.defaultCardCornerRadius}%
                </span>
              </div>
            </label>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Default card details</span>
              <span className={styles.fieldHint}>
                Choose whether new cards show their title and image in the card
                view.
              </span>
              <div className={styles.toggleGrid}>
                <label className={styles.toggleField}>
                  <input
                    aria-label="Default show title"
                    checked={appearance.defaultCardShowTitle}
                    type="checkbox"
                    onChange={(event) =>
                      setDefaultCardShowTitle(event.currentTarget.checked)
                    }
                  />
                  <span>Show title</span>
                </label>
                <label className={styles.toggleField}>
                  <input
                    aria-label="Default show image"
                    checked={appearance.defaultCardShowImage}
                    type="checkbox"
                    onChange={(event) =>
                      setDefaultCardShowImage(event.currentTarget.checked)
                    }
                  />
                  <span>Show image</span>
                </label>
              </div>
            </div>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Default transparency</span>
              <span className={styles.fieldHint}>
                Adjust how transparent the whole card and group surface starts.
                0% stays solid, 100% becomes invisible.
              </span>
              <div className={styles.sliderRow}>
                <input
                  aria-label="Default transparency"
                  className={styles.slider}
                  max={SURFACE_TRANSPARENCY_LIMITS.max}
                  min={SURFACE_TRANSPARENCY_LIMITS.min}
                  type="range"
                  value={appearance.defaultSurfaceTransparency}
                  onChange={(event) =>
                    setDefaultSurfaceTransparency(
                      clampSurfaceTransparency(
                        Number(event.currentTarget.value),
                      ),
                    )
                  }
                />
                <span className={styles.sliderValue}>
                  {appearance.defaultSurfaceTransparency}%
                </span>
              </div>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Default shadow</span>
              <span className={styles.fieldHint}>
                Choose how strongly new cards and groups lift off the canvas,
                from tight to lifted or completely flat.
              </span>
              <SelectMenu
                ariaLabel="Default shadow"
                className={styles.select}
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
            </label>
            <div className={styles.field}>
              <ColorPresetPicker
                colors={activeColorSettings.fillPresets}
                hint="Choose the default fill color for new cards or edit the five saved fill presets."
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
            <div className={styles.field}>
              <ColorPresetPicker
                colors={activeColorSettings.borderPresets}
                hint="Choose the default border color for new cards or edit the five saved border presets."
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
          </div>
        </section>
        <div className={styles.resetRow}>
          <button
            aria-label="Reset options"
            className={styles.resetButton}
            onClick={resetAppearanceOptions}
            type="button"
          >
            Reset
          </button>
          <span className={styles.resetHint}>
            Resets both sections except saved color presets: system appearance
            and defaults for future nodes.
          </span>
        </div>
      </div>
    </div>
  )
}
