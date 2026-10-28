import { describe, expect, it } from 'vitest'

import {
  defaultChartFeedUrl,
  defaultFeedProxyUrl,
  readHostServer,
} from '../../../../src/features/selfHost/hostServer'

function docWith(content: string | null) {
  const doc = document.implementation.createHTMLDocument('Linkhaven')

  if (content !== null) {
    const meta = doc.createElement('meta')

    meta.name = 'linkhaven-server'
    meta.content = content
    doc.head.append(meta)
  }

  return doc
}

describe('host server', () => {
  it('reads the services a self-hosted server announces', () => {
    const host = readHostServer(
      docWith('{"sync":true,"newsProxy":true,"charts":true}'),
      'https://links.example.com',
    )

    expect(host).toEqual({
      origin: 'https://links.example.com',
      sync: true,
      newsProxy: true,
      charts: true,
    })
    expect(defaultFeedProxyUrl(host)).toBe('https://links.example.com/rss')
    expect(defaultChartFeedUrl(host)).toBe('wss://links.example.com/feed')
  })

  it('falls back to the local defaults elsewhere', () => {
    expect(
      readHostServer(docWith(null), 'https://links.example.com'),
    ).toBeNull()
    expect(
      readHostServer(docWith('not json'), 'https://links.example.com'),
    ).toBeNull()
    // The extension's own pages are no host server.
    expect(
      readHostServer(docWith('{"sync":true}'), 'chrome-extension://abc'),
    ).toBeNull()
    expect(defaultFeedProxyUrl(null)).toBe('http://127.0.0.1:8788/rss')
    expect(
      defaultChartFeedUrl({
        origin: 'http://localhost:8790',
        sync: true,
        newsProxy: false,
        charts: true,
      }),
    ).toBe('ws://localhost:8790/feed')
  })
})
