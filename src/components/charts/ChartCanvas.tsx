import {
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  LogarithmicScale,
  PointElement,
  Tooltip,
  type ChartDataset,
  type ChartOptions,
} from 'chart.js'
import { useEffect, useMemo, useRef } from 'react'

import type { ChartRange, ChartSettings } from '../../contracts/chartNode'
import { useResolvedCssValue } from '../../engine'
import { withAlpha } from '../../features/appearance/colorMath'
import type { ChartPoint } from '../../features/charts/chartFeedProtocol'
import {
  formatChartValue,
  OVERLAY_WINDOW,
  simpleMovingAverage,
  toDisplayPoints,
} from '../../features/charts/chartSeries'

Chart.register(
  CategoryScale,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  LogarithmicScale,
  PointElement,
  Tooltip,
)

type XY = { x: number; y: number | null }

const INTRADAY_RANGES = new Set<ChartRange>(['1D', '5D'])

function formatTime(value: number, range: ChartRange) {
  const date = new Date(value)

  if (range === '1D') {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (INTRADAY_RANGES.has(range) || range === '1M') {
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    })
  }

  if (range === '6M' || range === 'YTD' || range === '1Y') {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      year: '2-digit',
    })
  }

  return date.toLocaleDateString(undefined, { year: 'numeric' })
}

type ChartCanvasProps = {
  points: ChartPoint[]
  settings: ChartSettings
  currency?: string
}

/** Chart.js line/area chart; updates in place without animation. */
export default function ChartCanvas({
  points,
  settings,
  currency,
}: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart<'line', XY[]> | null>(null)
  const accent = useResolvedCssValue('var(--accent)')
  const muted = useResolvedCssValue('var(--text-muted)')
  const grid = useResolvedCssValue('var(--panel-border)')
  const font = useResolvedCssValue('var(--ui-font)')

  const displayPoints = useMemo(
    () => toDisplayPoints(points, settings.valueMode),
    [points, settings.valueMode],
  )
  // Log scale cannot show zero/negative % values; fall back to linear there.
  const useLog = settings.scale === 'log' && settings.valueMode === 'price'

  const datasets = useMemo(() => {
    const main: ChartDataset<'line', XY[]> = {
      label: 'value',
      data: displayPoints.map(([x, y]) => ({ x, y })),
      borderColor: accent,
      borderWidth: 1.75,
      pointRadius: 0,
      pointHoverRadius: 3,
      tension: 0.2,
      fill: settings.chartStyle === 'area' ? 'origin' : false,
      backgroundColor: (context) => {
        const { chart } = context
        const area = chart.chartArea

        if (!area) {
          return 'transparent'
        }

        const gradient = chart.ctx.createLinearGradient(
          0,
          area.top,
          0,
          area.bottom,
        )

        gradient.addColorStop(0, withAlpha(accent, 0.26))
        gradient.addColorStop(1, withAlpha(accent, 0))

        return gradient
      },
    }
    const result: ChartDataset<'line', XY[]>[] = [main]

    if (settings.overlay !== 'none') {
      result.push({
        label: settings.overlay.toUpperCase(),
        data: simpleMovingAverage(
          displayPoints,
          OVERLAY_WINDOW[settings.overlay],
        ).map(([x, y]) => ({ x, y })),
        borderColor: muted,
        borderWidth: 1.25,
        borderDash: [4, 3],
        pointRadius: 0,
        tension: 0.2,
        fill: false,
        spanGaps: false,
      })
    }

    return result
  }, [accent, displayPoints, muted, settings.chartStyle, settings.overlay])

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      animation: false,
      maintainAspectRatio: false,
      responsive: true,
      parsing: false,
      normalized: true,
      interaction: { intersect: false, mode: 'index' },
      layout: { padding: { top: 4, right: 4, bottom: 0, left: 0 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: (items) =>
              items[0]
                ? new Date(items[0].parsed.x ?? 0).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    ...(INTRADAY_RANGES.has(settings.range)
                      ? { timeStyle: 'short' as const }
                      : {}),
                  })
                : '',
            label: (item) =>
              `${item.dataset.label === 'value' ? '' : `${item.dataset.label} `}${formatChartValue(item.parsed.y ?? 0, settings.valueMode, currency)}`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          bounds: 'data',
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: muted,
            font: { family: font, size: 10 },
            maxRotation: 0,
            autoSkipPadding: 18,
            maxTicksLimit: 5,
            callback: (value) => formatTime(Number(value), settings.range),
          },
        },
        y: {
          type: useLog ? 'logarithmic' : 'linear',
          position: 'right',
          grid: { color: grid, drawTicks: false },
          border: { display: false },
          ticks: {
            color: muted,
            font: { family: font, size: 10 },
            maxTicksLimit: 4,
            padding: 6,
            callback: (value) =>
              settings.valueMode === 'percent'
                ? `${Number(value).toFixed(0)}%`
                : Number(value).toLocaleString(undefined, {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }),
          },
        },
      },
    }),
    [currency, font, grid, muted, settings.range, settings.valueMode, useLog],
  )

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const chart = new Chart<'line', XY[]>(canvas, {
      type: 'line',
      data: { datasets: [] },
      options: {},
    })

    chartRef.current = chart

    return () => {
      chart.destroy()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current

    if (!chart) {
      return
    }

    chart.data.datasets = datasets
    chart.options = options
    chart.update('none')
  }, [datasets, options])

  return <canvas ref={canvasRef} data-testid="chart-canvas" />
}
