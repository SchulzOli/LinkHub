import { describe, expect, it } from 'vitest'

import {
  appendTick,
  buildSseUrl,
  parseChartServerMessage,
} from '../../../../src/features/charts/chartFeedProtocol'
import {
  getRangeChange,
  pointsToCsv,
  simpleMovingAverage,
  toDisplayPoints,
} from '../../../../src/features/charts/chartSeries'

describe('chart feed protocol', () => {
  it('parses and sorts snapshots, dropping malformed points', () => {
    expect(
      parseChartServerMessage(
        JSON.stringify({
          type: 'snapshot',
          id: 's1',
          symbol: 'AAPL',
          range: '1Y',
          currency: 'USD',
          points: [
            [2000, 11],
            [1000, 10],
            [3000, null],
            ['x', 1],
          ],
        }),
      ),
    ).toEqual({
      type: 'snapshot',
      id: 's1',
      symbol: 'AAPL',
      range: '1Y',
      currency: 'USD',
      name: undefined,
      points: [
        [1000, 10],
        [2000, 11],
      ],
    })
  })

  it('parses ticks and errors and rejects unknown input', () => {
    expect(
      parseChartServerMessage({
        type: 'tick',
        symbol: 'AAPL',
        point: [5, 1.5],
      }),
    ).toEqual({ type: 'tick', symbol: 'AAPL', point: [5, 1.5] })
    expect(parseChartServerMessage({ type: 'error' })).toEqual({
      type: 'error',
      message: 'Feed error',
    })
    expect(parseChartServerMessage('not json')).toBeNull()
    expect(
      parseChartServerMessage({
        type: 'snapshot',
        symbol: 'A',
        range: '2Y',
        points: [],
      }),
    ).toBeNull()
    expect(
      parseChartServerMessage({ type: 'tick', symbol: 'A', point: [1] }),
    ).toBeNull()
  })

  it('appends newer ticks, replaces same-time ticks and ignores old ones', () => {
    const points: [number, number][] = [
      [1, 10],
      [2, 11],
    ]

    expect(appendTick(points, [3, 12])).toEqual([...points, [3, 12]])
    expect(appendTick(points, [2, 15])).toEqual([
      [1, 10],
      [2, 15],
    ])
    expect(appendTick(points, [1, 99])).toBe(points)
  })

  it('builds SSE request URLs', () => {
    expect(
      buildSseUrl('http://127.0.0.1:8787/sse?token=x', {
        symbol: 'SAP.DE',
        range: 'MAX',
        live: false,
      }),
    ).toBe('http://127.0.0.1:8787/sse?token=x&symbol=SAP.DE&range=MAX&live=0')
  })
})

describe('chart series helpers', () => {
  const points: [number, number][] = [
    [1, 100],
    [2, 110],
    [3, 90],
    [4, 120],
  ]

  it('converts to % change against the first point', () => {
    expect(
      toDisplayPoints(points, 'percent').map(([, value]) => Math.round(value)),
    ).toEqual([0, 10, -10, 20])
    expect(toDisplayPoints(points, 'price')).toBe(points)
  })

  it('computes a simple moving average', () => {
    expect(simpleMovingAverage(points, 2)).toEqual([
      [1, null],
      [2, 105],
      [3, 100],
      [4, 105],
    ])
  })

  it('summarises the range change and exports CSV', () => {
    const change = getRangeChange(points)

    expect(change).toMatchObject({ last: 120, absolute: 20 })
    expect(change?.percent).toBeCloseTo(20)
    expect(getRangeChange([])).toBeNull()
    expect(pointsToCsv([[0, 1.5]], 'AAPL')).toBe(
      'time,AAPL\n1970-01-01T00:00:00.000Z,1.5',
    )
  })
})
