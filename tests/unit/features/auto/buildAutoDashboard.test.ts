import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_AUTO_DASHBOARD_SETTINGS,
  type AutoDashboardSettings,
} from '../../../../src/contracts/autoDashboard'
import { DEFAULT_CARD_SIZE } from '../../../../src/contracts/linkCard'
import { isChartNode, isFeedNode } from '../../../../src/contracts/pictureNode'
import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import type { AiPlan } from '../../../../src/features/auto/aiPlanner'
import type { BrowserVisit } from '../../../../src/features/auto/browserSignals'
import {
  buildAutoDashboard,
  collectLinkHubSignals,
  type AutoBuildDeps,
} from '../../../../src/features/auto/buildAutoDashboard'
import { getEntityPixelBounds } from '../../../../src/features/groups/groupUtils'

const NOW = new Date(2026, 9, 24, 15).getTime()
const DAY = 24 * 3600 * 1000
const GRID = 24

function visit(
  url: string,
  visitCount: number,
  daysAgo = 0,
  title = '',
): BrowserVisit {
  return { url, title, visitCount, lastVisitTime: NOW - daysAgo * DAY }
}

function settings(
  overrides: Partial<AutoDashboardSettings> = {},
): AutoDashboardSettings {
  return {
    ...DEFAULT_AUTO_DASHBOARD_SETTINGS,
    enabled: true,
    sources: { linkhub: false, topSites: false, history: true },
    ...overrides,
  }
}

function deps(overrides: Partial<AutoBuildDeps> = {}): AutoBuildDeps {
  return {
    readHistory: async () => [
      visit('https://mail.example/inbox', 50, 0, 'Inbox'),
      visit('https://docs.example/', 20, 5, 'Docs'),
      visit('https://www.reddit.com/r/typescript/', 12, 1),
      visit('https://finance.yahoo.com/quote/AAPL/', 9, 1),
      visit('https://www.google.com/search?q=secret', 99, 0),
    ],
    readTopSites: async () => [],
    loadLinkHubWorkspaces: async () => [],
    requestAiPlan: vi.fn(),
    locale: 'de-DE',
    now: NOW,
    ...overrides,
  }
}

const layoutOptions = { cardSize: DEFAULT_CARD_SIZE, gridSize: GRID }

describe('buildAutoDashboard', () => {
  it('turns history into link groups, one feed and a chart', async () => {
    const result = await buildAutoDashboard(settings(), layoutOptions, deps())

    expect(result.counts).toEqual({ links: 2, feeds: 1, charts: 1 })
    expect(result.usedAi).toBe(false)
    expect(result.plan.linkGroups.map((group) => group.name)).toEqual([
      'Recently used',
      'Most used',
    ])
    expect(result.content.cards.map((card) => card.title)).toEqual([
      'Inbox',
      'Docs',
    ])
    // The search page is never a candidate.
    expect(result.candidateCount).toBe(4)

    const feed = result.content.pictures.find(isFeedNode)
    const chart = result.content.pictures.find(isChartNode)

    expect(feed?.sources.map((source) => source.url)).toEqual([
      'https://www.reddit.com/r/typescript/.rss',
    ])
    expect(chart?.source.symbol).toBe('AAPL')
  })

  it('places every card inside its own group body', async () => {
    const result = await buildAutoDashboard(settings(), layoutOptions, deps())
    const groupsById = new Map(
      result.content.groups.map((group) => [group.id, group]),
    )

    for (const card of result.content.cards) {
      const group = card.groupId ? groupsById.get(card.groupId) : undefined

      expect(group).toBeDefined()

      if (!group) {
        continue
      }

      const bounds = getEntityPixelBounds(card, GRID)
      const groupBounds = getEntityPixelBounds(group, GRID)

      expect(bounds.left).toBeGreaterThanOrEqual(groupBounds.left)
      expect(bounds.right).toBeLessThanOrEqual(groupBounds.right)
      expect(bounds.top).toBeGreaterThanOrEqual(groupBounds.top + GRID)
      expect(bounds.bottom).toBeLessThanOrEqual(groupBounds.bottom)
    }
  })

  it('keeps feed and chart pages as links when that content is off', async () => {
    const result = await buildAutoDashboard(
      settings({ content: { links: true, feeds: false, charts: false } }),
      layoutOptions,
      deps(),
    )

    expect(result.counts).toEqual({ links: 4, feeds: 0, charts: 0 })
    expect(result.content.pictures).toEqual([])
  })

  it('counts Linkhaven link opens inside the time window only', () => {
    const workspace = createDefaultWorkspace({
      cards: [
        {
          id: 'c1',
          url: 'https://tool.example/',
          title: 'Tool',
          faviconUrl: '',
          positionX: 0,
          positionY: 0,
          size: DEFAULT_CARD_SIZE,
          createdAt: '',
          updatedAt: '',
        },
      ],
      analytics: {
        dailyBuckets: {
          '2026-10-23': {
            canvasOpens: 0,
            linkOpens: 3,
            linkOpensByCardId: { c1: 3 },
          },
          '2026-01-01': {
            canvasOpens: 0,
            linkOpens: 9,
            linkOpensByCardId: { c1: 9 },
          },
        },
        totals: {
          canvasOpens: 0,
          linkOpens: 12,
          linkOpensByCardId: { c1: 12 },
        },
      },
    })

    const signals = collectLinkHubSignals([workspace], 30, NOW)

    expect(signals).toHaveLength(1)
    expect(signals[0]).toMatchObject({
      url: 'https://tool.example/',
      count: 3,
      source: 'linkhub',
    })
  })

  it('uses the AI grouping and titles, but only for known items', async () => {
    const requestAiPlan = vi.fn(
      async (): Promise<AiPlan> => ({
        groups: [
          { name: 'Arbeit', item_ids: ['p1', 'p2', 'p999'] },
          { name: '   ', item_ids: [] },
        ],
        titles: [{ item_id: 'p2', title: '  Team   Docs  ' }],
        leave_out: [],
        charts: [],
      }),
    )
    const result = await buildAutoDashboard(
      settings({
        ai: { enabled: true, apiKey: 'sk-test', model: 'claude-opus-5-5' },
      }),
      layoutOptions,
      deps({ requestAiPlan }),
    )

    expect(requestAiPlan).toHaveBeenCalledOnce()
    expect(requestAiPlan.mock.calls[0][0]).toMatchObject({
      apiKey: 'sk-test',
      model: 'claude-opus-5-5',
    })
    expect(result.usedAi).toBe(true)
    expect(result.plan.linkGroups).toEqual([
      {
        name: 'Arbeit',
        links: [
          {
            id: 'mail.example/inbox',
            url: 'https://mail.example/inbox',
            title: 'Inbox',
          },
          {
            id: 'docs.example/',
            url: 'https://docs.example/',
            title: 'Team Docs',
          },
        ],
      },
    ])
  })

  it('lets the AI drop one-off pages and add chart symbols, never pinned pages', async () => {
    const result = await buildAutoDashboard(
      settings({
        pinnedUrls: ['https://pinned.example/'],
        ai: { enabled: true, apiKey: 'sk-test', model: 'claude-haiku-5-5' },
      }),
      layoutOptions,
      deps({
        readHistory: async () => [
          visit('https://mail.example/inbox', 50, 0, 'Inbox'),
          visit('https://stocks.example/quote/msft', 8, 0, 'Microsoft stock'),
          visit('https://shop.example/checkout/done', 1, 0, 'Thanks'),
        ],
        requestAiPlan: async () => ({
          groups: [{ name: 'Daily', item_ids: ['p1', 'p2', 'p3', 'p4'] }],
          titles: [],
          leave_out: ['p1', 'p4'],
          charts: [
            { item_id: 'p3', symbol: 'msft' },
            { item_id: 'p2', symbol: 'not a symbol!' },
          ],
        }),
      }),
    )

    const links = result.plan.linkGroups.flatMap((group) => group.links)

    expect(links.map((link) => link.id)).toEqual([
      'pinned.example/',
      'mail.example/inbox',
    ])
    expect(result.plan.charts.map((chart) => chart.symbol)).toEqual(['MSFT'])
  })

  it('falls back to the rules when the AI step fails', async () => {
    const result = await buildAutoDashboard(
      settings({
        ai: { enabled: true, apiKey: 'sk-test', model: 'claude-opus-5-5' },
      }),
      layoutOptions,
      deps({
        requestAiPlan: async () => {
          throw new Error('network down')
        },
      }),
    )

    expect(result.usedAi).toBe(false)
    expect(result.counts.links).toBe(2)
    expect(result.warnings).toEqual([
      'The AI step failed. Used the rules only.',
    ])
  })

  it('does not call the AI without a key', async () => {
    const requestAiPlan = vi.fn()
    const result = await buildAutoDashboard(
      settings({ ai: { enabled: true, apiKey: '', model: 'claude-opus-5-5' } }),
      layoutOptions,
      deps({ requestAiPlan }),
    )

    expect(requestAiPlan).not.toHaveBeenCalled()
    expect(result.warnings).toHaveLength(1)
  })
})
