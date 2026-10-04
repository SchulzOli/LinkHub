import {
  type CSSProperties,
  type PointerEventHandler,
  type RefObject,
  type WheelEventHandler,
} from 'react'
import { createPortal } from 'react-dom'
import editPanelStyles from '../ui/panel/EditPanel.module.css'
import panelStyles from '../ui/panel/Panel.module.css'

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
import { CloseIcon } from '../taskbar/TaskbarIcons'
import { FormatPainterIcon } from '../ui/FormatPainterIcon'
import { EditPanel } from '../ui/panel/EditPanel'
import {
  IconButton,
  PanelSection,
  SettingRow,
  Slider,
  Switch,
} from '../ui/panel/Panel'
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
    <EditPanel
      actions={
        <>
          <IconButton
            label={`Copy format from ${card.id}`}
            title="Copy format to other cards or groups"
            onClick={onCopyFormat}
          >
            <FormatPainterIcon className={panelStyles.icon} />
          </IconButton>
          <IconButton
            label={`Exit editor for ${card.id}`}
            title="Close editor"
            onClick={onClose}
          >
            <CloseIcon className={panelStyles.icon} />
          </IconButton>
        </>
      }
      panelRef={editPanelRef}
      style={editPanelStyle ?? undefined}
      subtitle={card.url}
      testId="card-edit-panel"
      title={card.title || 'Link card'}
      onPointerDown={onPointerDown}
      onWheelCapture={onWheelCapture}
    >
      <PanelSection title="Link">
        <div className={`${panelStyles.row} ${panelStyles.rowStacked}`}>
          <label className={panelStyles.field}>
            <span className={panelStyles.fieldLabel}>Title</span>
            <input
              aria-label={`Edit title for ${card.id}`}
              value={titleDraft}
              onChange={(event) => {
                onTitleChange(event.target.value)
              }}
            />
          </label>
          <label className={panelStyles.field}>
            <span className={panelStyles.fieldLabel}>URL</span>
            <input
              aria-label={`Edit url for ${card.id}`}
              value={urlDraft}
              onChange={(event) => {
                onUrlChange(event.target.value)
              }}
            />
          </label>
          {!normalizedUpdateUrl ? (
            <p className={editPanelStyles.error}>
              Enter a valid http or https URL.
            </p>
          ) : null}
        </div>
        <SettingRow
          hint={
            card.faviconOverrideImageId
              ? 'A gallery image replaces the favicon.'
              : 'Uses the site favicon.'
          }
          label="Custom image"
        >
          {card.faviconOverrideImageId ? (
            <button
              className={`${panelStyles.button} ${panelStyles.buttonQuiet}`}
              type="button"
              onClick={onResetImageOverride}
            >
              Use default favicon
            </button>
          ) : null}
          <button
            className={panelStyles.button}
            type="button"
            onClick={onRequestImageOverridePicker}
          >
            {card.faviconOverrideImageId
              ? 'Change image'
              : 'Choose from gallery'}
          </button>
        </SettingRow>
        <SettingRow label="Show title">
          <Switch
            ariaLabel={`Show title on ${card.id}`}
            checked={showTitleDraft}
            onChange={onShowTitleChange}
          />
        </SettingRow>
        <SettingRow label="Show image">
          <Switch
            ariaLabel={`Show image on ${card.id}`}
            checked={showImageDraft}
            onChange={onShowImageChange}
          />
        </SettingRow>
      </PanelSection>

      <PanelSection title="Shape">
        <SettingRow hint="Grid cells" label="Size">
          <input
            aria-label={`Edit width for ${card.id}`}
            className={panelStyles.numberInput}
            inputMode="numeric"
            max={CARD_SIZE_LIMITS.max}
            min={CARD_SIZE_LIMITS.min}
            type="number"
            value={widthDraft}
            onChange={(event) => {
              onWidthChange(event.target.value)
            }}
          />
          <span aria-hidden="true">×</span>
          <input
            aria-label={`Edit height for ${card.id}`}
            className={panelStyles.numberInput}
            inputMode="numeric"
            max={CARD_SIZE_LIMITS.max}
            min={CARD_SIZE_LIMITS.min}
            type="number"
            value={heightDraft}
            onChange={(event) => {
              onHeightChange(event.target.value)
            }}
          />
        </SettingRow>
        {!normalizedCardSize ? (
          <div className={panelStyles.row}>
            <p className={editPanelStyles.error}>
              Enter a width and height between {CARD_SIZE_LIMITS.min} and{' '}
              {CARD_SIZE_LIMITS.max} cells.
            </p>
          </div>
        ) : null}
        <SettingRow label="Corner radius" stacked>
          <Slider
            ariaLabel={`Edit corner radius for ${card.id}`}
            max={CARD_CORNER_RADIUS_LIMITS.max}
            min={CARD_CORNER_RADIUS_LIMITS.min}
            value={cornerRadiusDraft}
            onChange={onCornerRadiusChange}
          />
        </SettingRow>
      </PanelSection>

      <PanelSection title="Style">
        <SettingRow label="Transparency" stacked>
          <Slider
            ariaLabel={`Edit transparency for ${card.id}`}
            max={SURFACE_TRANSPARENCY_LIMITS.max}
            min={SURFACE_TRANSPARENCY_LIMITS.min}
            value={surfaceTransparencyDraft}
            onChange={(value) =>
              onSurfaceTransparencyChange(value as SurfaceTransparency)
            }
          />
        </SettingRow>
        <LinkCardShadowMenu
          cardId={card.id}
          shadowStyle={shadowStyleDraft}
          onChange={onShadowStyleChange}
        />
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
      </PanelSection>
    </EditPanel>,
    document.body,
  )
}
