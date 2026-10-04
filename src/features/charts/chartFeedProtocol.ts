import { CHART_RANGES, type ChartRange } from '../../contracts/chartNode'

/**
 * LinkHub chart feed protocol (v1). JSON messages, identical for WebSocket
 * and Server-Sent Events. Points are `[epochMillis, value]`.
 *
 * WebSocket, client → server:
 *   { type: 'subscribe', id, symbol, range, live }
 *   { type: 'unsubscribe', id }
 * SSE: GET <url>?symbol=…&range=…&live=1|0 (one stream per subscription).
 *
 * Server → client (both transports; `id` may be omitted on SSE):
 *   { type: 'snapshot', id?, symbol, range, points, currency?, name? }
 *   { type: 'tick', id?, symbol, point }
 *   { type: 'error', id?, message }
 */

export type ChartPoint = [time: number, value: number]

export type ChartSnapshotMessage = {
  type: 'snapshot'
  id?: string
  symbol: string
  range: ChartRange
  points: ChartPoint[]
  currency?: string
  name?: string
}

export type ChartTickMessage = {
  type: 'tick'
  id?: string
  symbol: string
  point: ChartPoint
}

/** A listing the feed can serve, e.g. `7CD.F` (CD Projekt, Frankfurt). */
export type ChartSymbolSuggestion = {
  symbol: string
  name?: string
  exchange?: string
  type?: string
}

export type ChartErrorMessage = {
  type: 'error'
  id?: string
  message: string
  /** Offered when the requested symbol is unknown. */
  suggestions?: ChartSymbolSuggestion[]
}

export type ChartServerMessage =
  | ChartSnapshotMessage
  | ChartTickMessage
  | ChartErrorMessage

export type ChartSubscribeMessage = {
  type: 'subscribe'
  id: string
  symbol: string
  range: ChartRange
  live: boolean
}

export type ChartUnsubscribeMessage = { type: 'unsubscribe'; id: string }

function isPoint(value: unknown): value is ChartPoint {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1])
  )
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Validates one server message; returns null for anything malformed. */
export function parseChartServerMessage(
  raw: unknown,
): ChartServerMessage | null {
  let value = raw

  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }

  if (typeof value !== 'object' || value === null) {
    return null
  }

  const message = value as Record<string, unknown>
  const id = optionalString(message.id)

  if (message.type === 'snapshot') {
    if (
      typeof message.symbol !== 'string' ||
      !CHART_RANGES.includes(message.range as ChartRange) ||
      !Array.isArray(message.points)
    ) {
      return null
    }

    return {
      type: 'snapshot',
      ...(id ? { id } : {}),
      symbol: message.symbol,
      range: message.range as ChartRange,
      points: message.points
        .filter(isPoint)
        .map((point) => [point[0], point[1]] as ChartPoint)
        .sort((left, right) => left[0] - right[0]),
      currency: optionalString(message.currency),
      name: optionalString(message.name),
    }
  }

  if (message.type === 'tick') {
    if (typeof message.symbol !== 'string' || !isPoint(message.point)) {
      return null
    }

    return {
      type: 'tick',
      ...(id ? { id } : {}),
      symbol: message.symbol,
      point: [message.point[0], message.point[1]],
    }
  }

  if (message.type === 'error') {
    const suggestions = parseChartSymbolSuggestions(message.suggestions)

    return {
      type: 'error',
      ...(id ? { id } : {}),
      message: optionalString(message.message) ?? 'Feed error',
      ...(suggestions.length > 0 ? { suggestions } : {}),
    }
  }

  return null
}

export function parseChartSymbolSuggestions(
  value: unknown,
): ChartSymbolSuggestion[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return []
    }

    const candidate = entry as Record<string, unknown>

    if (typeof candidate.symbol !== 'string' || !candidate.symbol) {
      return []
    }

    return [
      {
        symbol: candidate.symbol,
        name: optionalString(candidate.name),
        exchange: optionalString(candidate.exchange),
        type: optionalString(candidate.type),
      },
    ]
  })
}

/** Appends a live tick; a tick with the same timestamp replaces the last. */
export function appendTick(points: ChartPoint[], point: ChartPoint) {
  const last = points[points.length - 1]

  if (!last || point[0] > last[0]) {
    return [...points, point]
  }

  if (point[0] === last[0]) {
    return [...points.slice(0, -1), point]
  }

  return points
}

export function buildSseUrl(
  url: string,
  input: { symbol: string; range: ChartRange; live: boolean },
) {
  const target = new URL(url)

  target.searchParams.set('symbol', input.symbol)
  target.searchParams.set('range', input.range)
  target.searchParams.set('live', input.live ? '1' : '0')

  return target.toString()
}
