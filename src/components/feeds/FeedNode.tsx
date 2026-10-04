import { memo, useMemo, useRef, useState, type CSSProperties } from 'react'

import nodeStyles from '../charts/ChartNode.module.css'
import styles from './FeedNode.module.css'

import {
  FEED_SORT_LABELS,
  FEED_SORTS,
  FEED_TIME_WINDOW_LABELS,
  FEED_TIME_WINDOWS,
  type FeedNode as FeedNodeContract,
  type FeedSort,
  type FeedTimeWindow,
} from '../../contracts/feedNode'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type { Viewport } from '../../contracts/workspace'
import {
  getCardPixelDimensions,
  getOverlayActionMetrics,
} from '../../features/appearance/themeTokens'
import {
  filterFeedItems,
  formatAbsoluteTime,
  formatRelativeTime,
  sortFeedItems,
} from '../../features/feeds/feedItems'
import { hostOf, type FeedItem } from '../../features/feeds/feedParser'
import { useFeedItems } from '../../features/feeds/useFeedItems'
import {
  useWorkspaceStore,
  type InteractionMode,
} from '../../state/useWorkspaceStore'
import {
  useCanvasEditActions,
  useCanvasSelectionActions,
} from '../canvas/CanvasActionsContext'
import { ChartPopover } from '../charts/ChartControls'
import { stopCanvasPointer } from '../charts/chartControlOptions'
import {
  NODE_RESIZE_HANDLES,
  useNodePlacement,
} from '../pictures/useNodePlacement'
import { DeleteIcon } from '../ui/DeleteIcon'
import { StrokeIcon } from '../ui/StrokeIcon'

import { FeedAddSourceForm, FeedOptions } from './FeedOptions'

type FeedNodeProps = {
  feed: FeedNodeContract
  guide: PlacementGuide
  isSelected: boolean
  interactionMode: InteractionMode
  viewport: Viewport
}

function SlidersIcon() {
  return (
    <StrokeIcon>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </StrokeIcon>
  )
}

function ReloadIcon() {
  return (
    <StrokeIcon>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </StrokeIcon>
  )
}

function SearchIcon() {
  return (
    <StrokeIcon>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" />
    </StrokeIcon>
  )
}

function FeedGlyph() {
  return (
    <StrokeIcon>
      <path d="M5 11a8 8 0 0 1 8 8" />
      <path d="M5 4.5a14.5 14.5 0 0 1 14.5 14.5" />
      <circle cx="6" cy="18" r="1.25" />
    </StrokeIcon>
  )
}

export const FeedNode = memo(function FeedNode({
  feed,
  guide,
  isSelected,
  interactionMode,
  viewport,
}: FeedNodeProps) {
  const isEditMode = interactionMode === 'edit'
  const { onSelectPicture: onSelect } = useCanvasSelectionActions()
  const { onRemovePicture: onRemove } = useCanvasEditActions()
  const updateFeed = useWorkspaceStore((state) => state.updateFeed)
  const { handlePointerDown, createResizePointerDown } = useNodePlacement({
    node: feed,
    guide,
    viewport,
    enabled: isEditMode,
  })
  const [reloadToken, setReloadToken] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Captured per render pass of the list; refreshed with every data update.
  const [now, setNow] = useState(() => Date.now())
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const nodeRef = useRef<HTMLElement | null>(null)
  const { settings } = feed

  const state = useFeedItems({
    sources: feed.sources,
    proxyUrl: feed.proxyUrl,
    refreshMinutes: settings.refreshMinutes,
    reloadToken,
  })

  // Auto refresh moves the time-window cutoff forward with each fetch.
  const effectiveNow = Math.max(now, state.updatedAt ?? 0)

  const visibleItems = useMemo(
    () =>
      sortFeedItems(
        filterFeedItems(state.items, {
          settings,
          query,
          now: effectiveNow,
        }),
        settings.sort,
      ),
    [effectiveNow, query, settings, state.items],
  )

  const sourceTitles = feed.sources.map((source) => {
    const result = state.results[source.url]

    return (
      source.title ||
      (result?.status === 'ok' ? result.feed.title : hostOf(source.url))
    )
  })
  const errors = feed.sources.flatMap((source, index) => {
    const result = state.results[source.url]

    return result?.status === 'error'
      ? [{ url: source.url, title: sourceTitles[index], result }]
      : []
  })
  const title =
    feed.title?.trim() ||
    (feed.sources.length === 1 ? sourceTitles[0] : undefined) ||
    'News'
  const status =
    feed.sources.length === 0
      ? 'idle'
      : state.loading
        ? 'connecting'
        : errors.length === feed.sources.length
          ? 'error'
          : 'open'

  const size = getCardPixelDimensions(feed.size, guide.gridSize)
  const actionMetrics = getOverlayActionMetrics(size.width, size.height)
  const nodeStyle: CSSProperties & Record<string, string | number> = {
    width: size.width,
    height: size.height,
    ['--action-button-size' as const]: `${actionMetrics.buttonSize}px`,
    ['--action-icon-size' as const]: `${actionMetrics.iconSize}px`,
    ['--action-bar-gap' as const]: `${actionMetrics.gap}px`,
    ['--action-bar-offset' as const]: `${actionMetrics.offset}px`,
    transform: `translate(${feed.positionX}px, ${feed.positionY}px)`,
  }

  const toggleSource = (url: string) => {
    const hidden = settings.hiddenSources.includes(url)
      ? settings.hiddenSources.filter((entry) => entry !== url)
      : [...settings.hiddenSources, url]

    updateFeed(feed.id, { settings: { hiddenSources: hidden } })
  }

  const reload = () => {
    setNow(Date.now())
    setReloadToken((token) => token + 1)
  }

  const addSource = (url: string) => {
    if (!feed.sources.some((source) => source.url === url)) {
      updateFeed(feed.id, { sources: [...feed.sources, { url }] })
    }
  }

  return (
    <article
      ref={nodeRef}
      className={`${nodeStyles.node} ${isEditMode ? nodeStyles.nodeEdit : ''} ${isSelected ? nodeStyles.nodeSelected : ''}`}
      data-entity-id={feed.id}
      data-entity-kind="picture"
      data-mode={interactionMode}
      data-selected={isSelected}
      data-testid={`feed-node-${feed.id}`}
      style={nodeStyle}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return
        }

        if (isEditMode) {
          onSelect(feed.id, event.metaKey || event.ctrlKey)
        }

        handlePointerDown(event)
      }}
    >
      <div className={styles.frame}>
        <header className={styles.header}>
          <span aria-hidden="true" className={styles.glyph}>
            <FeedGlyph />
          </span>
          <div className={styles.heading}>
            <span
              className={styles.title}
              data-testid="feed-title"
              title={title}
            >
              {title}
            </span>
            <span className={styles.meta}>
              {feed.sources.length === 0
                ? 'No feeds yet'
                : `${visibleItems.length} of ${state.items.length} articles${
                    state.updatedAt
                      ? ` · updated ${formatRelativeTime(state.updatedAt, effectiveNow)}`
                      : ''
                  }`}
            </span>
          </div>
          <span
            aria-label={status}
            className={nodeStyles.statusDot}
            data-live="true"
            data-status={status}
            data-testid="feed-status"
            title={
              errors.length
                ? `${errors.length} of ${feed.sources.length} feeds failed`
                : status === 'connecting'
                  ? 'Loading'
                  : 'Up to date'
            }
          />
          <button
            aria-label="Reload feeds"
            className={nodeStyles.menuButton}
            disabled={feed.sources.length === 0}
            onClick={reload}
            onPointerDown={stopCanvasPointer}
            title="Reload feeds"
            type="button"
          >
            <ReloadIcon />
          </button>
          <button
            aria-expanded={menuOpen}
            aria-label="Feed options"
            className={nodeStyles.menuButton}
            onClick={() => setMenuOpen((open) => !open)}
            onPointerDown={stopCanvasPointer}
            ref={menuButtonRef}
            title="Feed options"
            type="button"
          >
            <SlidersIcon />
          </button>
        </header>

        {feed.sources.length > 0 ? (
          <div className={styles.toolbar} onPointerDown={stopCanvasPointer}>
            <label className={styles.search}>
              <SearchIcon />
              <input
                aria-label="Filter articles"
                onChange={(event) => {
                  setQuery(event.target.value)
                  setNow(Date.now())
                }}
                placeholder="Filter articles"
                type="search"
                value={query}
              />
            </label>
            <select
              aria-label="Sort articles"
              className={styles.select}
              onChange={(event) =>
                updateFeed(feed.id, {
                  settings: { sort: event.target.value as FeedSort },
                })
              }
              value={settings.sort}
            >
              {FEED_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {FEED_SORT_LABELS[sort]}
                </option>
              ))}
            </select>
            <select
              aria-label="Time window"
              className={styles.select}
              onChange={(event) => {
                setNow(Date.now())
                updateFeed(feed.id, {
                  settings: {
                    timeWindow: event.target.value as FeedTimeWindow,
                  },
                })
              }}
              value={settings.timeWindow}
            >
              {FEED_TIME_WINDOWS.map((window) => (
                <option key={window} value={window}>
                  {FEED_TIME_WINDOW_LABELS[window]}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {feed.sources.length > 1 ? (
          <div
            aria-label="Sources"
            className={styles.sources}
            onPointerDown={stopCanvasPointer}
            role="group"
          >
            {feed.sources.map((source, index) => {
              const shown = !settings.hiddenSources.includes(source.url)
              const failed = state.results[source.url]?.status === 'error'

              return (
                <button
                  aria-pressed={shown}
                  className={styles.sourceChip}
                  data-failed={failed}
                  key={source.url}
                  onClick={() => toggleSource(source.url)}
                  title={`${shown ? 'Hide' : 'Show'} ${sourceTitles[index]}`}
                  type="button"
                >
                  {sourceTitles[index]}
                </button>
              )
            })}
          </div>
        ) : null}

        <div
          className={styles.list}
          data-canvas-scroll="y"
          data-testid="feed-list"
          onPointerDown={stopCanvasPointer}
        >
          {feed.sources.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>
                Add an RSS or Atom feed, e.g. a news site's feed URL.
              </p>
              <FeedAddSourceForm onAdd={addSource} />
            </div>
          ) : (
            <>
              {errors.map((error) => (
                <div
                  className={styles.error}
                  data-testid="feed-error"
                  key={error.url}
                >
                  <strong>{error.title}:</strong> {error.result.message}
                </div>
              ))}
              {visibleItems.length === 0 && !state.loading ? (
                <p className={styles.emptyText} data-testid="feed-empty">
                  {state.items.length === 0
                    ? errors.length
                      ? 'No articles loaded.'
                      : 'These feeds have no articles.'
                    : 'No articles match the filters.'}
                </p>
              ) : null}
              {visibleItems.length === 0 && state.loading ? (
                <p className={styles.emptyText}>Loading articles…</p>
              ) : null}
              <ul className={styles.items}>
                {visibleItems.map((item) => (
                  <FeedItemRow
                    item={item}
                    key={`${item.sourceUrl}|${item.id}`}
                    now={effectiveNow}
                    showImage={settings.showImages}
                    showSource={feed.sources.length > 1}
                    showSummary={settings.showSummaries}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <ChartPopover
        anchorRef={nodeRef}
        label={`Options for ${title}`}
        onClose={() => setMenuOpen(false)}
        open={menuOpen}
        testId="feed-options"
        triggerRef={menuButtonRef}
      >
        <FeedOptions
          feed={feed}
          onReload={reload}
          results={state.results}
          sourceTitles={sourceTitles}
        />
      </ChartPopover>

      {isEditMode ? (
        <div className={nodeStyles.actionBar}>
          <button
            aria-label="Delete feed"
            className={`${nodeStyles.actionButton} ${nodeStyles.actionButtonDanger}`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onRemove(feed.id)
            }}
            title="Delete feed"
            type="button"
          >
            <DeleteIcon className={nodeStyles.actionSvg} />
          </button>
        </div>
      ) : null}
      {isEditMode
        ? NODE_RESIZE_HANDLES.map((direction) => (
            <button
              aria-label={`Resize feed ${direction}`}
              className={`${nodeStyles.resizeHandle} ${nodeStyles[`resizeHandle${direction.toUpperCase()}`]}`}
              key={direction}
              onPointerDown={createResizePointerDown(direction)}
              type="button"
            />
          ))
        : null}
    </article>
  )
})

const FeedItemRow = memo(function FeedItemRow(props: {
  item: FeedItem
  now: number
  showImage: boolean
  showSummary: boolean
  showSource: boolean
}) {
  const { item, now, showImage, showSummary, showSource } = props
  const [imageFailed, setImageFailed] = useState(false)
  const meta = [showSource ? item.sourceTitle : null, item.author].filter(
    Boolean,
  )
  const content = (
    <>
      <div className={styles.itemText}>
        <span className={styles.itemTitle}>{item.title}</span>
        {showSummary && item.summary ? (
          <span className={styles.itemSummary}>{item.summary}</span>
        ) : null}
        <span className={styles.itemMeta}>
          {item.published !== null ? (
            <time
              dateTime={new Date(item.published).toISOString()}
              title={formatAbsoluteTime(item.published)}
            >
              {formatRelativeTime(item.published, now)}
            </time>
          ) : null}
          {meta.map((entry) => (
            <span key={entry}>{entry}</span>
          ))}
        </span>
      </div>
      {showImage && item.imageUrl && !imageFailed ? (
        <img
          alt=""
          className={styles.itemImage}
          decoding="async"
          draggable={false}
          loading="lazy"
          onError={() => setImageFailed(true)}
          referrerPolicy="no-referrer"
          src={item.imageUrl}
        />
      ) : null}
    </>
  )

  return (
    <li>
      {item.link ? (
        <a
          className={styles.item}
          data-testid="feed-item"
          draggable={false}
          href={item.link}
          rel="noopener noreferrer"
          target="_blank"
          title={item.title}
        >
          {content}
        </a>
      ) : (
        <div className={styles.item} data-testid="feed-item">
          {content}
        </div>
      )}
    </li>
  )
})
