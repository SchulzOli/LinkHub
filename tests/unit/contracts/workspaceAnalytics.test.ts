import { describe, expect, it } from 'vitest'

import {
  coerceWorkspaceAnalytics,
  createDefaultWorkspaceAnalytics,
} from '../../../src/contracts/workspaceAnalytics'

describe('createDefaultWorkspaceAnalytics', () => {
  it('returns empty buckets and zeroed totals', () => {
    const analytics = createDefaultWorkspaceAnalytics()

    expect(analytics.dailyBuckets).toEqual({})
    expect(analytics.totals).toEqual({
      canvasOpens: 0,
      linkOpens: 0,
      linkOpensByCardId: {},
    })
  })
})

describe('coerceWorkspaceAnalytics', () => {
  it('returns a valid payload unchanged', () => {
    const input = {
      dailyBuckets: {
        '2026-04-01': {
          canvasOpens: 3,
          linkOpens: 2,
          linkOpensByCardId: { 'card-1': 2 },
        },
      },
      totals: {
        canvasOpens: 3,
        linkOpens: 2,
        linkOpensByCardId: { 'card-1': 2 },
      },
    }

    expect(coerceWorkspaceAnalytics(input)).toEqual(input)
  })

  it('returns defaults for non-object input', () => {
    expect(coerceWorkspaceAnalytics(null)).toEqual(
      createDefaultWorkspaceAnalytics(),
    )
    expect(coerceWorkspaceAnalytics('nope')).toEqual(
      createDefaultWorkspaceAnalytics(),
    )
  })

  it('sanitises negative and non-finite counters', () => {
    const result = coerceWorkspaceAnalytics({
      dailyBuckets: {
        '2026-04-01': {
          canvasOpens: -5,
          linkOpens: Number.POSITIVE_INFINITY,
          linkOpensByCardId: { 'card-1': -2, 'card-2': 3.7 },
        },
      },
      totals: {
        canvasOpens: -10,
        linkOpens: Number.NaN,
        linkOpensByCardId: { 'card-1': -1, 'card-2': 4.2 },
      },
    })

    expect(result.dailyBuckets['2026-04-01']).toEqual({
      canvasOpens: 0,
      linkOpens: 0,
      linkOpensByCardId: { 'card-2': 3 },
    })
    expect(result.totals).toEqual({
      canvasOpens: 0,
      linkOpens: 0,
      linkOpensByCardId: { 'card-2': 4 },
    })
  })

  it('fills in missing bucket fields', () => {
    const result = coerceWorkspaceAnalytics({
      dailyBuckets: { '2026-04-02': null },
      totals: {},
    })

    expect(result.dailyBuckets['2026-04-02']).toEqual({
      canvasOpens: 0,
      linkOpens: 0,
      linkOpensByCardId: {},
    })
    expect(result.totals).toEqual({
      canvasOpens: 0,
      linkOpens: 0,
      linkOpensByCardId: {},
    })
  })
})
