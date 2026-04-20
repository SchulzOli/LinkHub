import {
  type CSSProperties,
  type PointerEventHandler,
  type RefObject,
  type WheelEventHandler,
} from 'react'
import { createPortal } from 'react-dom'

import styles from './GroupFrame.module.css'

import type { CardGroup, GroupSize } from '../../contracts/cardGroup'
import { GROUP_SIZE_LIMITS } from '../../contracts/cardGroup'
import { CARD_CORNER_RADIUS_LIMITS } from '../../contracts/linkCard'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'
import { SURFACE_TRANSPARENCY_LIMITS } from '../../contracts/surfaceEffects'
import { getActiveThemeCardColorSettings } from '../../features/appearance/cardColorPalette'
import {
  SURFACE_SHADOW_STYLE_LABELS,
  SURFACE_SHADOW_STYLE_OPTIONS,
} from '../../features/appearance/surfaceEffects'
import { ColorPresetPicker } from '../ui/ColorPresetPicker'
import { FormatPainterIcon } from '../ui/FormatPainterIcon'
import { SelectMenu } from '../ui/SelectMenu'

type GroupFrameEditOverlayProps = {
  activeColorSettings: ReturnType<typeof getActiveThemeCardColorSettings>
  borderPresetIndexDraft: number | null
  cornerRadiusDraft: number
  editPanelRef: RefObject<HTMLDivElement | null>
  editPanelStyle: CSSProperties | null
  fillPresetIndexDraft: number | null
  group: CardGroup
  heightDraft: string
  nameDraft: string
  normalizedGroupSize: GroupSize | null
  selectedBorderColor: string | null
  selectedFillColor: string | null
  shadowStyleDraft: SurfaceShadowStyle
  showTitleDraft: boolean
  surfaceTransparencyDraft: SurfaceTransparency
  widthDraft: string
  onClose: () => void
  onCopyFormat: () => void
  onCornerRadiusChange: (value: number) => void
  onCustomBorderColorChange: (color: string) => void
  onCustomFillColorChange: (color: string) => void
  onHeightChange: (value: string) => void
  onNameChange: (value: string) => void
  onPointerDown: PointerEventHandler<HTMLDivElement>
  onResetBorderPresets: () => void
  onResetFillPresets: () => void
  onSaveBorderPresets: (colors: string[]) => void
  onSaveFillPresets: (colors: string[]) => void
  onSelectBorderPreset: (index: number) => void
  onSelectFillPreset: (index: number) => void
  onShadowStyleChange: (value: SurfaceShadowStyle) => void
  onShowTitleChange: (value: boolean) => void
  onSurfaceTransparencyChange: (value: SurfaceTransparency) => void
  onWheelCapture: WheelEventHandler<HTMLDivElement>
  onWidthChange: (value: string) => void
}

export function GroupFrameEditOverlay({
  activeColorSettings,
  borderPresetIndexDraft,
  cornerRadiusDraft,
  editPanelRef,
  editPanelStyle,
  fillPresetIndexDraft,
  group,
  heightDraft,
  nameDraft,
  normalizedGroupSize,
  selectedBorderColor,
  selectedFillColor,
  shadowStyleDraft,
  showTitleDraft,
  surfaceTransparencyDraft,
  widthDraft,
  onClose,
  onCopyFormat,
  onCornerRadiusChange,
  onCustomBorderColorChange,
  onCustomFillColorChange,
  onHeightChange,
  onNameChange,
  onPointerDown,
  onResetBorderPresets,
  onResetFillPresets,
  onSaveBorderPresets,
  onSaveFillPresets,
  onSelectBorderPreset,
  onSelectFillPreset,
  onShadowStyleChange,
  onShowTitleChange,
  onSurfaceTransparencyChange,
  onWheelCapture,
  onWidthChange,
}: GroupFrameEditOverlayProps) {
  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className={styles.editPanel}
      data-testid="group-edit-panel"
      ref={editPanelRef}
      style={editPanelStyle ?? undefined}
      onPointerDown={onPointerDown}
      onWheelCapture={onWheelCapture}
    >
      <div className={styles.editPanelHeader}>
        <div className={styles.editPanelHeaderActions}>
          <button
            aria-label={`Copy format from group ${group.id}`}
            className={`${styles.secondaryActionButton} ${styles.iconHeaderButton}`}
            title="Copy format"
            type="button"
            onClick={onCopyFormat}
          >
            <FormatPainterIcon className={styles.actionSvg} />
          </button>
          <button
            aria-label={`Exit editor for group ${group.id}`}
            className={styles.closeEditButton}
            type="button"
            onClick={onClose}
          >
            Exit
          </button>
        </div>
      </div>
      <p className={styles.editHint}>
        Apply this styling, shape, and size to other cards or groups. Press
        Escape or click empty canvas to stop.
      </p>
      <label className={styles.editField}>
        <span className={styles.editLabel}>Group name</span>
        <input
          aria-label={`Edit group name for ${group.id}`}
          value={nameDraft}
          onChange={(event) => {
            onNameChange(event.target.value)
          }}
        />
      </label>
      <div className={styles.editSizeGrid}>
        <label className={styles.editField}>
          <span className={styles.editLabel}>Width</span>
          <input
            aria-label={`Edit group width for ${group.id}`}
            inputMode="numeric"
            min={GROUP_SIZE_LIMITS.min}
            type="number"
            value={widthDraft}
            onChange={(event) => {
              onWidthChange(event.target.value)
            }}
          />
        </label>
        <label className={styles.editField}>
          <span className={styles.editLabel}>Height</span>
          <input
            aria-label={`Edit group height for ${group.id}`}
            inputMode="numeric"
            min={GROUP_SIZE_LIMITS.min}
            type="number"
            value={heightDraft}
            onChange={(event) => {
              onHeightChange(event.target.value)
            }}
          />
        </label>
      </div>
      <label className={styles.editField}>
        <span className={styles.editLabel}>Corner radius</span>
        <div className={styles.editSliderRow}>
          <input
            aria-label={`Edit group corner radius for ${group.id}`}
            max={CARD_CORNER_RADIUS_LIMITS.max}
            min={CARD_CORNER_RADIUS_LIMITS.min}
            type="range"
            value={cornerRadiusDraft}
            onChange={(event) => {
              onCornerRadiusChange(Number(event.currentTarget.value))
            }}
          />
          <span className={styles.editSliderValue}>{cornerRadiusDraft}%</span>
        </div>
      </label>
      <label className={styles.editToggleField}>
        <input
          aria-label={`Show title on group ${group.id}`}
          checked={showTitleDraft}
          type="checkbox"
          onChange={(event) => {
            onShowTitleChange(event.currentTarget.checked)
          }}
        />
        <span>Show title</span>
      </label>
      <div className={styles.editEffectGrid}>
        <label className={styles.editField}>
          <span className={styles.editLabel}>Transparency</span>
          <div className={styles.editSliderRow}>
            <input
              aria-label={`Edit transparency for group ${group.id}`}
              className={styles.editSlider}
              max={SURFACE_TRANSPARENCY_LIMITS.max}
              min={SURFACE_TRANSPARENCY_LIMITS.min}
              type="range"
              value={surfaceTransparencyDraft}
              onChange={(event) => {
                onSurfaceTransparencyChange(
                  Number(event.currentTarget.value) as SurfaceTransparency,
                )
              }}
            />
            <span className={styles.editSliderValue}>
              {surfaceTransparencyDraft}%
            </span>
          </div>
        </label>
        <label className={styles.editField}>
          <span className={styles.editLabel}>Shadow</span>
          <SelectMenu
            ariaLabel={`Edit shadow for group ${group.id}`}
            className={styles.editSelect}
            options={SURFACE_SHADOW_STYLE_OPTIONS.map((value) => ({
              value,
              label: SURFACE_SHADOW_STYLE_LABELS[value],
            }))}
            value={shadowStyleDraft}
            onChange={(nextValue) => {
              onShadowStyleChange(nextValue as SurfaceShadowStyle)
            }}
          />
        </label>
      </div>
      <ColorPresetPicker
        allowCustomColor
        colors={activeColorSettings.fillPresets}
        hint="Use one of your five saved fill presets or pick a free color for this group."
        kind="fill"
        label="Fill color"
        onCustomColorChange={onCustomFillColorChange}
        onResetPresets={onResetFillPresets}
        onSavePresets={onSaveFillPresets}
        onSelectPreset={onSelectFillPreset}
        selectedColor={selectedFillColor}
        selectedIndex={fillPresetIndexDraft ?? undefined}
      />
      <ColorPresetPicker
        allowCustomColor
        colors={activeColorSettings.borderPresets}
        hint="Use one of your five saved border presets or pick a free color for this group."
        kind="border"
        label="Border color"
        onCustomColorChange={onCustomBorderColorChange}
        onResetPresets={onResetBorderPresets}
        onSavePresets={onSaveBorderPresets}
        onSelectPreset={onSelectBorderPreset}
        selectedColor={selectedBorderColor}
        selectedIndex={borderPresetIndexDraft ?? undefined}
      />
      {!nameDraft.trim() ? (
        <p className={styles.editError}>Enter a group name.</p>
      ) : null}
      {!normalizedGroupSize ? (
        <p className={styles.editError}>
          Enter a width and height of at least {GROUP_SIZE_LIMITS.min} cells.
        </p>
      ) : null}
    </div>,
    document.body,
  )
}
