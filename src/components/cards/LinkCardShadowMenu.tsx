import editPanelStyles from '../ui/panel/EditPanel.module.css'
import { SettingRow } from '../ui/panel/Panel'

import type { SurfaceShadowStyle } from '../../contracts/surfaceEffects'
import {
  SURFACE_SHADOW_STYLE_LABELS,
  SURFACE_SHADOW_STYLE_OPTIONS,
} from '../../features/appearance/surfaceEffects'
import { SelectMenu } from '../ui/SelectMenu'

type LinkCardShadowMenuProps = {
  cardId: string
  shadowStyle: SurfaceShadowStyle
  onChange: (value: SurfaceShadowStyle) => void
}

export function LinkCardShadowMenu({
  cardId,
  shadowStyle,
  onChange,
}: LinkCardShadowMenuProps) {
  return (
    <SettingRow label="Shadow">
      <SelectMenu
        ariaLabel={`Edit shadow for ${cardId}`}
        className={editPanelStyles.select}
        options={SURFACE_SHADOW_STYLE_OPTIONS.map((value) => ({
          value,
          label: SURFACE_SHADOW_STYLE_LABELS[value],
        }))}
        value={shadowStyle}
        onChange={(nextValue) => {
          onChange(nextValue as SurfaceShadowStyle)
        }}
      />
    </SettingRow>
  )
}
