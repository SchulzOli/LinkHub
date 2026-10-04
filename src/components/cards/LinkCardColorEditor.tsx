import { getActiveThemeCardColorSettings } from '../../features/appearance/cardColorPalette'
import { ColorPresetPicker } from '../ui/ColorPresetPicker'
import panelStyles from '../ui/panel/Panel.module.css'

type LinkCardColorEditorProps = {
  activeColorSettings: ReturnType<typeof getActiveThemeCardColorSettings>
  borderPresetIndexDraft: number | null
  fillPresetIndexDraft: number | null
  selectedBorderColor: string | null
  selectedFillColor: string | null
  onCustomBorderColorChange: (color: string) => void
  onCustomFillColorChange: (color: string) => void
  onResetBorderPresets: () => void
  onResetFillPresets: () => void
  onSaveBorderPresets: (colors: string[]) => void
  onSaveFillPresets: (colors: string[]) => void
  onSelectBorderPreset: (index: number) => void
  onSelectFillPreset: (index: number) => void
}

export function LinkCardColorEditor({
  activeColorSettings,
  borderPresetIndexDraft,
  fillPresetIndexDraft,
  selectedBorderColor,
  selectedFillColor,
  onCustomBorderColorChange,
  onCustomFillColorChange,
  onResetBorderPresets,
  onResetFillPresets,
  onSaveBorderPresets,
  onSaveFillPresets,
  onSelectBorderPreset,
  onSelectFillPreset,
}: LinkCardColorEditorProps) {
  return (
    <>
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
    </>
  )
}
