import { useMemo, useState, type CSSProperties } from 'react'

import { areCardColorsEqual } from '../../contracts/cardColors'

import styles from './ColorPresetPicker.module.css'

import { EditIcon } from './EditIcon'

type ColorPresetPickerProps = {
  kind: 'fill' | 'border'
  label: string
  hint: string
  colors: string[]
  selectedIndex?: number
  selectedColor?: string | null
  showDefaultBadge?: boolean
  allowCustomColor?: boolean
  onSelectPreset: (index: number) => void
  onSavePresets: (colors: string[]) => void
  onResetPresets: () => void
  onCustomColorChange?: (color: string) => void
}

export function ColorPresetPicker({
  kind,
  label,
  hint,
  colors,
  selectedIndex,
  selectedColor,
  showDefaultBadge = false,
  allowCustomColor = false,
  onSelectPreset,
  onSavePresets,
  onResetPresets,
  onCustomColorChange,
}: ColorPresetPickerProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [draftColors, setDraftColors] = useState(() => [...colors])

  const matchedIndex = useMemo(() => {
    if (typeof selectedIndex === 'number') {
      return selectedIndex
    }

    if (!selectedColor) {
      return -1
    }

    return colors.findIndex((color) => areCardColorsEqual(color, selectedColor))
  }, [colors, selectedColor, selectedIndex])

  const customEditorSelected =
    allowCustomColor && !!selectedColor && matchedIndex === -1
  const editorPreviewColor =
    customEditorSelected && selectedColor ? selectedColor : undefined

  const createSwatchStyle = (color: string): CSSProperties =>
    ({ '--swatch-color': color }) as CSSProperties

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.hint}>{hint}</span>
      </div>
      <div className={styles.row}>
        {colors.map((color, index) => {
          const selected = matchedIndex === index

          return (
            <button
              aria-label={`${label} preset ${index + 1}`}
              className={`${styles.swatch} ${selected ? styles.selected : ''}`}
              key={`${label}-${color}-${index}`}
              onClick={() => onSelectPreset(index)}
              style={createSwatchStyle(color)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={`${styles.swatchInner} ${kind === 'fill' ? styles.fillSwatch : styles.borderSwatch}`}
              />
              {showDefaultBadge && selected ? (
                <span aria-hidden="true" className={styles.defaultBadge} />
              ) : null}
            </button>
          )
        })}
        <button
          aria-expanded={editorOpen}
          aria-label={`${label} editor`}
          className={`${styles.editorButton} ${editorOpen || customEditorSelected ? styles.selected : ''}`}
          onClick={() => {
            if (!editorOpen) {
              setDraftColors([...colors])
            }

            setEditorOpen((current) => !current)
          }}
          style={
            editorPreviewColor
              ? createSwatchStyle(editorPreviewColor)
              : undefined
          }
          type="button"
        >
          <span
            aria-hidden="true"
            className={`${styles.editorInner} ${kind === 'fill' ? styles.fillEditor : styles.borderEditor}`}
          >
            <EditIcon className={styles.editorGlyph} />
          </span>
        </button>
      </div>
      {editorOpen ? (
        <div className={styles.editorPanel}>
          <p className={styles.editorTitle}>{label} presets</p>
          {allowCustomColor && onCustomColorChange ? (
            <label className={styles.customInputLabel}>
              <span>Custom color for this card</span>
              <input
                aria-label={`${label} custom color`}
                className={styles.colorInput}
                type="color"
                value={selectedColor ?? colors[0] ?? '#000000'}
                onChange={(event) =>
                  onCustomColorChange(event.currentTarget.value)
                }
              />
            </label>
          ) : null}
          <div className={styles.presetInputs}>
            {draftColors.map((color, index) => (
              <label
                className={styles.presetInputLabel}
                key={`${label}-input-${index}`}
              >
                <span>{index + 1}</span>
                <input
                  aria-label={`${label} preset input ${index + 1}`}
                  className={styles.colorInput}
                  type="color"
                  value={color}
                  onChange={(event) => {
                    const nextColors = [...draftColors]
                    nextColors[index] = event.currentTarget.value
                    setDraftColors(nextColors)
                  }}
                />
              </label>
            ))}
          </div>
          <div className={styles.editorActions}>
            <button
              onClick={() => {
                onResetPresets()
                setDraftColors([...colors])
                setEditorOpen(false)
              }}
              type="button"
            >
              Reset
            </button>
            <button
              onClick={() => {
                onSavePresets(draftColors)
                setEditorOpen(false)
              }}
              type="button"
            >
              Save presets
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
