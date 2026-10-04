import { useState } from 'react'

import controlStyles from '../charts/ChartControls.module.css'
import styles from './FeedNode.module.css'

import {
  FEED_REFRESH_MINUTES,
  FEED_SORT_LABELS,
  FEED_SORTS,
  FEED_TIME_WINDOW_LABELS,
  FEED_TIME_WINDOWS,
  isHttpUrl,
  MAX_FEED_SOURCES,
  type FeedNode,
  type FeedSettings,
} from '../../contracts/feedNode'
import type { FeedSourceResult } from '../../features/feeds/feedClient'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'
import {
  ChartActionButton,
  ChartPopoverSection,
  Segmented,
} from '../charts/ChartControls'
import { stopCanvasPointer } from '../charts/chartControlOptions'

const ON_OFF = [
  { value: 'on', label: 'Show' },
  { value: 'off', label: 'Hide' },
]

function refreshLabel(minutes: number) {
  return minutes === 0 ? 'Off' : minutes < 60 ? `${minutes} min` : '1 h'
}

/** URL input that adds one feed; used in the empty node and the options. */
export function FeedAddSourceForm(props: {
  onAdd: (url: string) => void
  disabled?: boolean
}) {
  const [url, setUrl] = useState('')
  const trimmed = url.trim()
  const withScheme =
    trimmed && !/^[a-z][a-z0-9+.-]*:/i.test(trimmed)
      ? `https://${trimmed}`
      : trimmed
  const valid = isHttpUrl(withScheme)

  return (
    <form
      className={styles.addForm}
      onPointerDown={stopCanvasPointer}
      onSubmit={(event) => {
        event.preventDefault()

        if (valid && !props.disabled) {
          props.onAdd(new URL(withScheme).href)
          setUrl('')
        }
      }}
    >
      <input
        aria-label="Feed URL"
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://example.com/feed.xml"
        inputMode="url"
        spellCheck={false}
        type="text"
        value={url}
      />
      <button disabled={!valid || props.disabled} type="submit">
        Add feed
      </button>
    </form>
  )
}

export function FeedOptions(props: {
  feed: FeedNode
  results: Record<string, FeedSourceResult>
  sourceTitles: string[]
  onReload: () => void
}) {
  const { feed, results, sourceTitles, onReload } = props
  const updateFeed = useWorkspaceStore((state) => state.updateFeed)
  const [title, setTitle] = useState(feed.title ?? '')
  const [proxyUrl, setProxyUrl] = useState(feed.proxyUrl)
  const proxyValid = proxyUrl.trim() === '' || isHttpUrl(proxyUrl)
  const set = <K extends keyof FeedSettings>(key: K, value: FeedSettings[K]) =>
    updateFeed(feed.id, { settings: { [key]: value } })

  return (
    <>
      <ChartPopoverSection title="Feeds">
        {feed.sources.length > 0 ? (
          <ul className={styles.sourceList} data-testid="feed-source-list">
            {feed.sources.map((source, index) => {
              const result = results[source.url]

              return (
                <li className={styles.sourceRow} key={source.url}>
                  <span
                    className={styles.sourceState}
                    data-status={result?.status ?? 'loading'}
                    title={
                      result?.status === 'error'
                        ? result.message
                        : result?.status === 'ok'
                          ? `${result.feed.items.length} articles`
                          : 'Loading'
                    }
                  />
                  <span className={styles.sourceText}>
                    <span className={styles.sourceName}>
                      {sourceTitles[index]}
                    </span>
                    <span className={styles.sourceUrl} title={source.url}>
                      {source.url}
                    </span>
                  </span>
                  <button
                    aria-label={`Remove ${sourceTitles[index]}`}
                    className={styles.sourceRemove}
                    onClick={() =>
                      updateFeed(feed.id, {
                        sources: feed.sources.filter(
                          (entry) => entry.url !== source.url,
                        ),
                        settings: {
                          hiddenSources: feed.settings.hiddenSources.filter(
                            (url) => url !== source.url,
                          ),
                        },
                      })
                    }
                    onPointerDown={stopCanvasPointer}
                    title="Remove feed"
                    type="button"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
        <FeedAddSourceForm
          disabled={feed.sources.length >= MAX_FEED_SOURCES}
          onAdd={(url) => {
            if (!feed.sources.some((source) => source.url === url)) {
              updateFeed(feed.id, { sources: [...feed.sources, { url }] })
            }
          }}
        />
        <p className={controlStyles.hint}>
          RSS or Atom URL. A web page URL works too if it links to its feed. Up
          to {MAX_FEED_SOURCES} feeds are merged into one list.
        </p>
      </ChartPopoverSection>

      <ChartPopoverSection title="Display">
        <div className={controlStyles.fields}>
          <div className={controlStyles.row}>
            <span className={controlStyles.rowLabel}>Sort</span>
            <Segmented
              label="Sort"
              onChange={(value) => set('sort', value)}
              options={FEED_SORTS.map((value) => ({
                value,
                label: FEED_SORT_LABELS[value],
              }))}
              value={feed.settings.sort}
            />
          </div>
          <div className={controlStyles.row}>
            <span className={controlStyles.rowLabel}>Published</span>
            <Segmented
              label="Published"
              onChange={(value) => set('timeWindow', value)}
              options={FEED_TIME_WINDOWS.map((value) => ({
                value,
                label: FEED_TIME_WINDOW_LABELS[value],
              }))}
              value={feed.settings.timeWindow}
            />
          </div>
          <div className={controlStyles.row}>
            <span className={controlStyles.rowLabel}>Summaries</span>
            <Segmented
              label="Summaries"
              onChange={(value) => set('showSummaries', value === 'on')}
              options={ON_OFF}
              value={feed.settings.showSummaries ? 'on' : 'off'}
            />
          </div>
          <div className={controlStyles.row}>
            <span className={controlStyles.rowLabel}>Images</span>
            <Segmented
              label="Images"
              onChange={(value) => set('showImages', value === 'on')}
              options={ON_OFF}
              value={feed.settings.showImages ? 'on' : 'off'}
            />
          </div>
          <div className={controlStyles.row}>
            <span className={controlStyles.rowLabel}>Auto refresh</span>
            <Segmented
              label="Auto refresh"
              onChange={(value) => set('refreshMinutes', Number(value))}
              options={FEED_REFRESH_MINUTES.map((minutes) => ({
                value: String(minutes),
                label: refreshLabel(minutes),
              }))}
              value={String(feed.settings.refreshMinutes)}
            />
          </div>
        </div>
      </ChartPopoverSection>

      <ChartPopoverSection title="Node">
        <form
          className={controlStyles.fields}
          onSubmit={(event) => {
            event.preventDefault()

            const trimmedTitle = title.trim().slice(0, 80)
            const trimmedProxy = proxyUrl.trim()

            if (proxyValid) {
              updateFeed(feed.id, {
                title: trimmedTitle || undefined,
                proxyUrl: trimmedProxy,
              })
            }
          }}
        >
          <label className={controlStyles.field}>
            <span className={controlStyles.fieldLabel}>Title</span>
            <input
              aria-label="Feed title"
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={sourceTitles.length === 1 ? sourceTitles[0] : 'News'}
              value={title}
            />
          </label>
          <label className={controlStyles.field}>
            <span className={controlStyles.fieldLabel}>Feed proxy</span>
            <input
              aria-label="Feed proxy URL"
              onChange={(event) => setProxyUrl(event.target.value)}
              placeholder="Empty = fetch directly"
              value={proxyUrl}
            />
          </label>
          <p className={controlStyles.hint}>
            Most news sites block direct browser requests (CORS). The proxy from
            npm run feed:news fetches feeds for LinkHub. Leave it empty only for
            feeds that allow cross-origin requests.
          </p>
          <div className={controlStyles.actions}>
            <button
              disabled={
                !proxyValid ||
                (title.trim() === (feed.title ?? '') &&
                  proxyUrl.trim() === feed.proxyUrl)
              }
              type="submit"
            >
              Apply
            </button>
            <ChartActionButton label="Reload now" onClick={onReload} />
          </div>
        </form>
      </ChartPopoverSection>
    </>
  )
}
