import { z } from 'zod'

import { CardSizeSchema, coerceCardSize, type CardSize } from './linkCard'

/**
 * Chart nodes plot an external, streamed time series (e.g. a stock price).
 * They live next to image pictures in `workspace.pictures` (discriminated by
 * `type`) so grouping, moving, collapsing, selection and templates treat
 * them like every other free-floating node.
 */

export const CHART_RANGES = [
  '1D',
  '5D',
  '1M',
  '6M',
  'YTD',
  '1Y',
  '3Y',
  '5Y',
  'MAX',
] as const

export const ChartRangeSchema = z.enum(CHART_RANGES)
export type ChartRange = z.infer<typeof ChartRangeSchema>

export const CHART_RANGE_LABELS: Record<ChartRange, string> = {
  '1D': '1D',
  '5D': '5D',
  '1M': '1M',
  '6M': '6M',
  YTD: 'YTD',
  '1Y': '1Y',
  '3Y': '3Y',
  '5Y': '5Y',
  MAX: 'Max',
}

export const ChartValueModeSchema = z.enum(['price', 'percent'])
export const ChartStyleSchema = z.enum(['line', 'area'])
export const ChartOverlaySchema = z.enum(['none', 'sma20', 'sma50', 'sma200'])
export const ChartScaleSchema = z.enum(['linear', 'log'])

export type ChartValueMode = z.infer<typeof ChartValueModeSchema>
export type ChartStyle = z.infer<typeof ChartStyleSchema>
export type ChartOverlay = z.infer<typeof ChartOverlaySchema>
export type ChartScale = z.infer<typeof ChartScaleSchema>

/** Every interaction a chart offers. Groups can set each one for members. */
export const ChartSettingsSchema = z.object({
  range: ChartRangeSchema,
  valueMode: ChartValueModeSchema,
  chartStyle: ChartStyleSchema,
  overlay: ChartOverlaySchema,
  scale: ChartScaleSchema,
  live: z.boolean(),
})

export type ChartSettings = z.infer<typeof ChartSettingsSchema>
export type ChartSettingKey = keyof ChartSettings

/** Sparse: only keys that were set explicitly on this level. */
export const ChartSettingsOverridesSchema = ChartSettingsSchema.partial()
export type ChartSettingsOverrides = z.infer<
  typeof ChartSettingsOverridesSchema
>

export const CHART_SETTING_KEYS = Object.keys(
  ChartSettingsSchema.shape,
) as ChartSettingKey[]

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  range: '1Y',
  valueMode: 'price',
  chartStyle: 'area',
  overlay: 'none',
  scale: 'linear',
  live: true,
}

/**
 * Where the data comes from. The protocol follows the URL scheme:
 * ws:// / wss:// → WebSocket, http:// / https:// → Server-Sent Events.
 * See doc/CHART_FEED.md for the message format.
 */
export const ChartSourceSchema = z.object({
  url: z.string().trim().min(1),
  symbol: z.string().trim().min(1).max(32),
})

export type ChartSource = z.infer<typeof ChartSourceSchema>

export const DEFAULT_CHART_FEED_URL = 'ws://127.0.0.1:8787/feed'

export const DEFAULT_CHART_SIZE: CardSize = { columns: 12, rows: 8 }

export const ChartNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('chart'),
  title: z.string().trim().max(80).optional(),
  source: ChartSourceSchema,
  settings: ChartSettingsOverridesSchema,
  positionX: z.number(),
  positionY: z.number(),
  size: CardSizeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ChartNode = z.infer<typeof ChartNodeSchema>

export function getChartTransport(url: string): 'websocket' | 'sse' | null {
  const scheme = url.trim().toLowerCase().split(':', 1)[0]

  if (scheme === 'ws' || scheme === 'wss') {
    return 'websocket'
  }

  if (scheme === 'http' || scheme === 'https') {
    return 'sse'
  }

  return null
}

export function coerceChartSettingsOverrides(
  value: unknown,
): ChartSettingsOverrides {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  const result: ChartSettingsOverrides = {}
  const shape = ChartSettingsSchema.shape

  for (const key of CHART_SETTING_KEYS) {
    const parsed = shape[key].safeParse((value as Record<string, unknown>)[key])

    if (parsed.success) {
      ;(result as Record<string, unknown>)[key] = parsed.data
    }
  }

  return result
}

export function coerceChartNode(value: unknown): ChartNode | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<ChartNode> & {
    size?: unknown
    settings?: unknown
    source?: unknown
    title?: unknown
  }

  if (
    candidate.type !== 'chart' ||
    typeof candidate.id !== 'string' ||
    candidate.id.length === 0 ||
    typeof candidate.positionX !== 'number' ||
    typeof candidate.positionY !== 'number' ||
    typeof candidate.createdAt !== 'string' ||
    typeof candidate.updatedAt !== 'string'
  ) {
    return null
  }

  const source = ChartSourceSchema.safeParse(candidate.source)

  if (!source.success) {
    return null
  }

  const title =
    typeof candidate.title === 'string' && candidate.title.trim()
      ? candidate.title.trim().slice(0, 80)
      : undefined

  return {
    id: candidate.id,
    type: 'chart',
    ...(title ? { title } : {}),
    source: source.data,
    settings: coerceChartSettingsOverrides(candidate.settings),
    positionX: candidate.positionX,
    positionY: candidate.positionY,
    size: coerceCardSize(candidate.size, DEFAULT_CHART_SIZE),
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  }
}
