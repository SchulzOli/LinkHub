import { describe, expect, it } from 'vitest'

import { coercePictureNode } from '../../../../src/contracts/pictureNode'
import { decodeFeedBody } from '../../../../src/features/feeds/feedClient'
import {
  filterFeedItems,
  formatRelativeTime,
  mergeFeedItems,
  sortFeedItems,
} from '../../../../src/features/feeds/feedItems'
import {
  decodeTitle,
  FeedParseError,
  parseFeed,
  type FeedItem,
} from '../../../../src/features/feeds/feedParser'

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Example News</title>
    <link>https://news.example/</link>
    <item>
      <title>First &amp; foremost</title>
      <link>https://news.example/a</link>
      <guid isPermaLink="false">a-1</guid>
      <pubDate>Sat, 03 Oct 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[<p>Hello <b>world</b></p><img src="/img/a.jpg"><script>x()</script>]]></description>
      <dc:creator>Jane Doe</dc:creator>
    </item>
    <item>
      <title>Second</title>
      <link>javascript:alert(1)</link>
      <pubDate>not a date</pubDate>
      <media:thumbnail url="https://cdn.example/b.png" />
    </item>
  </channel>
</rss>`

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">Atom Site</title>
  <link rel="self" href="https://atom.example/feed" />
  <link rel="alternate" href="https://atom.example/" />
  <entry>
    <id>urn:1</id>
    <title type="html">Entry &lt;one&gt;</title>
    <link rel="alternate" href="https://atom.example/1" />
    <updated>2026-10-02T08:00:00Z</updated>
    <summary>Short text</summary>
    <author><name>Max</name></author>
  </entry>
</feed>`

describe('feed parser', () => {
  it('parses RSS 2.0 items, strips HTML and drops unsafe links', () => {
    const feed = parseFeed(RSS, 'https://news.example/rss')

    expect(feed.title).toBe('Example News')
    expect(feed.siteUrl).toBe('https://news.example/')
    expect(feed.items).toHaveLength(2)
    expect(feed.items[0]).toMatchObject({
      id: 'a-1',
      title: 'First & foremost',
      link: 'https://news.example/a',
      published: Date.UTC(2026, 9, 3, 10),
      summary: 'Hello world',
      author: 'Jane Doe',
      imageUrl: 'https://news.example/img/a.jpg',
      sourceTitle: 'Example News',
      sourceUrl: 'https://news.example/rss',
    })
    expect(feed.items[1].link).toBeUndefined()
    expect(feed.items[1].published).toBeNull()
    expect(feed.items[1].imageUrl).toBe('https://cdn.example/b.png')
  })

  it('parses Atom entries with the alternate link', () => {
    const feed = parseFeed(ATOM, 'https://atom.example/feed')

    expect(feed.title).toBe('Atom Site')
    expect(feed.siteUrl).toBe('https://atom.example/')
    expect(feed.items[0]).toMatchObject({
      id: 'urn:1',
      title: 'Entry <one>',
      link: 'https://atom.example/1',
      published: Date.UTC(2026, 9, 2, 8),
      summary: 'Short text',
      author: 'Max',
    })
  })

  it('reports feeds linked from an HTML page', () => {
    const html = `<!DOCTYPE html><html><head>
      <link rel="alternate" type="application/rss+xml" href="/feed.xml">
      <link rel="alternate" type="application/atom+xml" href="https://x.example/atom">
    </head><body></body></html>`

    try {
      parseFeed(html, 'https://x.example/news')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(FeedParseError)
      expect((error as FeedParseError).alternates).toEqual([
        'https://x.example/feed.xml',
        'https://x.example/atom',
      ])
    }
  })

  it('decodes double-escaped entities in titles as text only', () => {
    expect(
      decodeTitle('Tom &amp; Jerry &#8211; &lt;b&gt; &bogus; M&uuml;nchen'),
    ).toBe('Tom & Jerry \u2013 <b> &bogus; M\u00fcnchen')
  })

  it('rejects invalid XML', () => {
    expect(() => parseFeed('<rss><channel>', 'https://x.example')).toThrow(
      FeedParseError,
    )
  })

  it('decodes ISO-8859-1 feeds using the XML declaration', () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode(
        '<?xml version="1.0" encoding="ISO-8859-1"?><rss><channel><title>M',
      ),
      0xfc,
      ...new TextEncoder().encode('nchen</title></channel></rss>'),
    ])

    expect(
      parseFeed(decodeFeedBody(bytes.buffer, 'text/xml'), 'https://x.example')
        .title,
    ).toBe('München')
  })
})

function item(partial: Partial<FeedItem> & { id: string }): FeedItem {
  return {
    title: partial.id,
    summary: '',
    published: null,
    sourceUrl: 'https://a.example/rss',
    sourceTitle: 'Alpha',
    ...partial,
  }
}

describe('feed items', () => {
  const now = Date.UTC(2026, 9, 4, 12)
  const items = [
    item({ id: 'old', title: 'Budget vote', published: now - 10 * 86400000 }),
    item({ id: 'new', title: 'Zebra crossing', published: now - 3600000 }),
    item({
      id: 'b',
      title: 'apple harvest',
      summary: 'Budget news',
      published: now - 2 * 86400000,
      sourceUrl: 'https://b.example/rss',
      sourceTitle: 'Beta',
    }),
    item({ id: 'undated', title: 'Misc' }),
  ]

  it('sorts newest/oldest with undated items last, by title and source', () => {
    expect(sortFeedItems(items, 'newest').map((entry) => entry.id)).toEqual([
      'new',
      'b',
      'old',
      'undated',
    ])
    expect(sortFeedItems(items, 'oldest').map((entry) => entry.id)).toEqual([
      'old',
      'b',
      'new',
      'undated',
    ])
    expect(sortFeedItems(items, 'title').map((entry) => entry.id)).toEqual([
      'b',
      'old',
      'undated',
      'new',
    ])
    expect(sortFeedItems(items, 'source').map((entry) => entry.id)).toEqual([
      'new',
      'old',
      'undated',
      'b',
    ])
  })

  it('filters by query words, hidden sources and time window', () => {
    const run = (
      query: string,
      settings: Partial<{ hiddenSources: string[]; timeWindow: '3d' | 'all' }>,
    ) =>
      filterFeedItems(items, {
        query,
        now,
        settings: { hiddenSources: [], timeWindow: 'all', ...settings },
      }).map((entry) => entry.id)

    expect(run('budget', {})).toEqual(['old', 'b'])
    expect(run('budget beta', {})).toEqual(['b'])
    expect(run('', { hiddenSources: ['https://b.example/rss'] })).toEqual([
      'old',
      'new',
      'undated',
    ])
    expect(run('', { timeWindow: '3d' })).toEqual(['new', 'b'])
  })

  it('merges sources and drops duplicate articles', () => {
    const shared = item({ id: 'x', link: 'https://same.example/1' })

    expect(
      mergeFeedItems([[shared], [{ ...shared, sourceTitle: 'Other' }]]),
    ).toHaveLength(1)
  })

  it('formats relative times', () => {
    expect(formatRelativeTime(now - 3 * 3600000, now)).toBe('3 hours ago')
    expect(formatRelativeTime(now - 86400000, now)).toBe('yesterday')
    expect(formatRelativeTime(now - 1000, now)).toBe('just now')
  })
})

describe('feed node contract', () => {
  const raw = {
    id: 'feed-1',
    type: 'feed',
    sources: [
      { url: 'https://news.example/rss' },
      { url: 'javascript:alert(1)' },
    ],
    proxyUrl: 'http://127.0.0.1:8788/rss',
    settings: { sort: 'title', timeWindow: 'bogus', showImages: false },
    positionX: 0,
    positionY: 0,
    size: { columns: 14, rows: 18 },
    createdAt: '2026-10-04T12:00:00.000Z',
    updatedAt: '2026-10-04T12:00:00.000Z',
  }

  it('keeps valid sources and settings, defaults the rest', () => {
    const node = coercePictureNode(raw)

    expect(node).toMatchObject({
      type: 'feed',
      sources: [{ url: 'https://news.example/rss' }],
      settings: {
        sort: 'title',
        timeWindow: 'all',
        showImages: false,
        showSummaries: true,
        refreshMinutes: 15,
        hiddenSources: [],
      },
    })
  })
})
