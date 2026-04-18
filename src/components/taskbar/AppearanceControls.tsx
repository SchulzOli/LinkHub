import styles from './AppearanceControls.module.css'

import { CARD_SIZE_LIMITS } from '../../contracts/linkCard'
import { useAppearanceStore } from '../../state/useAppearanceStore'
import { SelectMenu } from '../ui/SelectMenu'

export function AppearanceControls() {
  const { appearance, setThemeMode, setDefaultCardSize } = useAppearanceStore()

  return (
    <div className={styles.controls}>
      <label>
        <span className="srOnly">Theme</span>
        <SelectMenu
          ariaLabel="Theme"
          className={styles.select}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
          value={appearance.themeMode}
          onChange={(nextValue) => setThemeMode(nextValue as 'light' | 'dark')}
        />
      </label>
      <label>
        <span className="srOnly">Default width</span>
        <input
          aria-label="Default width"
          className={styles.select}
          max={CARD_SIZE_LIMITS.max}
          min={CARD_SIZE_LIMITS.min}
          type="number"
          value={appearance.defaultCardSize.columns}
          onChange={(event) =>
            event.currentTarget.valueAsNumber >= CARD_SIZE_LIMITS.min &&
            event.currentTarget.valueAsNumber <= CARD_SIZE_LIMITS.max
              ? setDefaultCardSize({
                  ...appearance.defaultCardSize,
                  columns: event.currentTarget.valueAsNumber,
                })
              : undefined
          }
        />
      </label>
      <label>
        <span className="srOnly">Default height</span>
        <input
          aria-label="Default height"
          className={styles.select}
          max={CARD_SIZE_LIMITS.max}
          min={CARD_SIZE_LIMITS.min}
          type="number"
          value={appearance.defaultCardSize.rows}
          onChange={(event) =>
            event.currentTarget.valueAsNumber >= CARD_SIZE_LIMITS.min &&
            event.currentTarget.valueAsNumber <= CARD_SIZE_LIMITS.max
              ? setDefaultCardSize({
                  ...appearance.defaultCardSize,
                  rows: event.currentTarget.valueAsNumber,
                })
              : undefined
          }
        />
      </label>
    </div>
  )
}
