import styles from './LinkCard.module.css'

import { getActiveThemeCardColorSettings } from '../../features/appearance/cardColorPalette'
import { ColorPresetPicker } from '../ui/ColorPresetPicker'

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
    <div className={styles.editColorSection}>
      <ColorPresetPicker
        allowCustomColor
        colors={activeColorSettings.fillPresets}
        hint="Use one of your five saved fill presets or pick a free color for this card."
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
        hint="Use one of your five saved border presets or pick a free color for this card."
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
  )
}
