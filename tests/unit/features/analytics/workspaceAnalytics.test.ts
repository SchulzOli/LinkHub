import { describe, expect, it } from 'vitest'

import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import {
  getWorkspaceStatisticsSnapshot,
  recordCanvasOpenInAnalytics,
  recordLinkOpenInAnalytics,
} from '../../../../src/features/analytics/workspaceAnalytics'

function repeat<T>(count: number, iteratee: (index: number) => T) {
  return Array.from({ length: count }, (_, index) => iteratee(index))
}

describe('workspaceAnalytics', () => {
  it('records link opens in totals and daily buckets', () => {
    const at = new Date(2026, 3, 3, 12, 0, 0)
    const analytics = recordLinkOpenInAnalytics(undefined, 'card-1', at)

    expect(analytics.totals.linkOpens).toBe(1)
    expect(analytics.totals.linkOpensByCardId).toEqual({
      'card-1': 1,
    })
    expect(analytics.dailyBuckets['2026-04-03']).toEqual({
      canvasOpens: 0,
      linkOpens: 1,
      linkOpensByCardId: {
        'card-1': 1,
      },
    })
  })

  it('aggregates calendar periods, timelines and per-card values', () => {
    const now = new Date(2026, 3, 16, 12, 0, 0)
    const workspace = createDefaultWorkspace({
      cards: [
        {
          id: 'card-1',
          url: 'https://one.example.com',
          title: 'One',
          faviconUrl: 'https://one.example.com/favicon.ico',
          positionX: 0,
          positionY: 0,
          size: { columns: 5, rows: 5 },
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
        {
          id: 'card-2',
          url: 'https://two.example.com',
          title: 'Two',
          faviconUrl: 'https://two.example.com/favicon.ico',
          positionX: 120,
          positionY: 0,
          size: { columns: 5, rows: 5 },
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
      groups: [
        {
          id: 'group-1',
          name: 'Group',
          positionX: 0,
          positionY: 0,
          size: { columns: 8, rows: 8 },
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
    })

    const analytics = [
      ...repeat(1, () => ({
        at: new Date(2026, 3, 16, 9, 0, 0),
        cardId: 'card-1',
      })),
      ...repeat(2, () => ({
        at: new Date(2026, 3, 14, 10, 0, 0),
        cardId: 'card-1',
      })),
      ...repeat(1, () => ({
        at: new Date(2026, 3, 14, 10, 0, 0),
        cardId: 'card-2',
      })),
      ...repeat(3, () => ({
        at: new Date(2026, 3, 2, 8, 0, 0),
        cardId: 'card-2',
      })),
      ...repeat(4, () => ({
        at: new Date(2026, 1, 10, 11, 0, 0),
        cardId: 'card-1',
      })),
      ...repeat(5, () => ({
        at: new Date(2025, 11, 31, 11, 0, 0),
        cardId: 'card-1',
      })),
    ].reduce(
      (current, event) =>
        recordLinkOpenInAnalytics(current, event.cardId, event.at),
      workspace.analytics,
    )

    const analyticsWithCanvas = [
      ...repeat(1, () => new Date(2026, 3, 16, 9, 0, 0)),
      ...repeat(2, () => new Date(2026, 3, 14, 9, 0, 0)),
      ...repeat(1, () => new Date(2026, 3, 2, 9, 0, 0)),
      ...repeat(4, () => new Date(2026, 1, 10, 9, 0, 0)),
      ...repeat(5, () => new Date(2025, 11, 31, 9, 0, 0)),
    ].reduce(
      (current, at) => recordCanvasOpenInAnalytics(current, at),
      analytics,
    )

    const snapshot = getWorkspaceStatisticsSnapshot(
      {
        analytics: analyticsWithCanvas,
        cards: workspace.cards,
        groups: workspace.groups,
      },
      now,
    )

    expect(snapshot.groupCount).toBe(1)
    expect(snapshot.linkOpens).toEqual({
      day: 1,
      month: 7,
      total: 16,
      week: 4,
      year: 11,
    })
    expect(snapshot.canvasOpens).toEqual({
      day: 1,
      month: 4,
      total: 13,
      week: 3,
      year: 8,
    })
    expect(snapshot.timelines['14d'].points).toHaveLength(14)
    expect(snapshot.timelines['14d'].points.at(-1)).toMatchObject({
      canvasOpens: 1,
      id: '2026-04-16',
      linkOpens: 1,
    })
    expect(snapshot.timelines['12w'].points).toHaveLength(12)
    expect(snapshot.timelines['12w'].points.at(-1)).toMatchObject({
      canvasOpens: 3,
      linkOpens: 4,
    })
    expect(snapshot.timelines['12m'].points).toHaveLength(12)
    expect(snapshot.timelines['12m'].points.at(-1)).toMatchObject({
      canvasOpens: 4,
      id: '2026-04',
      linkOpens: 7,
    })
    expect(snapshot.timelines.all.points).toHaveLength(5)
    expect(snapshot.timelines.all.points[0]).toMatchObject({
      canvasOpens: 5,
      id: '2025-12',
      linkOpens: 5,
    })
    expect(snapshot.cardRows[0]).toMatchObject({
      cardId: 'card-1',
      counts: {
        day: 1,
        month: 3,
        total: 12,
        week: 3,
        year: 7,
      },
    })
    expect(snapshot.cardRows[1]).toMatchObject({
      cardId: 'card-2',
      counts: {
        day: 0,
        month: 4,
        total: 4,
        week: 1,
        year: 4,
      },
    })
  })

  it('keeps the top 20 card rows synced with current titles and urls', () => {
    const now = new Date(2026, 3, 16, 12, 0, 0)
    const workspace = createDefaultWorkspace({
      cards: repeat(22, (index) => {
        const cardNumber = index + 1

        return {
          id: `card-${cardNumber}`,
          url: `https://current-${cardNumber}.example.com`,
          title: `Current ${cardNumber}`,
          faviconUrl: `https://current-${cardNumber}.example.com/favicon.ico`,
          positionX: cardNumber * 40,
          positionY: 0,
          size: { columns: 5, rows: 5 },
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        }
      }),
    })

    const analytics = workspace.cards.reduce(
      (currentAnalytics, card, index) => {
        let nextAnalytics = currentAnalytics

        for (let count = 0; count <= index; count += 1) {
          nextAnalytics = recordLinkOpenInAnalytics(nextAnalytics, card.id, now)
        }

        return nextAnalytics
      },
      workspace.analytics,
    )

    const renamedCards = workspace.cards.map((card) =>
      card.id === 'card-22'
        ? {
            ...card,
            title: 'Renamed 22',
            url: 'https://renamed-22.example.com',
          }
        : card,
    )

    const snapshot = getWorkspaceStatisticsSnapshot(
      {
        analytics,
        cards: renamedCards,
        groups: workspace.groups,
      },
      now,
    )

    expect(snapshot.cardRows).toHaveLength(20)
    expect(snapshot.cardRows[0]).toMatchObject({
      cardId: 'card-22',
      subtitle: 'https://renamed-22.example.com',
      title: 'Renamed 22',
    })
    expect(snapshot.cardRows.at(-1)).toMatchObject({
      cardId: 'card-3',
    })
    expect(snapshot.cardRows.some((row) => row.cardId === 'card-1')).toBe(false)
    expect(snapshot.cardRows.some((row) => row.cardId === 'card-2')).toBe(false)
  })
})
