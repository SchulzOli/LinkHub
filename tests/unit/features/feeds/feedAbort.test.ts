import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchFeedSource } from '../../../../src/features/feeds/feedClient'
import { useNetworkFeaturesStore } from '../../../../src/state/useNetworkFeaturesStore'

describe('feed loads when feeds are switched off', () => {
  const signals: AbortSignal[] = []

  beforeEach(() => {
    signals.length = 0
    window.localStorage.clear()
    useNetworkFeaturesStore.getState().setFeature('chartsAndFeeds', true)
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        signals.push(init.signal as AbortSignal)
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useNetworkFeaturesStore.getState().setFeature('chartsAndFeeds', false)
  })

  it('aborts the request in flight and starts no follow-up request', async () => {
    const pending = fetchFeedSource(
      { url: 'https://news.example/' },
      'http://127.0.0.1:8788/rss',
    )

    expect(fetch).toHaveBeenCalledTimes(1)

    useNetworkFeaturesStore.getState().setFeature('chartsAndFeeds', false)

    const result = await pending

    expect(signals[0].aborted).toBe(true)
    expect(result.status).toBe('error')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
