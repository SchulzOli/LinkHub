import { describe, expect, it } from 'vitest'

import { classifyCandidateUrl } from '../../../../src/features/auto/classify'

describe('auto classification', () => {
  it.each([
    ['https://finance.yahoo.com/quote/AAPL/', 'AAPL'],
    ['https://finance.yahoo.com/quote/SAP.DE', 'SAP.DE'],
    ['https://www.google.com/finance/quote/MSFT:NASDAQ', 'MSFT'],
    ['https://www.google.com/finance/quote/SAP:ETR', 'SAP.DE'],
    ['https://www.tradingview.com/symbols/NASDAQ-NVDA/', 'NVDA'],
    ['https://www.tradingview.com/symbols/XETR-SIE/', 'SIE.DE'],
    ['https://www.marketwatch.com/investing/stock/tsla', 'TSLA'],
  ])('reads the chart symbol from %s', (url, symbol) => {
    expect(classifyCandidateUrl(url)).toEqual({ kind: 'chart', symbol })
  })

  it('ignores quote pages it cannot map safely', () => {
    expect(
      classifyCandidateUrl('https://www.google.com/finance/quote/7203:TYO'),
    ).toEqual({
      kind: 'link',
    })
    expect(
      classifyCandidateUrl('https://www.tradingview.com/symbols/BTCUSD/'),
    ).toEqual({
      kind: 'link',
    })
  })

  it.each([
    [
      'https://www.reddit.com/r/typescript/',
      'https://www.reddit.com/r/typescript/.rss',
    ],
    [
      'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',
      'https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw',
    ],
    [
      'https://github.com/vitejs/vite',
      'https://github.com/vitejs/vite/releases.atom',
    ],
    ['https://news.ycombinator.com/', 'https://news.ycombinator.com/rss'],
    ['https://www.heise.de/', 'https://www.heise.de/rss/heise-atom.xml'],
    ['https://medium.com/@someone', 'https://medium.com/feed/@someone'],
    ['https://example.substack.com/', 'https://example.substack.com/feed'],
    [
      'https://stackoverflow.com/questions/tagged/reactjs',
      'https://stackoverflow.com/feeds/tag?tagnames=reactjs',
    ],
  ])('finds the feed for %s', (url, feedUrl) => {
    const result = classifyCandidateUrl(url)

    expect(result.kind).toBe('feed')
    expect(result.kind === 'feed' && result.feedUrl).toBe(feedUrl)
  })

  it('keeps ordinary pages as links', () => {
    expect(classifyCandidateUrl('https://github.com/settings/profile')).toEqual(
      {
        kind: 'link',
      },
    )
    expect(classifyCandidateUrl('https://github.com/explore/x')).toEqual({
      kind: 'link',
    })
    expect(
      classifyCandidateUrl('https://www.heise.de/news/some-article.html'),
    ).toEqual({
      kind: 'link',
    })
    expect(classifyCandidateUrl('https://www.youtube.com/watch?v=abc')).toEqual(
      {
        kind: 'link',
      },
    )
  })
})
