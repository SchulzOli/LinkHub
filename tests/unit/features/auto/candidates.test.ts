import { describe, expect, it } from 'vitest'

import {
  buildAutoCandidates,
  cleanCandidateUrl,
  getCandidateKey,
  getRecencyFactor,
  isExcludedUrl,
  type AutoSignal,
} from '../../../../src/features/auto/candidates'

const NOW = Date.UTC(2026, 9, 24, 12)
const DAY = 24 * 3600 * 1000

function signal(overrides: Partial<AutoSignal>): AutoSignal {
  return {
    url: 'https://example.com/',
    title: '',
    count: 1,
    lastVisitTime: NOW,
    source: 'history',
    ...overrides,
  }
}

function excluded(url: string, list: string[] = []) {
  const parsed = cleanCandidateUrl(url)

  if (!parsed) {
    throw new Error(`bad url ${url}`)
  }

  return isExcludedUrl(parsed, list)
}

describe('auto candidates', () => {
  it('merges www, trailing slashes and tracking parameters into one key', () => {
    const a = cleanCandidateUrl(
      'https://www.github.com/org/repo/?utm_source=x#readme',
    )
    const b = cleanCandidateUrl('http://github.com/org/repo')

    expect(a && getCandidateKey(a)).toBe('github.com/org/repo')
    expect(b && getCandidateKey(b)).toBe('github.com/org/repo')
  })

  it('rejects non-web URLs', () => {
    expect(cleanCandidateUrl('chrome://settings')).toBeNull()
    expect(cleanCandidateUrl('file:///tmp/x.html')).toBeNull()
    expect(cleanCandidateUrl('not a url')).toBeNull()
  })

  it('leaves out private, search, login and banking pages', () => {
    expect(excluded('http://localhost:5173/')).toBe(true)
    expect(excluded('http://192.168.1.1/admin')).toBe(true)
    expect(excluded('https://www.google.com/search?q=linkhub')).toBe(true)
    expect(excluded('https://duckduckgo.com/?q=linkhub')).toBe(true)
    expect(excluded('https://github.com/login')).toBe(true)
    expect(excluded('https://accounts.google.com/v3/signin')).toBe(true)
    expect(excluded('https://www.paypal.com/myaccount')).toBe(true)
    expect(excluded('https://duckduckgo.com/')).toBe(false)
    expect(excluded('https://github.com/anthropics')).toBe(false)
  })

  it('honours user exclusions by host and by URL prefix', () => {
    expect(excluded('https://mail.example.com/inbox', ['example.com'])).toBe(
      true,
    )
    expect(excluded('https://example.org/', ['example.com'])).toBe(false)
    expect(
      excluded('https://news.example.org/private/1', [
        'news.example.org/private',
      ]),
    ).toBe(true)
    expect(
      excluded('https://news.example.org/public', ['news.example.org/private']),
    ).toBe(false)
  })

  it('decays the score of pages not visited for a while', () => {
    expect(getRecencyFactor(NOW, NOW)).toBe(1)
    expect(getRecencyFactor(NOW - 14 * DAY, NOW)).toBeCloseTo(0.5)
    expect(getRecencyFactor(0, NOW)).toBe(0.5)
  })

  it('ranks by frequency and recency and merges sources', () => {
    const candidates = buildAutoCandidates({
      now: NOW,
      maxPerSite: 3,
      signals: [
        signal({
          url: 'https://old.example/',
          count: 40,
          lastVisitTime: NOW - 60 * DAY,
        }),
        signal({
          url: 'https://daily.example/',
          count: 10,
          lastVisitTime: NOW - DAY,
        }),
        signal({
          url: 'https://daily.example',
          title: 'Daily tool',
          count: 2,
          lastVisitTime: NOW,
          source: 'linkhub',
        }),
      ],
    })

    expect(candidates.map((candidate) => candidate.host)).toEqual([
      'daily.example',
      'old.example',
    ])
    expect(candidates[0].sources).toEqual(['history', 'linkhub'])
    expect(candidates[0].title).toBe('Daily tool')
    expect(candidates[0].visitCount).toBe(12)
  })

  it('caps pages per site but always keeps pinned pages first', () => {
    const candidates = buildAutoCandidates({
      now: NOW,
      maxPerSite: 1,
      pinnedUrls: ['rarely.example/start'],
      signals: [
        signal({ url: 'https://github.com/a/one', count: 9 }),
        signal({ url: 'https://github.com/a/two', count: 8 }),
      ],
    })

    expect(candidates.map((candidate) => candidate.id)).toEqual([
      'rarely.example/start',
      'github.com/a/one',
    ])
    expect(candidates[0].pinned).toBe(true)
  })

  it('keeps pinned pages even when their site is excluded', () => {
    const candidates = buildAutoCandidates({
      now: NOW,
      maxPerSite: 3,
      excludedSites: ['intranet.example'],
      pinnedUrls: ['https://intranet.example/wiki'],
      signals: [signal({ url: 'https://intranet.example/other', count: 50 })],
    })

    expect(candidates.map((candidate) => candidate.id)).toEqual([
      'intranet.example/wiki',
    ])
  })
})
