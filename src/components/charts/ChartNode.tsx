import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import controlStyles from './ChartControls.module.css'
import styles from './ChartNode.module.css'

import {
  getChartTransport,
  type ChartNode as ChartNodeContract,
  type ChartSettingKey,
  type ChartSettings,
} from '../../contracts/chartNode'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type { Viewport } from '../../contracts/workspace'
import {
  getCardPixelDimensions,
  getOverlayActionMetrics,
} from '../../features/appearance/themeTokens'
import type { ChartSymbolSuggestion } from '../../features/charts/chartFeedProtocol'
import { resolveChartSettings } from '../../features/charts/chartInheritance'
import { onChartReload } from '../../features/charts/chartReloadBus'
import {
  formatChartValue,
  getRangeChange,
  pointsToCsv,
} from '../../features/charts/chartSeries'
import { searchChartSymbols } from '../../features/charts/chartSymbolSearch'
import { useChartFeed } from '../../features/charts/useChartFeed'
import {
  useWorkspaceStore,
  type InteractionMode,
} from '../../state/useWorkspaceStore'
import {
  useCanvasEditActions,
  useCanvasSelectionActions,
} from '../canvas/CanvasActionsContext'
import {
  NodeActionBar,
  NodeActionButton,
  NodeResizeHandles,
} from '../nodes/NodeChrome'
import { NODE_CHROME_HOST, NODE_SURFACE } from '../nodes/nodeClasses'
import { useNodePlacement } from '../pictures/useNodePlacement'
import { StrokeIcon } from '../ui/StrokeIcon'

import {
  ChartActionButton,
  ChartPopover,
  ChartPopoverSection,
  ChartRangeBar,
  ChartSettingsFields,
  ChartSymbolSuggestions,
} from './ChartControls'
import { stopCanvasPointer } from './chartControlOptions'

const ChartCanvas = lazy(() => import('./ChartCanvas'))

type ChartNodeProps = {
  chart: ChartNodeContract
  guide: PlacementGuide
  isSelected: boolean
  interactionMode: InteractionMode
  viewport: Viewport
}

const STATUS_LABEL = {
  connecting: 'Connecting',
  open: 'Live',
  closed: 'Disconnected',
  error: 'Connection error',
} as const

function SlidersIcon() {
  return (
    <StrokeIcon>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </StrokeIcon>
  )
}

function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv' }))
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const ChartNode = memo(function ChartNode({
  chart,
  guide,
  isSelected,
  interactionMode,
  viewport,
}: ChartNodeProps) {
  const isEditMode = interactionMode === 'edit'
  const { onSelectPicture: onSelect } = useCanvasSelectionActions()
  const { onRemovePicture: onRemove } = useCanvasEditActions()
  const groups = useWorkspaceStore((state) => state.workspace.groups)
  const setChartSetting = useWorkspaceStore((state) => state.setChartSetting)
  const updateChart = useWorkspaceStore((state) => state.updateChart)
  const { handlePointerDown, createResizePointerDown } = useNodePlacement({
    node: chart,
    guide,
    viewport,
    enabled: isEditMode,
  })
  const [reloadToken, setReloadToken] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const nodeRef = useRef<HTMLElement | null>(null)

  const resolved = useMemo(
    () => resolveChartSettings(chart, groups, guide.gridSize),
    [chart, groups, guide.gridSize],
  )
  const { settings, origins } = resolved
  const innermostGroup = resolved.groupChain[resolved.groupChain.length - 1]
  const ownKeys = (Object.keys(chart.settings) as ChartSettingKey[]).filter(
    (key) => chart.settings[key] !== undefined,
  )

  const feed = useChartFeed({
    url: chart.source.url,
    symbol: chart.source.symbol,
    range: settings.range,
    live: settings.live,
    reloadToken,
  })

  useEffect(
    () => onChartReload(chart.id, () => setReloadToken((token) => token + 1)),
    [chart.id],
  )

  const change = useMemo(() => getRangeChange(feed.points), [feed.points])

  const handleSettingChange = useCallback(
    <K extends ChartSettingKey>(key: K, value: ChartSettings[K]) => {
      setChartSetting(chart.id, key, value)
    },
    [chart.id, setChartSetting],
  )

  const size = getCardPixelDimensions(chart.size, guide.gridSize)
  const actionMetrics = getOverlayActionMetrics(size.width, size.height)
  const nodeStyle: CSSProperties & Record<string, string | number> = {
    width: size.width,
    height: size.height,
    ['--action-button-size' as const]: `${actionMetrics.buttonSize}px`,
    ['--action-icon-size' as const]: `${actionMetrics.iconSize}px`,
    ['--action-bar-gap' as const]: `${actionMetrics.gap}px`,
    ['--action-bar-offset' as const]: `${actionMetrics.offset}px`,
    transform: `translate(${chart.positionX}px, ${chart.positionY}px)`,
  }
  const trend =
    !change || change.absolute === 0
      ? 'flat'
      : change.absolute > 0
        ? 'up'
        : 'down'
  const title = chart.title?.trim() || feed.name || chart.source.symbol

  return (
    <article
      ref={nodeRef}
      className={`${NODE_SURFACE} ${NODE_CHROME_HOST}`}
      data-entity-id={chart.id}
      data-entity-kind="picture"
      data-mode={interactionMode}
      data-selected={isSelected}
      data-testid={`chart-node-${chart.id}`}
      style={nodeStyle}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return
        }

        if (isEditMode) {
          onSelect(chart.id, event.metaKey || event.ctrlKey)
        }

        handlePointerDown(event)
      }}
    >
      <div className={styles.frame}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <span className={styles.symbol} title={chart.source.symbol}>
              {chart.source.symbol}
            </span>
            {title !== chart.source.symbol ? (
              <span className={styles.name} title={title}>
                {title}
              </span>
            ) : null}
          </div>
          <div className={styles.quote}>
            {change ? (
              <>
                <span className={styles.price} data-testid="chart-price">
                  {formatChartValue(change.last, 'price', feed.currency)}
                </span>
                <span
                  className={styles.change}
                  data-testid="chart-change"
                  data-trend={trend}
                  title={`Change over ${settings.range}`}
                >
                  {formatChartValue(change.percent, 'percent')}
                </span>
              </>
            ) : null}
          </div>
          <span
            aria-label={STATUS_LABEL[feed.status]}
            className={styles.statusDot}
            data-live={settings.live}
            data-status={feed.status}
            data-testid="chart-status"
            title={
              settings.live
                ? STATUS_LABEL[feed.status]
                : `${STATUS_LABEL[feed.status]} · live paused`
            }
          />
          <button
            aria-expanded={menuOpen}
            aria-label="Chart options"
            className={styles.menuButton}
            onClick={() => setMenuOpen((open) => !open)}
            onPointerDown={stopCanvasPointer}
            ref={menuButtonRef}
            title="Chart options"
            type="button"
          >
            <SlidersIcon />
          </button>
        </header>

        <div className={styles.plot}>
          {feed.points.length > 1 ? (
            <Suspense fallback={null}>
              <ChartCanvas
                currency={feed.currency}
                points={feed.points}
                settings={settings}
              />
            </Suspense>
          ) : (
            <div className={styles.placeholder} data-testid="chart-placeholder">
              <p className={styles.placeholderText}>
                {feed.error ??
                  (feed.status === 'open' || feed.status === 'connecting'
                    ? 'Loading data…'
                    : `No connection to ${chart.source.url}`)}
              </p>
              <ChartSymbolSuggestions
                onPick={(symbol) =>
                  updateChart(chart.id, { source: { ...chart.source, symbol } })
                }
                suggestions={feed.suggestions?.slice(0, 4) ?? []}
                testId="chart-error-suggestions"
              />
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <ChartRangeBar
            onChange={(range) => handleSettingChange('range', range)}
            testId="chart-range-bar"
            value={settings.range}
          />
        </footer>
      </div>

      <ChartPopover
        anchorRef={nodeRef}
        triggerRef={menuButtonRef}
        label={`Options for ${chart.source.symbol}`}
        onClose={() => setMenuOpen(false)}
        open={menuOpen}
        testId="chart-options"
      >
        <ChartPopoverSection title={`${chart.source.symbol} options`}>
          {innermostGroup ? (
            <p className={controlStyles.hint}>
              Settings without a badge follow the group “{innermostGroup.name}”.
            </p>
          ) : null}
          <ChartSettingsFields
            onChange={handleSettingChange}
            renderStatus={(key) =>
              origins[key].level === 'chart' && innermostGroup ? (
                <button
                  className={controlStyles.status}
                  onClick={() => setChartSetting(chart.id, key, undefined)}
                  onPointerDown={stopCanvasPointer}
                  title="Set on this chart only. Click to follow the group again."
                  type="button"
                >
                  Own value ×
                </button>
              ) : null
            }
            values={settings}
          />
        </ChartPopoverSection>
        <ChartPopoverSection title="Actions">
          <div className={controlStyles.actions}>
            <ChartActionButton
              label="Reload"
              onClick={() => setReloadToken((token) => token + 1)}
            />
            <ChartActionButton
              disabled={feed.points.length === 0}
              label="Export CSV"
              onClick={() =>
                downloadCsv(
                  `${chart.source.symbol}-${settings.range}.csv`,
                  pointsToCsv(feed.points, chart.source.symbol),
                )
              }
            />
            {innermostGroup && ownKeys.length > 0 ? (
              <ChartActionButton
                label="Follow group"
                onClick={() => updateChart(chart.id, { settings: {} })}
                tone="accent"
              />
            ) : null}
          </div>
        </ChartPopoverSection>
        <ChartSourceForm
          chart={chart}
          onSave={(source) => updateChart(chart.id, { source })}
        />
      </ChartPopover>

      {isEditMode ? (
        <>
          <NodeActionBar>
            <NodeActionButton
              kind="delete"
              label="Delete chart"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onRemove(chart.id)
              }}
            />
          </NodeActionBar>
          <NodeResizeHandles
            label={(direction) => `Resize chart ${direction}`}
            onPointerDown={createResizePointerDown}
          />
        </>
      ) : null}
    </article>
  )
})

function ChartSourceForm(props: {
  chart: ChartNodeContract
  onSave: (source: ChartNodeContract['source']) => void
}) {
  const [symbol, setSymbol] = useState(props.chart.source.symbol)
  const [url, setUrl] = useState(props.chart.source.url)
  const trimmedSymbol = symbol.trim().toUpperCase()
  const trimmedUrl = url.trim()
  const transport = getChartTransport(trimmedUrl)
  const changed =
    trimmedSymbol !== props.chart.source.symbol ||
    trimmedUrl !== props.chart.source.url
  const [results, setResults] = useState<ChartSymbolSuggestion[]>([])
  const searchQuery =
    trimmedSymbol && trimmedSymbol !== props.chart.source.symbol
      ? trimmedSymbol
      : ''

  // Look up listings while typing ("7CD" → 7CD.F, 7CD.MU, …).
  useEffect(() => {
    if (!searchQuery || !transport) {
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchChartSymbols(trimmedUrl, searchQuery, controller.signal)
        .then(setResults)
        .catch(() => setResults([]))
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [searchQuery, transport, trimmedUrl])

  const visibleResults = searchQuery
    ? results.filter((result) => result.symbol !== trimmedSymbol).slice(0, 6)
    : []

  return (
    <ChartPopoverSection title="Data source">
      <form
        className={controlStyles.fields}
        onSubmit={(event) => {
          event.preventDefault()

          if (trimmedSymbol && transport && changed) {
            props.onSave({ symbol: trimmedSymbol, url: trimmedUrl })
          }
        }}
      >
        <label className={controlStyles.field}>
          <span className={controlStyles.fieldLabel}>Symbol</span>
          <input
            aria-label="Chart symbol"
            onChange={(event) => setSymbol(event.target.value)}
            value={symbol}
          />
        </label>
        <ChartSymbolSuggestions
          onPick={(picked) => {
            setSymbol(picked)
            setResults([])

            if (transport) {
              props.onSave({ symbol: picked, url: trimmedUrl })
            }
          }}
          suggestions={visibleResults}
          testId="chart-symbol-suggestions"
        />
        <p className={controlStyles.hint}>
          Exchange listings need a suffix, e.g. 7CD.F (Frankfurt), SAP.DE
          (Xetra), ^GDAXI (DAX). Type a name or code to search.
        </p>
        <label className={controlStyles.field}>
          <span className={controlStyles.fieldLabel}>Feed URL</span>
          <input
            aria-label="Chart feed URL"
            onChange={(event) => setUrl(event.target.value)}
            placeholder="ws://… or https://…"
            value={url}
          />
        </label>
        <p className={controlStyles.hint}>
          {transport === 'websocket'
            ? 'WebSocket feed.'
            : transport === 'sse'
              ? 'Server-Sent Events feed.'
              : 'Use ws://, wss://, http:// or https://.'}
        </p>
        <div className={controlStyles.actions}>
          <button
            disabled={!trimmedSymbol || !transport || !changed}
            type="submit"
          >
            Apply source
          </button>
        </div>
      </form>
    </ChartPopoverSection>
  )
}
