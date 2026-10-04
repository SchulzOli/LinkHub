import { z } from 'zod'

import { CardSizeSchema, coerceCardSize, type CardSize } from './linkCard'

/**
 * Feed nodes show news items from one or more RSS / Atom feeds. Like charts
 * they live in `workspace.pictures` (discriminated by `type`), so grouping,
 * moving, selection, templates and import/export treat them like any other
 * free-floating node.
 */

export const FEED_SORTS = ['newest', 'oldest', 'source', 'title'] as const
export const FeedSortSchema = z.enum(FEED_SORTS)
export type FeedSort = z.infer<typeof FeedSortSchema>

export const FEED_SORT_LABELS: Record<FeedSort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  source: 'By source',
  title: 'Title A–Z',
}

export const FEED_TIME_WINDOWS = ['all', '24h', '3d', '7d', '30d'] as const
export const FeedTimeWindowSchema = z.enum(FEED_TIME_WINDOWS)
export type FeedTimeWindow = z.infer<typeof FeedTimeWindowSchema>

export const FEED_TIME_WINDOW_LABELS: Record<FeedTimeWindow, string> = {
  all: 'Any time',
  '24h': 'Last 24 h',
  '3d': 'Last 3 days',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
}

export const FEED_TIME_WINDOW_MS: Record<FeedTimeWindow, number | null> = {
  all: null,
  '24h': 24 * 3600 * 1000,
  '3d': 3 * 24 * 3600 * 1000,
  '7d': 7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
}

export const FEED_REFRESH_MINUTES = [0, 5, 15, 30, 60] as const

export const FeedSettingsSchema = z.object({
  sort: FeedSortSchema,
  timeWindow: FeedTimeWindowSchema,
  /** Source URLs that are hidden; empty = show every source. */
  hiddenSources: z.array(z.string()).max(50),
  showSummaries: z.boolean(),
  showImages: z.boolean(),
  /** 0 = manual refresh only. */
  refreshMinutes: z
    .number()
    .int()
    .refine((value) =>
      (FEED_REFRESH_MINUTES as readonly number[]).includes(value),
    ),
})

export type FeedSettings = z.infer<typeof FeedSettingsSchema>
export type FeedSettingKey = keyof FeedSettings

export const FEED_SETTING_KEYS = Object.keys(
  FeedSettingsSchema.shape,
) as FeedSettingKey[]

export const DEFAULT_FEED_SETTINGS: FeedSettings = {
  sort: 'newest',
  timeWindow: 'all',
  hiddenSources: [],
  showSummaries: true,
  showImages: true,
  refreshMinutes: 15,
}

export const FeedSourceSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .refine((value) => isHttpUrl(value), 'Use an http:// or https:// URL'),
  /** Optional label; falls back to the feed's own title. */
  title: z.string().trim().max(80).optional(),
})

export type FeedSource = z.infer<typeof FeedSourceSchema>

export const MAX_FEED_SOURCES = 12

/**
 * Most feeds don't send CORS headers, so the browser can't read them
 * directly. Requests go through this proxy (`npm run feed:news`) unless the
 * node's proxy URL is cleared. See doc/NEWS_FEED.md.
 */
export const DEFAULT_FEED_PROXY_URL = 'http://127.0.0.1:8788/rss'

export const DEFAULT_FEED_SIZE: CardSize = { columns: 14, rows: 18 }

export const FeedNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('feed'),
  title: z.string().trim().max(80).optional(),
  sources: z.array(FeedSourceSchema).max(MAX_FEED_SOURCES),
  /** Empty string = fetch feeds directly (only works for CORS-enabled feeds). */
  proxyUrl: z.string().trim().max(2048),
  settings: FeedSettingsSchema,
  positionX: z.number(),
  positionY: z.number(),
  size: CardSizeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type FeedNode = z.infer<typeof FeedNodeSchema>

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())

    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function coerceFeedSettings(value: unknown): FeedSettings {
  const result: FeedSettings = {
    ...DEFAULT_FEED_SETTINGS,
    hiddenSources: [],
  }

  if (typeof value !== 'object' || value === null) {
    return result
  }

  const shape = FeedSettingsSchema.shape

  for (const key of FEED_SETTING_KEYS) {
    const parsed = shape[key].safeParse((value as Record<string, unknown>)[key])

    if (parsed.success) {
      ;(result as Record<string, unknown>)[key] = parsed.data
    }
  }

  return result
}

export function coerceFeedNode(value: unknown): FeedNode | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<FeedNode> & {
    size?: unknown
    settings?: unknown
    sources?: unknown
    title?: unknown
    proxyUrl?: unknown
  }

  if (
    candidate.type !== 'feed' ||
    typeof candidate.id !== 'string' ||
    candidate.id.length === 0 ||
    typeof candidate.positionX !== 'number' ||
    typeof candidate.positionY !== 'number' ||
    typeof candidate.createdAt !== 'string' ||
    typeof candidate.updatedAt !== 'string'
  ) {
    return null
  }

  const sources = Array.isArray(candidate.sources)
    ? candidate.sources
        .map((source) => FeedSourceSchema.safeParse(source))
        .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
        .slice(0, MAX_FEED_SOURCES)
    : []
  const title =
    typeof candidate.title === 'string' && candidate.title.trim()
      ? candidate.title.trim().slice(0, 80)
      : undefined
  const proxyUrl =
    typeof candidate.proxyUrl === 'string'
      ? candidate.proxyUrl.trim().slice(0, 2048)
      : DEFAULT_FEED_PROXY_URL

  return {
    id: candidate.id,
    type: 'feed',
    ...(title ? { title } : {}),
    sources,
    proxyUrl,
    settings: coerceFeedSettings(candidate.settings),
    positionX: candidate.positionX,
    positionY: candidate.positionY,
    size: coerceCardSize(candidate.size, DEFAULT_FEED_SIZE),
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  }
}
