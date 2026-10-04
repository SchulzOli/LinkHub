import type { ChartSettingKey, ChartSettings } from '../../contracts/chartNode'

export type Option<T extends string> = { value: T; label: string }

export const SETTING_ROWS: {
  [K in Exclude<ChartSettingKey, 'range' | 'live'>]: {
    label: string
    options: Option<ChartSettings[K]>[]
  }
} = {
  valueMode: {
    label: 'Values',
    options: [
      { value: 'price', label: 'Price' },
      { value: 'percent', label: '% change' },
    ],
  },
  chartStyle: {
    label: 'Style',
    options: [
      { value: 'area', label: 'Area' },
      { value: 'line', label: 'Line' },
    ],
  },
  overlay: {
    label: 'Average',
    options: [
      { value: 'none', label: 'Off' },
      { value: 'sma20', label: 'SMA 20' },
      { value: 'sma50', label: 'SMA 50' },
      { value: 'sma200', label: 'SMA 200' },
    ],
  },
  scale: {
    label: 'Scale',
    options: [
      { value: 'linear', label: 'Linear' },
      { value: 'log', label: 'Log' },
    ],
  },
}

export const CHART_SETTING_LABELS: Record<ChartSettingKey, string> = {
  range: 'Range',
  valueMode: SETTING_ROWS.valueMode.label,
  chartStyle: SETTING_ROWS.chartStyle.label,
  overlay: SETTING_ROWS.overlay.label,
  scale: SETTING_ROWS.scale.label,
  live: 'Live updates',
}

/** Stops canvas drag/pan from starting when interacting with a control. */
export function stopCanvasPointer(event: { stopPropagation: () => void }) {
  event.stopPropagation()
}
