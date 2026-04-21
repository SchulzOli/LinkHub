import {
  type CSSProperties,
  type PointerEventHandler,
  type RefObject,
  type WheelEventHandler,
} from 'react'
import { createPortal } from 'react-dom'

import styles from './LinkCard.module.css'

import {
  CARD_CORNER_RADIUS_LIMITS,
  CARD_SIZE_LIMITS,
  type CardSize,
  type LinkCard as LinkCardModel,
} from '../../contracts/linkCard'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'
import { SURFACE_TRANSPARENCY_LIMITS } from '../../contracts/surfaceEffects'
import { getActiveThemeCardColorSettings } from '../../features/appearance/cardColorPalette'
import { FormatPainterIcon } from '../ui/FormatPainterIcon'
import { LinkCardColorEditor } from './LinkCardColorEditor'
import { LinkCardShadowMenu } from './LinkCardShadowMenu'

type LinkCardEditOverlayProps = {
  activeColorSettings: ReturnType<typeof getActiveThemeCardColorSettings>
  borderPresetIndexDraft: number | null
  card: LinkCardModel
  cornerRadiusDraft: number
  editPanelRef: RefObject<HTMLDivElement | null>
  editPanelStyle: CSSProperties | null
  fillPresetIndexDraft: number | null
  heightDraft: string
  normalizedCardSize: CardSize | null
  normalizedUpdateUrl: string | null
  selectedBorderColor: string | null
  selectedFillColor: string | null
  shadowStyleDraft: SurfaceShadowStyle
  showImageDraft: boolean
  showTitleDraft: boolean
  surfaceTransparencyDraft: SurfaceTransparency
  titleDraft: string
  urlDraft: string
  widthDraft: string
  onClose: () => void
  onCopyFormat: () => void
  onCornerRadiusChange: (value: number) => void
  onCustomBorderColorChange: (color: string) => void
  onCustomFillColorChange: (color: string) => void
  onHeightChange: (value: string) => void
  onPointerDown: PointerEventHandler<HTMLDivElement>
  onRequestImageOverridePicker: () => void
  onResetBorderPresets: () => void
  onResetFillPresets: () => void
  onResetImageOverride: () => void
  onSaveBorderPresets: (colors: string[]) => void
  onSaveFillPresets: (colors: string[]) => void
  onSelectBorderPreset: (index: number) => void
  onSelectFillPreset: (index: number) => void
  onShadowStyleChange: (value: SurfaceShadowStyle) => void
  onShowImageChange: (value: boolean) => void
  onShowTitleChange: (value: boolean) => void
  onSurfaceTransparencyChange: (value: SurfaceTransparency) => void
  onTitleChange: (value: string) => void
  onUrlChange: (value: string) => void
  onWheelCapture: WheelEventHandler<HTMLDivElement>
  onWidthChange: (value: string) => void
}

export function LinkCardEditOverlay({
  activeColorSettings,
  borderPresetIndexDraft,
  card,
  cornerRadiusDraft,
  editPanelRef,
  editPanelStyle,
  fillPresetIndexDraft,
  heightDraft,
  normalizedCardSize,
  normalizedUpdateUrl,
  selectedBorderColor,
  selectedFillColor,
  shadowStyleDraft,
  showImageDraft,
  showTitleDraft,
  surfaceTransparencyDraft,
  titleDraft,
  urlDraft,
  widthDraft,
  onClose,
  onCopyFormat,
  onCornerRadiusChange,
  onCustomBorderColorChange,
  onCustomFillColorChange,
  onHeightChange,
  onPointerDown,
  onRequestImageOverridePicker,
  onResetBorderPresets,
  onResetFillPresets,
  onResetImageOverride,
  onSaveBorderPresets,
  onSaveFillPresets,
  onSelectBorderPreset,
  onSelectFillPreset,
  onShadowStyleChange,
  onShowImageChange,
  onShowTitleChange,
  onSurfaceTransparencyChange,
  onTitleChange,
  onUrlChange,
  onWheelCapture,
  onWidthChange,
}: LinkCardEditOverlayProps) {
  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className={styles.editPanel}
      data-testid="card-edit-panel"
      ref={editPanelRef}
      style={editPanelStyle ?? undefined}
      onPointerDown={onPointerDown}
      onWheelCapture={onWheelCapture}
    >
      <div className={styles.editPanelHeader}>
        <div className={styles.editPanelHeaderActions}>
          <button
            aria-label={`Copy format from ${card.id}`}
            className={`${styles.secondaryActionButton} ${styles.iconHeaderButton}`}
            title="Copy format"
            type="button"
            onClick={onCopyFormat}
          >
            <FormatPainterIcon className={styles.actionSvg} />
          </button>
          <button
            aria-label={`Exit editor for ${card.id}`}
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
        <span className={styles.editLabel}>Title</span>
        <input
          aria-label={`Edit title for ${card.id}`}
          value={titleDraft}
          onChange={(event) => {
            onTitleChange(event.target.value)
          }}
        />
      </label>
      <label className={styles.editField}>
        <span className={styles.editLabel}>URL</span>
        <input
          aria-label={`Edit url for ${card.id}`}
          value={urlDraft}
          onChange={(event) => {
            onUrlChange(event.target.value)
          }}
        />
      </label>
      <div className={styles.editField}>
        <span className={styles.editLabel}>Custom image</span>
        <div className={styles.editActionRow}>
          <button
            className={styles.secondaryActionButton}
            type="button"
            onClick={onRequestImageOverridePicker}
          >
            {card.faviconOverrideImageId
              ? 'Change image'
              : 'Choose from gallery'}
          </button>
          {card.faviconOverrideImageId ? (
            <button
              className={styles.secondaryActionButton}
              type="button"
              onClick={onResetImageOverride}
            >
              Use default favicon
            </button>
          ) : null}
        </div>
        <p className={styles.editHint}>
          {card.faviconOverrideImageId
            ? 'A gallery image currently replaces the default favicon for this card.'
            : 'The backend favicon stays active until you choose a custom gallery image.'}
        </p>
      </div>
      <div className={styles.editSizeGrid}>
        <label className={styles.editField}>
          <span className={styles.editLabel}>Width</span>
          <input
            aria-label={`Edit width for ${card.id}`}
            inputMode="numeric"
            max={CARD_SIZE_LIMITS.max}
            min={CARD_SIZE_LIMITS.min}
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
            aria-label={`Edit height for ${card.id}`}
            inputMode="numeric"
            max={CARD_SIZE_LIMITS.max}
            min={CARD_SIZE_LIMITS.min}
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
            aria-label={`Edit corner radius for ${card.id}`}
            className={styles.editSlider}
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
      <div className={styles.editToggleGrid}>
        <label className={styles.editToggleField}>
          <input
            aria-label={`Show title on ${card.id}`}
            checked={showTitleDraft}
            type="checkbox"
            onChange={(event) => {
              onShowTitleChange(event.currentTarget.checked)
            }}
          />
          <span>Show title</span>
        </label>
        <label className={styles.editToggleField}>
          <input
            aria-label={`Show image on ${card.id}`}
            checked={showImageDraft}
            type="checkbox"
            onChange={(event) => {
              onShowImageChange(event.currentTarget.checked)
            }}
          />
          <span>Show image</span>
        </label>
      </div>
      <div className={styles.editEffectGrid}>
        <label className={styles.editField}>
          <span className={styles.editLabel}>Transparency</span>
          <div className={styles.editSliderRow}>
            <input
              aria-label={`Edit transparency for ${card.id}`}
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
        <LinkCardShadowMenu
          cardId={card.id}
          shadowStyle={shadowStyleDraft}
          onChange={onShadowStyleChange}
        />
      </div>
      <LinkCardColorEditor
        activeColorSettings={activeColorSettings}
        borderPresetIndexDraft={borderPresetIndexDraft}
        fillPresetIndexDraft={fillPresetIndexDraft}
        selectedBorderColor={selectedBorderColor}
        selectedFillColor={selectedFillColor}
        onCustomBorderColorChange={onCustomBorderColorChange}
        onCustomFillColorChange={onCustomFillColorChange}
        onResetBorderPresets={onResetBorderPresets}
        onResetFillPresets={onResetFillPresets}
        onSaveBorderPresets={onSaveBorderPresets}
        onSaveFillPresets={onSaveFillPresets}
        onSelectBorderPreset={onSelectBorderPreset}
        onSelectFillPreset={onSelectFillPreset}
      />
      {!normalizedUpdateUrl ? (
        <p className={styles.editError}>Enter a valid http or https URL.</p>
      ) : null}
      {!normalizedCardSize ? (
        <p className={styles.editError}>
          Enter a width and height between {CARD_SIZE_LIMITS.min} and{' '}
          {CARD_SIZE_LIMITS.max} cells.
        </p>
      ) : null}
    </div>,
    document.body,
  )
}
