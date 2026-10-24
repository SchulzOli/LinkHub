import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CHARTS_AND_FEEDS_OFF_MESSAGE,
  coerceNetworkFeatures,
  DEFAULT_NETWORK_FEATURES,
} from '../../../src/contracts/networkFeatures'
import { subscribeChartFeed } from '../../../src/features/charts/chartFeedClient'
import { useChartFeed } from '../../../src/features/charts/useChartFeed'
import { fetchFeedSource } from '../../../src/features/feeds/feedClient'
import { useFeedItems } from '../../../src/features/feeds/useFeedItems'
import {
  NETWORK_FEATURES_STORAGE_KEY,
  onNetworkFeatureDisabled,
  resolveFaviconsOfflineOnly,
  useNetworkFeaturesStore,
} from '../../../src/state/useNetworkFeaturesStore'

vi.mock('../../../src/features/charts/chartFeedClient', () => ({
  subscribeChartFeed: vi.fn(() => () => {}),
}))

vi.mock('../../../src/features/feeds/feedClient', () => ({
  fetchFeedSource: vi.fn(),
}))

describe('network features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    useNetworkFeaturesStore.setState(DEFAULT_NETWORK_FEATURES)
  })

  it('keeps every network feature off by default', () => {
    expect(DEFAULT_NETWORK_FEATURES).toEqual({
      googleFavicons: false,
      chartsAndFeeds: false,
      linkCheck: false,
    })
    expect(coerceNetworkFeatures(null)).toEqual(DEFAULT_NETWORK_FEATURES)
    expect(
      coerceNetworkFeatures({ linkCheck: true, googleFavicons: 'yes' }),
    ).toEqual({ googleFavicons: false, chartsAndFeeds: false, linkCheck: true })
  })

  it('persists a switch to localStorage', () => {
    useNetworkFeaturesStore.getState().setFeature('chartsAndFeeds', true)

    expect(
      JSON.parse(
        window.localStorage.getItem(NETWORK_FEATURES_STORAGE_KEY) ?? '{}',
      ),
    ).toEqual({ googleFavicons: false, chartsAndFeeds: true, linkCheck: false })
  })

  it('follows a change made in another tab and stops the turned-off work', () => {
    const stopCharts = vi.fn()
    const unregister = onNetworkFeatureDisabled('chartsAndFeeds', stopCharts)

    useNetworkFeaturesStore.getState().setFeature('chartsAndFeeds', true)

    // Another tab switches charts off.
    window.localStorage.setItem(
      NETWORK_FEATURES_STORAGE_KEY,
      JSON.stringify({ chartsAndFeeds: false, linkCheck: true }),
    )
    window.dispatchEvent(
      new StorageEvent('storage', { key: NETWORK_FEATURES_STORAGE_KEY }),
    )

    expect(useNetworkFeaturesStore.getState()).toMatchObject({
      chartsAndFeeds: false,
      linkCheck: true,
    })
    expect(stopCharts).toHaveBeenCalledOnce()
    unregister()
  })

  it('never writes back a stale value for another switch', () => {
    useNetworkFeaturesStore.getState().setFeature('chartsAndFeeds', true)
    // Another tab turned charts off, but this tab missed the event.
    window.localStorage.setItem(
      NETWORK_FEATURES_STORAGE_KEY,
      JSON.stringify({ chartsAndFeeds: false }),
    )

    useNetworkFeaturesStore.getState().setFeature('linkCheck', true)

    expect(
      JSON.parse(
        window.localStorage.getItem(NETWORK_FEATURES_STORAGE_KEY) ?? '{}',
      ),
    ).toEqual({ googleFavicons: false, chartsAndFeeds: false, linkCheck: true })
    expect(useNetworkFeaturesStore.getState().chartsAndFeeds).toBe(false)
  })

  it('keeps an opt-out that could not be saved', () => {
    useNetworkFeaturesStore.getState().setFeature('chartsAndFeeds', true)

    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })

    // Storage still says "on"; this tab switches off but can't save it.
    useNetworkFeaturesStore.getState().setFeature('chartsAndFeeds', false)
    useNetworkFeaturesStore.getState().setFeature('linkCheck', true)

    expect(useNetworkFeaturesStore.getState()).toMatchObject({
      chartsAndFeeds: false,
      linkCheck: true,
    })

    // A change from another tab can't turn the unsaved opt-out back on
    // (an unsaved opt-in may be lost: that is the safe direction).
    window.dispatchEvent(
      new StorageEvent('storage', { key: NETWORK_FEATURES_STORAGE_KEY }),
    )

    expect(useNetworkFeaturesStore.getState().chartsAndFeeds).toBe(false)

    setItem.mockRestore()
  })

  it('never allows Google favicons while the switch is off', () => {
    expect(resolveFaviconsOfflineOnly(false)).toBe(true)

    useNetworkFeaturesStore.getState().setFeature('googleFavicons', true)

    expect(resolveFaviconsOfflineOnly(false)).toBe(false)
    // The workspace's own offline-only option still wins.
    expect(resolveFaviconsOfflineOnly(true)).toBe(true)
  })

  it('does not connect a chart while charts are off', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useChartFeed({
          url: 'ws://127.0.0.1:8787/feed',
          symbol: 'AAPL',
          range: '1M',
          live: true,
          reloadToken: 0,
          enabled,
        }),
      { initialProps: { enabled: false } },
    )

    expect(subscribeChartFeed).not.toHaveBeenCalled()
    expect(result.current).toMatchObject({
      status: 'closed',
      error: CHARTS_AND_FEEDS_OFF_MESSAGE,
    })

    rerender({ enabled: true })

    expect(subscribeChartFeed).toHaveBeenCalledOnce()
  })

  it('does not fetch a feed while feeds are off', async () => {
    const sources = [{ url: 'https://example.com/feed.xml' }]
    const { result } = renderHook(() =>
      useFeedItems({
        sources,
        proxyUrl: 'http://127.0.0.1:8788/rss',
        refreshMinutes: 15,
        reloadToken: 0,
        enabled: false,
      }),
    )

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(fetchFeedSource).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(
      result.current.results['https://example.com/feed.xml'],
    ).toMatchObject({ status: 'error', message: CHARTS_AND_FEEDS_OFF_MESSAGE })
  })
})
