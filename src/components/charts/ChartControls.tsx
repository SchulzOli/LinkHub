import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import styles from './ChartControls.module.css'

import {
  CHART_RANGE_LABELS,
  CHART_RANGES,
  type ChartRange,
  type ChartSettingKey,
  type ChartSettings,
} from '../../contracts/chartNode'

import {
  CHART_SETTING_LABELS,
  SETTING_ROWS,
  stopCanvasPointer,
  type Option,
} from './chartControlOptions'

function Segmented<T extends string>(props: {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  compact?: boolean
  testId?: string
}) {
  return (
    <div
      aria-label={props.label}
      className={`${styles.segmented} ${props.compact ? styles.segmentedCompact : ''}`}
      data-testid={props.testId}
      role="radiogroup"
    >
      {props.options.map((option) => (
        <button
          aria-checked={option.value === props.value}
          className={
            option.value === props.value ? styles.segmentActive : styles.segment
          }
          key={option.value}
          onClick={() => props.onChange(option.value)}
          onPointerDown={stopCanvasPointer}
          role="radio"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function ChartRangeBar(props: {
  value: ChartRange
  onChange: (range: ChartRange) => void
  testId?: string
}) {
  return (
    <Segmented
      compact
      label="Time range"
      onChange={props.onChange}
      options={CHART_RANGES.map((range) => ({
        value: range,
        label: CHART_RANGE_LABELS[range],
      }))}
      testId={props.testId}
      value={props.value}
    />
  )
}

/**
 * All chart interactions as rows. `renderStatus` adds per-key context, e.g.
 * "set on this chart" on a chart or "2 charts differ" on a group.
 */
export function ChartSettingsFields(props: {
  values: ChartSettings
  onChange: <K extends ChartSettingKey>(key: K, value: ChartSettings[K]) => void
  renderStatus?: (key: ChartSettingKey) => ReactNode
}) {
  const { values, onChange, renderStatus } = props

  return (
    <div className={styles.fields}>
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowLabel}>{CHART_SETTING_LABELS.range}</span>
          {renderStatus?.('range')}
        </div>
        <ChartRangeBar
          onChange={(range) => onChange('range', range)}
          value={values.range}
        />
      </div>
      {(Object.keys(SETTING_ROWS) as Array<keyof typeof SETTING_ROWS>).map(
        (key) => (
          <div className={styles.row} key={key}>
            <div className={styles.rowHeader}>
              <span className={styles.rowLabel}>{SETTING_ROWS[key].label}</span>
              {renderStatus?.(key)}
            </div>
            <Segmented
              label={SETTING_ROWS[key].label}
              onChange={(value) =>
                onChange(key, value as ChartSettings[typeof key])
              }
              options={SETTING_ROWS[key].options as Option<string>[]}
              value={values[key]}
            />
          </div>
        ),
      )}
      <div className={styles.row}>
        <div className={styles.rowHeader}>
          <span className={styles.rowLabel}>{CHART_SETTING_LABELS.live}</span>
          {renderStatus?.('live')}
        </div>
        <Segmented
          label={CHART_SETTING_LABELS.live}
          onChange={(value) => onChange('live', value === 'on')}
          options={[
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Paused' },
          ]}
          value={values.live ? 'on' : 'off'}
        />
      </div>
    </div>
  )
}

export function ChartPopoverSection(props: {
  title: string
  children: ReactNode
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{props.title}</h3>
      {props.children}
    </section>
  )
}

export function ChartActionButton(props: {
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'accent'
}) {
  return (
    <button
      className={`${styles.actionButton} ${props.tone === 'accent' ? styles.actionButtonAccent : ''}`}
      disabled={props.disabled}
      onClick={props.onClick}
      onPointerDown={stopCanvasPointer}
      type="button"
    >
      {props.label}
    </button>
  )
}

const POPOVER_GAP = 6
const VIEWPORT_PADDING = 8

/**
 * Popover rendered into <body> so it is not scaled with the canvas and is
 * never clipped by the node. Closes on outside pointer-down and Escape.
 */
export function ChartPopover(props: {
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  children: ReactNode
  label: string
  testId?: string
}) {
  const { anchorRef, open, onClose, children, label, testId } = props
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>({
    left: -9999,
    top: -9999,
  })

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect()
      const panel = panelRef.current?.getBoundingClientRect()

      if (!anchor || !panel) {
        return
      }

      const fitsBelow =
        anchor.bottom + POPOVER_GAP + panel.height <=
        window.innerHeight - VIEWPORT_PADDING
      const fitsAbove =
        anchor.top - POPOVER_GAP - panel.height >= VIEWPORT_PADDING

      if (!fitsBelow && !fitsAbove) {
        // Too tall for either side: open beside the anchor so the chart it
        // controls stays visible.
        const fitsRight =
          anchor.right + POPOVER_GAP + panel.width <=
          window.innerWidth - VIEWPORT_PADDING
        const left = fitsRight
          ? anchor.right + POPOVER_GAP
          : Math.max(VIEWPORT_PADDING, anchor.left - POPOVER_GAP - panel.width)
        const top = Math.min(
          Math.max(VIEWPORT_PADDING, anchor.top),
          Math.max(
            VIEWPORT_PADDING,
            window.innerHeight - panel.height - VIEWPORT_PADDING,
          ),
        )

        setPosition({ left, top })
        return
      }

      const top = fitsBelow
        ? anchor.bottom + POPOVER_GAP
        : anchor.top - POPOVER_GAP - panel.height
      const left = Math.min(
        Math.max(VIEWPORT_PADDING, anchor.right - panel.width),
        window.innerWidth - panel.width - VIEWPORT_PADDING,
      )

      setPosition({ left, top })
    }

    update()
    window.addEventListener('resize', update)

    return () => window.removeEventListener('resize', update)
  }, [anchorRef, open])

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (
        panelRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return
      }

      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [anchorRef, onClose, open])

  if (!open) {
    return null
  }

  return createPortal(
    <div
      aria-label={label}
      className={styles.popover}
      data-testid={testId}
      onPointerDown={stopCanvasPointer}
      onWheel={(event) => event.stopPropagation()}
      ref={panelRef}
      role="dialog"
      style={{ left: position.left, top: position.top }}
    >
      {children}
    </div>,
    document.body,
  )
}
