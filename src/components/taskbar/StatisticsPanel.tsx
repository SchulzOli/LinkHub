import { useState } from 'react'
import panelStyles from '../ui/panel/Panel.module.css'

import styles from './StatisticsPanel.module.css'

import { PanelSection, Stat, StatGrid } from '../ui/panel/Panel'

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
        <h5 className={styles.timelineTitle}>{props.title}</h5>
        <span
          className={panelStyles.sectionMeta}
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

function StorageMeter({ ratio }: { ratio: number }) {
  const clamped = Math.min(Math.max(ratio, 0), 1)

  return (
    <span aria-hidden="true" className={styles.meter}>
      <span
        className={styles.meterFill}
        data-level={clamped > 0.85 ? 'high' : clamped > 0.6 ? 'mid' : 'low'}
        style={{ width: `${Math.max(clamped * 100, clamped > 0 ? 2 : 0)}%` }}
      />
    </span>
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
  const originUsageRatio =
    storageSnapshot?.originUsageBytes != null &&
    storageSnapshot.originQuotaBytes
      ? storageSnapshot.originUsageBytes / storageSnapshot.originQuotaBytes
      : null

  return (
    <div
      className={`${panelStyles.stack} ${styles.statistics}`}
      data-testid="statistics-panel"
    >
      <PanelSection grouped={false} title="Overview">
        <StatGrid columns={4}>
          <Stat
            label="Cards"
            value={formatCount(cardCount)}
            valueTestId="statistics-card-count"
          />
          <Stat
            label="Groups"
            value={formatCount(statistics.groupCount)}
            valueTestId="statistics-group-count"
          />
          <Stat
            label="Link opens"
            value={formatCount(statistics.linkOpens.total)}
            valueTestId="statistics-link-opens-total"
          />
          <Stat
            label="Canvas opens"
            value={formatCount(statistics.canvasOpens.total)}
            valueTestId="statistics-canvas-opens-total"
          />
        </StatGrid>
      </PanelSection>

      <PanelSection
        actions={
          <div
            aria-label="Timeline range"
            className={panelStyles.segmented}
            role="group"
          >
            {STATISTICS_TIMELINE_RANGES.map((range) => (
              <button
                aria-pressed={selectedTimelineRange === range}
                className={panelStyles.segment}
                data-testid={`statistics-timeline-range-${range}`}
                key={range}
                onClick={() => setSelectedTimelineRange(range)}
                type="button"
              >
                {STATISTICS_TIMELINE_RANGE_LABELS[range]}
              </button>
            ))}
          </div>
        }
        title="Timeline"
      >
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
      </PanelSection>

      <PanelSection
        meta={`${formatCount(shownCardCount)} of ${formatCount(cardCount)} shown`}
        title="Top 20 cards"
      >
        {statistics.cardRows.length === 0 ? (
          <p className={panelStyles.empty}>No cards yet.</p>
        ) : (
          <div className={styles.cardTable}>
            <div aria-hidden="true" className={styles.cardTableHead}>
              <span>Card</span>
              {STATISTICS_PERIODS.map((period) => (
                <span key={period}>
                  {STATISTICS_PERIOD_SHORT_LABELS[period]}
                </span>
              ))}
            </div>
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
                      <span className={styles.cardSubtitle}>
                        {row.subtitle}
                      </span>
                    ) : null}
                  </div>
                  {STATISTICS_PERIODS.map((period) => (
                    <strong
                      aria-label={`${STATISTICS_PERIOD_SHORT_LABELS[period]}: ${formatCount(row.counts[period])}`}
                      className={styles.cardMetricValue}
                      data-empty={row.counts[period] === 0}
                      data-testid={`statistics-card-value-${row.cardId}-${period}`}
                      key={`${row.cardId}-${period}`}
                    >
                      {formatCount(row.counts[period])}
                    </strong>
                  ))}
                </article>
              ))}
            </div>
          </div>
        )}
      </PanelSection>

      <section
        className={panelStyles.stack}
        data-testid="statistics-storage-section"
      >
        {storageSnapshot ? (
          <>
            <PanelSection
              meta={`${formatByteSize(storageSnapshot.currentBoardBytes)} total`}
              title="Current board"
            >
              <StorageRow
                caption={formatStorageBucketCaption(
                  storageSnapshot.buckets.groups,
                  'groups',
                )}
                label="Groups"
                testId="statistics-storage-value-groups"
                value={formatByteSize(storageSnapshot.buckets.groups.bytes)}
              />
              <StorageRow
                caption={formatStorageBucketCaption(
                  storageSnapshot.buckets.cards,
                  'cards',
                )}
                label="Cards"
                testId="statistics-storage-value-cards"
                value={formatByteSize(storageSnapshot.buckets.cards.bytes)}
              />
              <StorageRow
                caption={formatStorageBucketCaption(
                  storageSnapshot.buckets.pictures,
                  'pictures',
                )}
                label="Pictures"
                testId="statistics-storage-value-pictures"
                value={formatByteSize(storageSnapshot.buckets.pictures.bytes)}
              />
              <StorageRow
                caption="Groups + cards + pictures"
                emphasis
                label="Current board total"
                testId="statistics-storage-value-current-board"
                value={formatByteSize(storageSnapshot.currentBoardBytes)}
              />
            </PanelSection>

            <PanelSection
              meta={`${formatByteSize(libraryBytes)} outside the active board`}
              title="Local library"
            >
              <StorageRow
                caption={formatStorageBucketCaption(
                  storageSnapshot.buckets.templates,
                  'templates',
                )}
                label="Templates"
                testId="statistics-storage-value-templates"
                value={formatByteSize(storageSnapshot.buckets.templates.bytes)}
              />
              <StorageRow
                caption={formatStorageBucketCaption(
                  storageSnapshot.buckets.gallery,
                  'gallery',
                )}
                label="Gallery only"
                testId="statistics-storage-value-gallery"
                value={formatByteSize(storageSnapshot.buckets.gallery.bytes)}
              />
              <StorageRow
                caption={formatStorageBucketCaption(
                  storageSnapshot.buckets.themes,
                  'themes',
                )}
                label="Themes"
                testId="statistics-storage-value-themes"
                value={formatByteSize(storageSnapshot.buckets.themes.bytes)}
              />
            </PanelSection>

            <PanelSection
              meta="Browser-managed quota + fallback snapshot"
              title="Capacity"
            >
              <div className={styles.capacityRow}>
                <div className={styles.capacityText}>
                  <span className={panelStyles.rowLabel}>
                    localStorage snapshot
                  </span>
                  <span
                    className={panelStyles.rowHint}
                    data-testid="statistics-storage-local-snapshot-detail"
                  >
                    {`${formatByteSize(storageSnapshot.localStorageSnapshotBytes)} of ${formatByteSize(storageSnapshot.localStoragePracticalLimitBytes)} (${PERCENT_FORMATTER.format(localStorageUsageRatio)})`}
                  </span>
                </div>
                <strong
                  className={styles.storageValue}
                  data-testid="statistics-storage-value-local-snapshot"
                >
                  {formatByteSize(storageSnapshot.localStorageSnapshotBytes)}
                </strong>
                <StorageMeter ratio={localStorageUsageRatio} />
              </div>
              <div className={styles.capacityRow}>
                <div className={styles.capacityText}>
                  <span className={panelStyles.rowLabel}>Browser quota</span>
                  <span
                    className={panelStyles.rowHint}
                    data-testid="statistics-storage-origin-detail"
                  >
                    {formatOriginQuotaDetail(storageSnapshot)}
                  </span>
                </div>
                <strong
                  className={styles.storageValue}
                  data-testid="statistics-storage-value-origin-usage"
                >
                  {storageSnapshot.originUsageBytes === null
                    ? 'Unavailable'
                    : formatByteSize(storageSnapshot.originUsageBytes)}
                </strong>
                {originUsageRatio !== null ? (
                  <StorageMeter ratio={originUsageRatio} />
                ) : null}
              </div>
            </PanelSection>
            <p
              className={panelStyles.sectionDescription}
              data-testid="statistics-storage-origin-copy"
            >
              Browser-dependent: localStorage keeps a small fallback copy of the
              workspace, while IndexedDB quota comes from the browser and
              device. Live usage can still sit above the buckets shown here
              because the browser counts storage overhead in addition to the
              tracked records.
            </p>
          </>
        ) : (
          <PanelSection title="Storage">
            {storageStatus === 'error' ? (
              <p
                className={panelStyles.empty}
                data-testid="statistics-storage-error"
              >
                {storageMessage}
              </p>
            ) : (
              <p
                className={panelStyles.empty}
                data-testid="statistics-storage-loading"
              >
                Calculating storage…
              </p>
            )}
          </PanelSection>
        )}
      </section>
    </div>
  )
}

function StorageRow({
  label,
  caption,
  value,
  testId,
  emphasis = false,
}: {
  label: string
  caption: string
  value: string
  testId: string
  emphasis?: boolean
}) {
  return (
    <div className={styles.storageRow} data-emphasis={emphasis}>
      <div className={styles.capacityText}>
        <span className={panelStyles.rowLabel}>{label}</span>
        <span className={panelStyles.rowHint}>{caption}</span>
      </div>
      <strong className={styles.storageValue} data-testid={testId}>
        {value}
      </strong>
    </div>
  )
}
