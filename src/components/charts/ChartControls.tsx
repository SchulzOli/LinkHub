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
import type { ChartSymbolSuggestion } from '../../features/charts/chartFeedProtocol'
import { getAnchoredOverlayPosition } from '../../features/placement/overlayPlacement'

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

/** Pickable listings, e.g. "7CD.F · CD Projekt · Frankfurt". */
export function ChartSymbolSuggestions(props: {
  suggestions: ChartSymbolSuggestion[]
  onPick: (symbol: string) => void
  testId?: string
}) {
  if (props.suggestions.length === 0) {
    return null
  }

  return (
    <ul className={styles.suggestions} data-testid={props.testId}>
      {props.suggestions.map((suggestion) => (
        <li key={suggestion.symbol}>
          <button
            className={styles.suggestion}
            onClick={() => props.onPick(suggestion.symbol)}
            onPointerDown={stopCanvasPointer}
            title={`Use ${suggestion.symbol}`}
            type="button"
          >
            <span className={styles.suggestionSymbol}>{suggestion.symbol}</span>
            <span className={styles.suggestionMeta}>
              {[suggestion.name, suggestion.exchange]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </button>
        </li>
      ))}
    </ul>
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

const POPOVER_GAP = 12
const VIEWPORT_PADDING = 8

/**
 * Popover rendered into <body> so it is not scaled with the canvas and is
 * never clipped by the node. Placed like the card/group edit panels (below,
 * above, else beside the anchor element). Closes on outside pointer-down
 * and Escape.
 */
export function ChartPopover(props: {
  /** Element the popover belongs to (the chart node or group). */
  anchorRef: RefObject<HTMLElement | null>
  /** Toggle button; clicks on it are not treated as "outside". */
  triggerRef?: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  children: ReactNode
  label: string
  testId?: string
}) {
  const { anchorRef, triggerRef, open, onClose, children, label, testId } =
    props
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{
    left: number
    top: number
    maxHeight?: number
  }>({ left: -9999, top: -9999 })

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect()
      const panel = panelRef.current

      if (!anchor || !panel) {
        return
      }

      const taskbarRect = document
        .querySelector<HTMLElement>('[data-testid="bottom-taskbar"]')
        ?.getBoundingClientRect()
      const bottomBoundary = Math.min(
        window.innerHeight - VIEWPORT_PADDING,
        (taskbarRect?.top ?? window.innerHeight) - VIEWPORT_PADDING,
      )
      const { left, top, maxHeight } = getAnchoredOverlayPosition({
        anchorGap: POPOVER_GAP,
        anchorRect: {
          left: anchor.left,
          top: anchor.top,
          bottom: anchor.bottom,
          width: anchor.width,
        },
        bottomBoundary,
        // Natural size, not the previously constrained one.
        overlayRect: { width: panel.offsetWidth, height: panel.scrollHeight },
        topBoundary: VIEWPORT_PADDING,
        viewportPadding: VIEWPORT_PADDING,
        viewportWidth: window.innerWidth,
      })

      setPosition({ left, top, maxHeight })
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
        (triggerRef ?? anchorRef).current?.contains(target)
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
  }, [anchorRef, onClose, open, triggerRef])

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
      style={{
        left: position.left,
        top: position.top,
        maxHeight: position.maxHeight,
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
