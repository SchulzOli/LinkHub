import {
  type CSSProperties,
  type PointerEventHandler,
  type RefObject,
  type WheelEventHandler,
} from 'react'
import { createPortal } from 'react-dom'
import editPanelStyles from '../ui/panel/EditPanel.module.css'
import panelStyles from '../ui/panel/Panel.module.css'

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
import { CloseIcon } from '../taskbar/TaskbarIcons'
import { ColorPresetPicker } from '../ui/ColorPresetPicker'
import { FormatPainterIcon } from '../ui/FormatPainterIcon'
import { EditPanel } from '../ui/panel/EditPanel'
import {
  IconButton,
  PanelSection,
  SettingRow,
  Slider,
  Switch,
} from '../ui/panel/Panel'
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
    <EditPanel
      actions={
        <>
          <IconButton
            label={`Copy format from group ${group.id}`}
            title="Copy format to other cards or groups"
            onClick={onCopyFormat}
          >
            <FormatPainterIcon className={panelStyles.icon} />
          </IconButton>
          <IconButton
            label={`Exit editor for group ${group.id}`}
            title="Close editor"
            onClick={onClose}
          >
            <CloseIcon className={panelStyles.icon} />
          </IconButton>
        </>
      }
      panelRef={editPanelRef}
      style={editPanelStyle ?? undefined}
      subtitle="Group"
      testId="group-edit-panel"
      title={group.name || 'Group'}
      onPointerDown={onPointerDown}
      onWheelCapture={onWheelCapture}
    >
      <PanelSection title="Group">
        <div className={`${panelStyles.row} ${panelStyles.rowStacked}`}>
          <label className={panelStyles.field}>
            <span className={panelStyles.fieldLabel}>Group name</span>
            <input
              aria-label={`Edit group name for ${group.id}`}
              value={nameDraft}
              onChange={(event) => {
                onNameChange(event.target.value)
              }}
            />
          </label>
          {!nameDraft.trim() ? (
            <p className={editPanelStyles.error}>Enter a group name.</p>
          ) : null}
        </div>
        <SettingRow label="Show title">
          <Switch
            ariaLabel={`Show title on group ${group.id}`}
            checked={showTitleDraft}
            onChange={onShowTitleChange}
          />
        </SettingRow>
      </PanelSection>

      <PanelSection title="Shape">
        <SettingRow hint="Grid cells" label="Size">
          <input
            aria-label={`Edit group width for ${group.id}`}
            className={panelStyles.numberInput}
            inputMode="numeric"
            min={GROUP_SIZE_LIMITS.min}
            type="number"
            value={widthDraft}
            onChange={(event) => {
              onWidthChange(event.target.value)
            }}
          />
          <span aria-hidden="true">×</span>
          <input
            aria-label={`Edit group height for ${group.id}`}
            className={panelStyles.numberInput}
            inputMode="numeric"
            min={GROUP_SIZE_LIMITS.min}
            type="number"
            value={heightDraft}
            onChange={(event) => {
              onHeightChange(event.target.value)
            }}
          />
        </SettingRow>
        {!normalizedGroupSize ? (
          <div className={panelStyles.row}>
            <p className={editPanelStyles.error}>
              Enter a width and height of at least {GROUP_SIZE_LIMITS.min}{' '}
              cells.
            </p>
          </div>
        ) : null}
        <SettingRow label="Corner radius" stacked>
          <Slider
            ariaLabel={`Edit group corner radius for ${group.id}`}
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
            ariaLabel={`Edit transparency for group ${group.id}`}
            max={SURFACE_TRANSPARENCY_LIMITS.max}
            min={SURFACE_TRANSPARENCY_LIMITS.min}
            value={surfaceTransparencyDraft}
            onChange={(value) =>
              onSurfaceTransparencyChange(value as SurfaceTransparency)
            }
          />
        </SettingRow>
        <SettingRow label="Shadow">
          <SelectMenu
            ariaLabel={`Edit shadow for group ${group.id}`}
            className={editPanelStyles.select}
            options={SURFACE_SHADOW_STYLE_OPTIONS.map((value) => ({
              value,
              label: SURFACE_SHADOW_STYLE_LABELS[value],
            }))}
            value={shadowStyleDraft}
            onChange={(nextValue) => {
              onShadowStyleChange(nextValue as SurfaceShadowStyle)
            }}
          />
        </SettingRow>
        <div className={`${panelStyles.row} ${panelStyles.rowStacked}`}>
          <ColorPresetPicker
            allowCustomColor
            colors={activeColorSettings.fillPresets}
            hint="Pick a saved preset or a free color."
            kind="fill"
            label="Fill color"
            onCustomColorChange={onCustomFillColorChange}
            onResetPresets={onResetFillPresets}
            onSavePresets={onSaveFillPresets}
            onSelectPreset={onSelectFillPreset}
            selectedColor={selectedFillColor}
            selectedIndex={fillPresetIndexDraft ?? undefined}
          />
        </div>
        <div className={`${panelStyles.row} ${panelStyles.rowStacked}`}>
          <ColorPresetPicker
            allowCustomColor
            colors={activeColorSettings.borderPresets}
            hint="Pick a saved preset or a free color."
            kind="border"
            label="Border color"
            onCustomColorChange={onCustomBorderColorChange}
            onResetPresets={onResetBorderPresets}
            onSavePresets={onSaveBorderPresets}
            onSelectPreset={onSelectBorderPreset}
            selectedColor={selectedBorderColor}
            selectedIndex={borderPresetIndexDraft ?? undefined}
          />
        </div>
      </PanelSection>
    </EditPanel>,
    document.body,
  )
}
