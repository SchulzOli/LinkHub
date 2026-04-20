import styles from './LinkCard.module.css'

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
    <label className={styles.editField}>
      <span className={styles.editLabel}>Shadow</span>
      <SelectMenu
        ariaLabel={`Edit shadow for ${cardId}`}
        className={styles.editSelect}
        options={SURFACE_SHADOW_STYLE_OPTIONS.map((value) => ({
          value,
          label: SURFACE_SHADOW_STYLE_LABELS[value],
        }))}
        value={shadowStyle}
        onChange={(nextValue) => {
          onChange(nextValue as SurfaceShadowStyle)
        }}
      />
    </label>
  )
}
