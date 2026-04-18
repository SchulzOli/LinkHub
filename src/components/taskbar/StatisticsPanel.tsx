import { useState } from 'react'

import styles from './OptionsMenu.module.css'

import {
  STATISTICS_PERIOD_SHORT_LABELS,
  STATISTICS_PERIODS,
  STATISTICS_TIMELINE_RANGE_LABELS,
  STATISTICS_TIMELINE_RANGES,
  type StatisticsTimelinePoint,
  type StatisticsTimelineRange,
  type WorkspaceStatisticsSnapshot,
} from '../../features/analytics/workspaceAnalytics'
import type { WorkspaceStorageSnapshot } from '../../features/analytics/workspaceStorage'

const NUMBER_FORMATTER = new Intl.NumberFormat()
const PERCENT_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
  style: 'percent',
})

type StatisticsPanelProps = {
  cardCount: number
  statistics: WorkspaceStatisticsSnapshot
  storageMessage: string
  storageSnapshot: WorkspaceStorageSnapshot | null
  storageStatus: 'error' | 'idle' | 'loading' | 'ready'
}

type TimelineMetric = 'canvasOpens' | 'linkOpens'

function formatCount(value: number) {
  return NUMBER_FORMATTER.format(value)
}

function formatByteSize(byteSize: number) {
  if (byteSize < 1024) {
    return `${formatCount(byteSize)} B`
  }

  const units = ['KiB', 'MiB', 'GiB'] as const
  let value = byteSize / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const maximumFractionDigits = value >= 100 ? 0 : value >= 10 ? 1 : 2

  return `${value.toFixed(maximumFractionDigits)} ${units[unitIndex]}`
}

function formatCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`
}

function formatStorageBucketCaption(
  bucket: WorkspaceStorageSnapshot['buckets']['cards'],
  label: 'cards' | 'gallery' | 'groups' | 'pictures' | 'templates' | 'themes',
) {
  if (label === 'cards') {
    return formatCountLabel(bucket.itemCount, 'card')
  }

  if (label === 'groups') {
    return formatCountLabel(bucket.itemCount, 'group')
  }

  if (label === 'pictures') {
    const pictureLabel = formatCountLabel(bucket.itemCount, 'picture node')

    if (!bucket.linkedAssetCount) {
      return pictureLabel
    }

    return `${pictureLabel} · ${formatCountLabel(bucket.linkedAssetCount, 'stored image')}`
  }

  if (label === 'templates') {
    const templateLabel = formatCountLabel(bucket.itemCount, 'template')

    if (!bucket.linkedAssetCount) {
      return templateLabel
    }

    return `${templateLabel} · ${formatCountLabel(bucket.linkedAssetCount, 'stored image')}`
  }

  if (label === 'themes') {
    return formatCountLabel(bucket.itemCount, 'theme')
  }

  return `${formatCountLabel(bucket.itemCount, 'stored image')} outside this board`
}

function formatOriginQuotaDetail(storageSnapshot: WorkspaceStorageSnapshot) {
  const { originQuotaBytes, originUsageBytes } = storageSnapshot

  if (originUsageBytes !== null && originQuotaBytes !== null) {
    return `${formatByteSize(originUsageBytes)} used of ${formatByteSize(originQuotaBytes)}`
  }

  if (originUsageBytes !== null) {
    return `${formatByteSize(originUsageBytes)} used across this browser origin.`
  }

  if (originQuotaBytes !== null) {
    return `${formatByteSize(originQuotaBytes)} available across this browser origin.`
  }

  return 'Live browser quota is not available in this browser.'
}

function TimelineChart(props: {
  barTestId: string
  metric: TimelineMetric
  meta: string
  points: StatisticsTimelinePoint[]
  testId: string
  title: string
}) {
  const maxValue = props.points.reduce(
    (currentMax, point) => Math.max(currentMax, point[props.metric]),
    0,
  )

  return (
    <section className={styles.timelineCard} data-testid={props.testId}>
      <div className={styles.timelineHeader}>
        <h4 className={styles.timelineTitle}>{props.title}</h4>
        <span
          className={styles.timelineMeta}
          data-testid={`${props.testId}-meta`}
        >
          {props.meta}
        </span>
      </div>
      <div
        className={styles.timelineBars}
        style={{
          gridTemplateColumns: `repeat(${Math.max(props.points.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {props.points.map((point) => {
          const value = point[props.metric]
          const height =
            maxValue > 0 ? Math.max(8, Math.round((value / maxValue) * 100)) : 0

          return (
            <div
              className={styles.timelineBar}
              data-testid={props.barTestId}
              key={`${props.metric}-${point.id}`}
              title={`${point.title}: ${formatCount(value)}`}
            >
              <span
                className={`${styles.timelineBarFill} ${value === 0 ? styles.timelineBarFillEmpty : ''}`}
                style={{ height: `${height}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className={styles.timelineFooter}>
        <span>{props.points[0]?.label}</span>
        <span>{props.points.at(-1)?.label}</span>
      </div>
    </section>
  )
}

export function StatisticsPanel({
  cardCount,
  statistics,
  storageMessage,
  storageSnapshot,
  storageStatus,
}: StatisticsPanelProps) {
  const shownCardCount = statistics.cardRows.length
  const [selectedTimelineRange, setSelectedTimelineRange] =
    useState<StatisticsTimelineRange>('14d')
  const selectedTimeline = statistics.timelines[selectedTimelineRange]
  const selectedLinkTimelineTotal = selectedTimeline.points.reduce(
    (total, point) => total + point.linkOpens,
    0,
  )
  const selectedCanvasTimelineTotal = selectedTimeline.points.reduce(
    (total, point) => total + point.canvasOpens,
    0,
  )
  const libraryBytes = storageSnapshot
    ? storageSnapshot.buckets.gallery.bytes +
      storageSnapshot.buckets.templates.bytes +
      storageSnapshot.buckets.themes.bytes
    : 0
  const localStorageUsageRatio = storageSnapshot
    ? storageSnapshot.localStorageSnapshotBytes /
      storageSnapshot.localStoragePracticalLimitBytes
    : 0

  return (
    <div className={styles.statisticsGrid} data-testid="statistics-panel">
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Cards</span>
          <strong
            className={styles.summaryValue}
            data-testid="statistics-card-count"
          >
            {formatCount(cardCount)}
          </strong>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Groups</span>
          <strong
            className={styles.summaryValue}
            data-testid="statistics-group-count"
          >
            {formatCount(statistics.groupCount)}
          </strong>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Link opens</span>
          <strong
            className={styles.summaryValue}
            data-testid="statistics-link-opens-total"
          >
            {formatCount(statistics.linkOpens.total)}
          </strong>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Canvas opens</span>
          <strong
            className={styles.summaryValue}
            data-testid="statistics-canvas-opens-total"
          >
            {formatCount(statistics.canvasOpens.total)}
          </strong>
        </div>
      </div>

      <section
        className={styles.storageSection}
        data-testid="statistics-storage-section"
      >
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>Storage</h4>
          <span className={styles.sectionMeta}>
            Current board breakdown + live quota
          </span>
        </div>

        {storageSnapshot ? (
          <>
            <section className={styles.storageCluster}>
              <div className={styles.storageSubheader}>
                <h5 className={styles.storageSubtitle}>Current board</h5>
                <span className={styles.storageSubmeta}>
                  {`${formatByteSize(storageSnapshot.currentBoardBytes)} total`}
                </span>
              </div>
              <div className={styles.storageGrid}>
                <article
                  className={`${styles.summaryCard} ${styles.storageBucketCard}`}
                >
                  <span className={styles.summaryLabel}>Groups</span>
                  <strong
                    className={styles.summaryValue}
                    data-testid="statistics-storage-value-groups"
                  >
                    {formatByteSize(storageSnapshot.buckets.groups.bytes)}
                  </strong>
                  <span className={styles.summaryCaption}>
                    {formatStorageBucketCaption(
                      storageSnapshot.buckets.groups,
                      'groups',
                    )}
                  </span>
                </article>
                <article
                  className={`${styles.summaryCard} ${styles.storageBucketCard}`}
                >
                  <span className={styles.summaryLabel}>Cards</span>
                  <strong
                    className={styles.summaryValue}
                    data-testid="statistics-storage-value-cards"
                  >
                    {formatByteSize(storageSnapshot.buckets.cards.bytes)}
                  </strong>
                  <span className={styles.summaryCaption}>
                    {formatStorageBucketCaption(
                      storageSnapshot.buckets.cards,
                      'cards',
                    )}
                  </span>
                </article>
                <article
                  className={`${styles.summaryCard} ${styles.storageBucketCard}`}
                >
                  <span className={styles.summaryLabel}>Pictures</span>
                  <strong
                    className={styles.summaryValue}
                    data-testid="statistics-storage-value-pictures"
                  >
                    {formatByteSize(storageSnapshot.buckets.pictures.bytes)}
                  </strong>
                  <span className={styles.summaryCaption}>
                    {formatStorageBucketCaption(
                      storageSnapshot.buckets.pictures,
                      'pictures',
                    )}
                  </span>
                </article>
                <article
                  className={`${styles.summaryCard} ${styles.storageTotalCard}`}
                >
                  <span className={styles.summaryLabel}>
                    Current board total
                  </span>
                  <strong
                    className={styles.summaryValue}
                    data-testid="statistics-storage-value-current-board"
                  >
                    {formatByteSize(storageSnapshot.currentBoardBytes)}
                  </strong>
                  <span className={styles.summaryCaption}>
                    Groups + cards + pictures
                  </span>
                </article>
              </div>
            </section>

            <section className={styles.storageCluster}>
              <div className={styles.storageSubheader}>
                <h5 className={styles.storageSubtitle}>Local library</h5>
                <span className={styles.storageSubmeta}>
                  {`${formatByteSize(libraryBytes)} outside the active board`}
                </span>
              </div>
              <div className={styles.storageLibraryGrid}>
                <article
                  className={`${styles.summaryCard} ${styles.storageBucketCard}`}
                >
                  <span className={styles.summaryLabel}>Templates</span>
                  <strong
                    className={styles.summaryValue}
                    data-testid="statistics-storage-value-templates"
                  >
                    {formatByteSize(storageSnapshot.buckets.templates.bytes)}
                  </strong>
                  <span className={styles.summaryCaption}>
                    {formatStorageBucketCaption(
                      storageSnapshot.buckets.templates,
                      'templates',
                    )}
                  </span>
                </article>
                <article
                  className={`${styles.summaryCard} ${styles.storageBucketCard}`}
                >
                  <span className={styles.summaryLabel}>Gallery only</span>
                  <strong
                    className={styles.summaryValue}
                    data-testid="statistics-storage-value-gallery"
                  >
                    {formatByteSize(storageSnapshot.buckets.gallery.bytes)}
                  </strong>
                  <span className={styles.summaryCaption}>
                    {formatStorageBucketCaption(
                      storageSnapshot.buckets.gallery,
                      'gallery',
                    )}
                  </span>
                </article>
                <article
                  className={`${styles.summaryCard} ${styles.storageBucketCard}`}
                >
                  <span className={styles.summaryLabel}>Themes</span>
                  <strong
                    className={styles.summaryValue}
                    data-testid="statistics-storage-value-themes"
                  >
                    {formatByteSize(storageSnapshot.buckets.themes.bytes)}
                  </strong>
                  <span className={styles.summaryCaption}>
                    {formatStorageBucketCaption(
                      storageSnapshot.buckets.themes,
                      'themes',
                    )}
                  </span>
                </article>
              </div>
            </section>

            <section className={styles.storageCluster}>
              <div className={styles.storageSubheader}>
                <h5 className={styles.storageSubtitle}>Capacity</h5>
                <span className={styles.storageSubmeta}>
                  Browser-managed quota + fallback snapshot
                </span>
              </div>
              <div className={styles.storageDetailGrid}>
                <article
                  className={`${styles.timelineCard} ${styles.storageDetailCard}`}
                >
                  <span className={styles.summaryLabel}>
                    localStorage snapshot
                  </span>
                  <strong
                    className={styles.storageValue}
                    data-testid="statistics-storage-value-local-snapshot"
                  >
                    {formatByteSize(storageSnapshot.localStorageSnapshotBytes)}
                  </strong>
                  <span
                    className={styles.storageDetail}
                    data-testid="statistics-storage-local-snapshot-detail"
                  >
                    {`${formatByteSize(storageSnapshot.localStorageSnapshotBytes)} of ${formatByteSize(storageSnapshot.localStoragePracticalLimitBytes)} (${PERCENT_FORMATTER.format(localStorageUsageRatio)})`}
                  </span>
                </article>
                <article
                  className={`${styles.timelineCard} ${styles.storageDetailCard}`}
                >
                  <span className={styles.summaryLabel}>Browser quota</span>
                  <strong
                    className={styles.storageValue}
                    data-testid="statistics-storage-value-origin-usage"
                  >
                    {storageSnapshot.originUsageBytes === null
                      ? 'Unavailable'
                      : formatByteSize(storageSnapshot.originUsageBytes)}
                  </strong>
                  <span
                    className={styles.storageDetail}
                    data-testid="statistics-storage-origin-detail"
                  >
                    {formatOriginQuotaDetail(storageSnapshot)}
                  </span>
                </article>
              </div>

              <p
                className={styles.storageNote}
                data-testid="statistics-storage-origin-copy"
              >
                Browser-dependent: localStorage keeps a small fallback copy of
                the workspace, while IndexedDB quota comes from the browser and
                device. Live usage can still sit above the buckets shown here
                because the browser counts storage overhead in addition to the
                tracked records.
              </p>
            </section>
          </>
        ) : storageStatus === 'error' ? (
          <p
            className={styles.emptyState}
            data-testid="statistics-storage-error"
          >
            {storageMessage}
          </p>
        ) : (
          <p
            className={styles.emptyState}
            data-testid="statistics-storage-loading"
          >
            Calculating storage…
          </p>
        )}
      </section>

      <section className={styles.timelineSection}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>Timeline</h4>
          <div
            className={styles.timelineRangeList}
            role="group"
            aria-label="Timeline range"
          >
            {STATISTICS_TIMELINE_RANGES.map((range) => {
              const selected = selectedTimelineRange === range

              return (
                <button
                  aria-pressed={selected}
                  className={
                    selected
                      ? styles.timelineRangeButtonActive
                      : styles.timelineRangeButton
                  }
                  data-testid={`statistics-timeline-range-${range}`}
                  key={range}
                  onClick={() => setSelectedTimelineRange(range)}
                  type="button"
                >
                  {STATISTICS_TIMELINE_RANGE_LABELS[range]}
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.timelineGrid}>
          <TimelineChart
            barTestId="statistics-link-timeline-bar"
            meta={`${selectedTimeline.description} · ${formatCount(selectedLinkTimelineTotal)} opens`}
            metric="linkOpens"
            points={selectedTimeline.points}
            testId="statistics-link-timeline"
            title="Link opens"
          />
          <TimelineChart
            barTestId="statistics-canvas-timeline-bar"
            meta={`${selectedTimeline.description} · ${formatCount(selectedCanvasTimelineTotal)} opens`}
            metric="canvasOpens"
            points={selectedTimeline.points}
            testId="statistics-canvas-timeline"
            title="Canvas opens"
          />
        </div>
      </section>

      <section className={styles.cardListSection}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>Top 20 cards</h4>
          <span className={styles.sectionMeta}>
            {formatCount(shownCardCount)} of {formatCount(cardCount)} shown
          </span>
        </div>
        {statistics.cardRows.length === 0 ? (
          <p className={styles.emptyState}>No cards yet.</p>
        ) : (
          <div className={styles.cardList}>
            {statistics.cardRows.map((row) => (
              <article
                className={styles.cardRow}
                data-testid={`statistics-card-row-${row.cardId}`}
                key={row.cardId}
              >
                <div className={styles.cardText}>
                  <strong className={styles.cardTitle}>{row.title}</strong>
                  {row.subtitle ? (
                    <span className={styles.cardSubtitle}>{row.subtitle}</span>
                  ) : null}
                </div>
                <div className={styles.cardMetrics}>
                  {STATISTICS_PERIODS.map((period) => (
                    <div
                      className={styles.cardMetric}
                      key={`${row.cardId}-${period}`}
                    >
                      <span className={styles.cardMetricLabel}>
                        {STATISTICS_PERIOD_SHORT_LABELS[period]}
                      </span>
                      <strong
                        className={styles.cardMetricValue}
                        data-testid={`statistics-card-value-${row.cardId}-${period}`}
                      >
                        {formatCount(row.counts[period])}
                      </strong>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
