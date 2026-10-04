import { useEffect, useMemo, useState } from 'react'

import type { FeedSource } from '../../contracts/feedNode'

import { fetchFeedSource, type FeedSourceResult } from './feedClient'
import { mergeFeedItems } from './feedItems'
import type { FeedItem } from './feedParser'

export type FeedState = {
  loading: boolean
  items: FeedItem[]
  /** One result per source URL (ok or error). */
  results: Record<string, FeedSourceResult>
  updatedAt?: number
}

const EMPTY_RESULTS: Record<string, FeedSourceResult> = {}

type KeyedResults = {
  key: string
  results: Record<string, FeedSourceResult>
  pending: number
}

/**
 * Loads every source of a feed node, merges the items and refreshes every
 * `refreshMinutes` (0 = manual). `reloadToken` changes force a fresh fetch.
 */
export function useFeedItems(input: {
  sources: FeedSource[]
  proxyUrl: string
  refreshMinutes: number
  reloadToken: number
}): FeedState {
  const { sources, proxyUrl, refreshMinutes, reloadToken } = input
  const urls = useMemo(() => sources.map((source) => source.url), [sources])
  const key = `${proxyUrl}|${urls.join('\n')}`
  const [state, setState] = useState<KeyedResults>({
    key: '',
    results: {},
    pending: 0,
  })

  useEffect(() => {
    let active = true

    const load = (force: boolean) => {
      setState((previous) => ({
        key,
        results: previous.key === key ? previous.results : {},
        pending: urls.length,
      }))

      for (const url of urls) {
        void fetchFeedSource({ url }, proxyUrl, { force }).then((result) => {
          if (!active) {
            return
          }

          setState((previous) =>
            previous.key !== key
              ? previous
              : {
                  key,
                  results: { ...previous.results, [url]: result },
                  pending: Math.max(0, previous.pending - 1),
                },
          )
        })
      }
    }

    // A reload token > 0 means the user asked for fresh data; otherwise
    // nodes showing the same feed share the cached response.
    const frame = requestAnimationFrame(() => load(reloadToken > 0))
    const timer =
      refreshMinutes > 0
        ? setInterval(() => load(true), refreshMinutes * 60 * 1000)
        : undefined

    return () => {
      active = false
      cancelAnimationFrame(frame)
      clearInterval(timer)
    }
  }, [key, proxyUrl, refreshMinutes, reloadToken, urls])

  const results = state.key === key ? state.results : EMPTY_RESULTS
  const items = useMemo(
    () =>
      mergeFeedItems(
        urls.flatMap((url) => {
          const result = results[url]

          return result?.status === 'ok' ? [result.feed.items] : []
        }),
      ),
    [results, urls],
  )
  const fetchedTimes = Object.values(results).map((result) => result.fetchedAt)

  return {
    loading: state.key !== key || state.pending > 0,
    items,
    results,
    ...(fetchedTimes.length ? { updatedAt: Math.max(...fetchedTimes) } : {}),
  }
}
