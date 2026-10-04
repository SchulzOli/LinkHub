import { useEffect, useState } from 'react'

import type { ChartRange } from '../../contracts/chartNode'

import { subscribeChartFeed, type ChartFeedStatus } from './chartFeedClient'
import { appendTick, type ChartPoint } from './chartFeedProtocol'

export type ChartFeedState = {
  status: ChartFeedStatus
  points: ChartPoint[]
  currency?: string
  name?: string
  error?: string
  /** Time of the last snapshot/tick, for the "updated" hint. */
  updatedAt?: number
}

const INITIAL_STATE: ChartFeedState = { status: 'connecting', points: [] }

/**
 * Streams one chart series. Re-subscribes whenever the source, range, live
 * flag or `reloadToken` changes; the snapshot replaces the series, ticks
 * extend it.
 */
export function useChartFeed(input: {
  url: string
  symbol: string
  range: ChartRange
  live: boolean
  reloadToken: number
}): ChartFeedState {
  const { url, symbol, range, live, reloadToken } = input
  const [state, setState] = useState<ChartFeedState>(INITIAL_STATE)

  useEffect(() => {
    let active = true

    // The client reports 'connecting' through onStatus right away.
    const unsubscribe = subscribeChartFeed(
      { url, symbol, range, live },
      {
        onStatus: (status) => {
          if (active) {
            setState((previous) =>
              previous.status === status ? previous : { ...previous, status },
            )
          }
        },
        onMessage: (message) => {
          if (!active) {
            return
          }

          if (message.type === 'snapshot') {
            // Ignore late snapshots for a range we already left.
            if (message.range !== range) {
              return
            }

            setState((previous) => ({
              ...previous,
              points: message.points,
              currency: message.currency ?? previous.currency,
              name: message.name ?? previous.name,
              error: undefined,
              updatedAt: Date.now(),
            }))
            return
          }

          if (message.type === 'tick') {
            if (!live) {
              return
            }

            setState((previous) => ({
              ...previous,
              points: appendTick(previous.points, message.point),
              updatedAt: Date.now(),
            }))
            return
          }

          setState((previous) => ({ ...previous, error: message.message }))
        },
      },
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [url, symbol, range, live, reloadToken])

  return state
}
