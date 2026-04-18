import type { LinkCard } from '../../contracts/linkCard'
import type { Workspace } from '../../contracts/workspace'
import {
  createDefaultWorkspaceAnalytics,
  type WorkspaceAnalytics,
} from '../../contracts/workspaceAnalytics'

const TOP_CARD_ROW_LIMIT = 20

const PERIODS = ['day', 'week', 'month', 'year', 'total'] as const
const TIMELINE_RANGES = ['14d', '30d', '12w', '12m', 'all'] as const

export type StatisticsPeriod = (typeof PERIODS)[number]
export type StatisticsTimelineRange = (typeof TIMELINE_RANGES)[number]

export const STATISTICS_PERIODS = PERIODS
export const STATISTICS_TIMELINE_RANGES = TIMELINE_RANGES

export const STATISTICS_PERIOD_LABELS: Record<StatisticsPeriod, string> = {
  day: 'Day',
  month: 'Month',
  total: 'Total',
  week: 'Week',
  year: 'Year',
}

export const STATISTICS_PERIOD_SHORT_LABELS: Record<StatisticsPeriod, string> =
  {
    day: 'D',
    month: 'M',
    total: 'All',
    week: 'W',
    year: 'Y',
  }

export const STATISTICS_TIMELINE_RANGE_LABELS: Record<
  StatisticsTimelineRange,
  string
> = {
  '12m': '12M',
  '12w': '12W',
  '14d': '14D',
  '30d': '30D',
  all: 'All',
}

type StatisticsCounts = Record<StatisticsPeriod, number>

export type StatisticsTimelinePoint = {
  id: string
  canvasOpens: number
  label: string
  linkOpens: number
  title: string
}

export type StatisticsTimeline = {
  description: string
  points: StatisticsTimelinePoint[]
}

export type StatisticsCardRow = {
  cardId: string
  counts: StatisticsCounts
  subtitle: string | null
  title: string
}

export type WorkspaceStatisticsSnapshot = {
  canvasOpens: StatisticsCounts
  cardRows: StatisticsCardRow[]
  groupCount: number
  linkOpens: StatisticsCounts
  timelines: Record<StatisticsTimelineRange, StatisticsTimeline>
}

function createEmptyCounts(): StatisticsCounts {
  return {
    day: 0,
    month: 0,
    total: 0,
    week: 0,
    year: 0,
  }
}

function padDateSegment(value: number) {
  return String(value).padStart(2, '0')
}

export function toLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${padDateSegment(date.getMonth() + 1)}-${padDateSegment(date.getDate())}`
}

function fromLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)

  return new Date(year, (month || 1) - 1, day || 1)
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date)
  nextDate.setMonth(nextDate.getMonth() + months)
  return nextDate
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getWeekStart(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = start.getDay()
  const offset = day === 0 ? -6 : 1 - day

  start.setDate(start.getDate() + offset)
  return start
}

function isInCurrentWeek(date: Date, now: Date) {
  const start = getWeekStart(now)
  const end = addDays(start, 7)

  return date >= start && date < end
}

function isInCurrentMonth(date: Date, now: Date) {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  )
}

function isInCurrentYear(date: Date, now: Date) {
  return date.getFullYear() === now.getFullYear()
}

function incrementCountRecord(record: Record<string, number>, key: string) {
  return {
    ...record,
    [key]: (record[key] ?? 0) + 1,
  }
}

function getOrCreateAnalytics(analytics: WorkspaceAnalytics | undefined) {
  return analytics ?? createDefaultWorkspaceAnalytics()
}

export function recordLinkOpenInAnalytics(
  analytics: WorkspaceAnalytics | undefined,
  cardId: string,
  now = new Date(),
) {
  const nextAnalytics = getOrCreateAnalytics(analytics)
  const dateKey = toLocalDateKey(now)
  const currentBucket = nextAnalytics.dailyBuckets[dateKey] ?? {
    canvasOpens: 0,
    linkOpens: 0,
    linkOpensByCardId: {},
  }

  return {
    dailyBuckets: {
      ...nextAnalytics.dailyBuckets,
      [dateKey]: {
        ...currentBucket,
        linkOpens: currentBucket.linkOpens + 1,
        linkOpensByCardId: incrementCountRecord(
          currentBucket.linkOpensByCardId,
          cardId,
        ),
      },
    },
    totals: {
      ...nextAnalytics.totals,
      linkOpens: nextAnalytics.totals.linkOpens + 1,
      linkOpensByCardId: incrementCountRecord(
        nextAnalytics.totals.linkOpensByCardId,
        cardId,
      ),
    },
  } satisfies WorkspaceAnalytics
}

export function recordCanvasOpenInAnalytics(
  analytics: WorkspaceAnalytics | undefined,
  now = new Date(),
) {
  const nextAnalytics = getOrCreateAnalytics(analytics)
  const dateKey = toLocalDateKey(now)
  const currentBucket = nextAnalytics.dailyBuckets[dateKey] ?? {
    canvasOpens: 0,
    linkOpens: 0,
    linkOpensByCardId: {},
  }

  return {
    dailyBuckets: {
      ...nextAnalytics.dailyBuckets,
      [dateKey]: {
        ...currentBucket,
        canvasOpens: currentBucket.canvasOpens + 1,
      },
    },
    totals: {
      ...nextAnalytics.totals,
      canvasOpens: nextAnalytics.totals.canvasOpens + 1,
    },
  } satisfies WorkspaceAnalytics
}

function formatTimelineLabel(date: Date) {
  return `${padDateSegment(date.getDate())}.${padDateSegment(date.getMonth() + 1)}`
}

function formatMonthLabel(date: Date, includeYear = false) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    ...(includeYear ? { year: '2-digit' } : null),
  }).format(date)
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function sumAnalyticsBetween(
  analytics: WorkspaceAnalytics,
  start: Date,
  end: Date,
) {
  let canvasOpens = 0
  let linkOpens = 0

  for (const [dateKey, bucket] of Object.entries(analytics.dailyBuckets)) {
    const bucketDate = fromLocalDateKey(dateKey)

    if (bucketDate < start || bucketDate >= end) {
      continue
    }

    canvasOpens += bucket.canvasOpens
    linkOpens += bucket.linkOpens
  }

  return {
    canvasOpens,
    linkOpens,
  }
}

function createTimelinePoint(
  id: string,
  label: string,
  title: string,
  values: {
    canvasOpens: number
    linkOpens: number
  },
) {
  return {
    ...values,
    id,
    label,
    title,
  } satisfies StatisticsTimelinePoint
}

function getDailyTimeline(
  analytics: WorkspaceAnalytics,
  now: Date,
  days: number,
  description: string,
) {
  const start = addDays(startOfDay(now), -(days - 1))

  return {
    description,
    points: Array.from({ length: days }, (_, index) => {
      const date = addDays(start, index)
      const dateKey = toLocalDateKey(date)
      const bucket = analytics.dailyBuckets[dateKey]

      return createTimelinePoint(
        dateKey,
        formatTimelineLabel(date),
        formatTimelineLabel(date),
        {
          canvasOpens: bucket?.canvasOpens ?? 0,
          linkOpens: bucket?.linkOpens ?? 0,
        },
      )
    }),
  } satisfies StatisticsTimeline
}

function getWeeklyTimeline(
  analytics: WorkspaceAnalytics,
  now: Date,
  weeks: number,
  description: string,
) {
  const currentWeekStart = getWeekStart(now)
  const start = addDays(currentWeekStart, -(weeks - 1) * 7)

  return {
    description,
    points: Array.from({ length: weeks }, (_, index) => {
      const weekStart = addDays(start, index * 7)
      const weekEnd = addDays(weekStart, 7)

      return createTimelinePoint(
        toLocalDateKey(weekStart),
        formatTimelineLabel(weekStart),
        `${formatTimelineLabel(weekStart)} - ${formatTimelineLabel(addDays(weekEnd, -1))}`,
        sumAnalyticsBetween(analytics, weekStart, weekEnd),
      )
    }),
  } satisfies StatisticsTimeline
}

function monthDifference(start: Date, end: Date) {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    end.getMonth() -
    start.getMonth()
  )
}

function getMonthlyTimeline(
  analytics: WorkspaceAnalytics,
  now: Date,
  monthCount: number,
  description: string,
) {
  const currentMonthStart = startOfMonth(now)
  const start = addMonths(currentMonthStart, -(monthCount - 1))
  const includeYear = monthCount > 12

  return {
    description,
    points: Array.from({ length: monthCount }, (_, index) => {
      const monthStart = addMonths(start, index)
      const monthEnd = addMonths(monthStart, 1)

      return createTimelinePoint(
        `${monthStart.getFullYear()}-${padDateSegment(monthStart.getMonth() + 1)}`,
        formatMonthLabel(monthStart, includeYear),
        formatMonthTitle(monthStart),
        sumAnalyticsBetween(analytics, monthStart, monthEnd),
      )
    }),
  } satisfies StatisticsTimeline
}

function getAllTimeTimeline(analytics: WorkspaceAnalytics, now: Date) {
  const dateKeys = Object.keys(analytics.dailyBuckets).sort()
  const currentMonthStart = startOfMonth(now)
  const firstMonthStart = dateKeys[0]
    ? startOfMonth(fromLocalDateKey(dateKeys[0]))
    : currentMonthStart
  const monthCount = Math.max(
    1,
    monthDifference(firstMonthStart, currentMonthStart) + 1,
  )

  return getMonthlyTimeline(analytics, now, monthCount, 'All recorded months')
}

function getTimelines(analytics: WorkspaceAnalytics, now: Date) {
  return {
    '12m': getMonthlyTimeline(analytics, now, 12, 'Last 12 months'),
    '12w': getWeeklyTimeline(analytics, now, 12, 'Last 12 weeks'),
    '14d': getDailyTimeline(analytics, now, 14, 'Last 14 days'),
    '30d': getDailyTimeline(analytics, now, 30, 'Last 30 days'),
    all: getAllTimeTimeline(analytics, now),
  } satisfies Record<StatisticsTimelineRange, StatisticsTimeline>
}

function buildCountsFromAnalytics(
  analytics: WorkspaceAnalytics,
  now: Date,
  readValue: (dateKey: string) => number,
) {
  const counts = createEmptyCounts()
  const todayKey = toLocalDateKey(now)

  for (const dateKey of Object.keys(analytics.dailyBuckets)) {
    const value = readValue(dateKey)

    if (value === 0) {
      continue
    }

    const bucketDate = fromLocalDateKey(dateKey)

    if (dateKey === todayKey) {
      counts.day += value
    }

    if (isInCurrentWeek(bucketDate, now)) {
      counts.week += value
    }

    if (isInCurrentMonth(bucketDate, now)) {
      counts.month += value
    }

    if (isInCurrentYear(bucketDate, now)) {
      counts.year += value
    }
  }

  return counts
}

function getCardRow(card: LinkCard, analytics: WorkspaceAnalytics, now: Date) {
  const counts = buildCountsFromAnalytics(
    analytics,
    now,
    (dateKey) =>
      analytics.dailyBuckets[dateKey]?.linkOpensByCardId[card.id] ?? 0,
  )

  counts.total = analytics.totals.linkOpensByCardId[card.id] ?? 0

  return {
    cardId: card.id,
    counts,
    subtitle: card.title.trim().length > 0 ? card.url : null,
    title: card.title.trim().length > 0 ? card.title : card.url,
  } satisfies StatisticsCardRow
}

export function getWorkspaceStatisticsSnapshot(
  workspace: Pick<Workspace, 'analytics' | 'cards' | 'groups'>,
  now = new Date(),
): WorkspaceStatisticsSnapshot {
  const analytics = getOrCreateAnalytics(workspace.analytics)
  const linkOpens = buildCountsFromAnalytics(
    analytics,
    now,
    (dateKey) => analytics.dailyBuckets[dateKey]?.linkOpens ?? 0,
  )
  const canvasOpens = buildCountsFromAnalytics(
    analytics,
    now,
    (dateKey) => analytics.dailyBuckets[dateKey]?.canvasOpens ?? 0,
  )

  linkOpens.total = analytics.totals.linkOpens
  canvasOpens.total = analytics.totals.canvasOpens

  const cardRows = workspace.cards
    .map((card) => getCardRow(card, analytics, now))
    .sort((left, right) => {
      if (left.counts.total !== right.counts.total) {
        return right.counts.total - left.counts.total
      }

      return left.title.localeCompare(right.title)
    })
    .slice(0, TOP_CARD_ROW_LIMIT)

  return {
    canvasOpens,
    cardRows,
    groupCount: workspace.groups.length,
    linkOpens,
    timelines: getTimelines(analytics, now),
  }
}
