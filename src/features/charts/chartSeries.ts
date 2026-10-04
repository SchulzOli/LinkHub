import type {
  ChartOverlay,
  ChartSettings,
  ChartValueMode,
} from '../../contracts/chartNode'

import type { ChartPoint } from './chartFeedProtocol'

/** Converts prices to % change against the first point of the range. */
export function toDisplayPoints(
  points: ChartPoint[],
  valueMode: ChartValueMode,
): ChartPoint[] {
  if (valueMode === 'price' || points.length === 0) {
    return points
  }

  const base = points[0][1]

  if (base === 0) {
    return points.map(([time]) => [time, 0])
  }

  return points.map(([time, value]) => [time, (value / base - 1) * 100])
}

export const OVERLAY_WINDOW: Record<Exclude<ChartOverlay, 'none'>, number> = {
  sma20: 20,
  sma50: 50,
  sma200: 200,
}

/** Simple moving average; the first `window - 1` points have no value. */
export function simpleMovingAverage(
  points: ChartPoint[],
  window: number,
): Array<[number, number | null]> {
  let sum = 0

  return points.map(([time, value], index) => {
    sum += value

    if (index >= window) {
      sum -= points[index - window][1]
    }

    return [time, index >= window - 1 ? sum / window : null]
  })
}

export function getRangeChange(points: ChartPoint[]) {
  if (points.length === 0) {
    return null
  }

  const first = points[0][1]
  const last = points[points.length - 1][1]

  return {
    last,
    absolute: last - first,
    percent: first === 0 ? 0 : (last / first - 1) * 100,
  }
}

export function pointsToCsv(points: ChartPoint[], symbol: string) {
  const rows = points.map(
    ([time, value]) => `${new Date(time).toISOString()},${value}`,
  )

  return [`time,${symbol}`, ...rows].join('\n')
}

export function formatChartValue(
  value: number,
  valueMode: ChartSettings['valueMode'],
  currency?: string,
) {
  if (valueMode === 'percent') {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: value >= 1000 ? 0 : 2,
      }).format(value)
    } catch {
      // Unknown currency code: fall through to a plain number.
    }
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
