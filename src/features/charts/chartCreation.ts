import {
  DEFAULT_CHART_SIZE,
  type ChartNode,
  type ChartSource,
} from '../../contracts/chartNode'
import { createId } from '../../utils/id'
import { defaultChartFeedUrl } from '../selfHost/hostServer'

/** Symbol a new chart starts with; change it in the chart's options. */
export const DEFAULT_CHART_SYMBOL = 'AAPL'

export function createChartNode(input: {
  position: { x: number; y: number }
  source?: Partial<ChartSource>
}): ChartNode {
  const now = new Date().toISOString()

  return {
    id: createId(),
    type: 'chart',
    source: {
      url: input.source?.url ?? defaultChartFeedUrl(),
      symbol: input.source?.symbol ?? DEFAULT_CHART_SYMBOL,
    },
    // Empty: a new chart follows its group (or the defaults) for everything.
    settings: {},
    positionX: input.position.x,
    positionY: input.position.y,
    size: DEFAULT_CHART_SIZE,
    createdAt: now,
    updatedAt: now,
  }
}
