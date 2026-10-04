import { describe, expect, it } from 'vitest'

// @ts-expect-error -- plain ESM server module without type declarations
import {
  buildYahooUrl,
  isValidSymbol,
  parseYahooChart,
} from '../../../server/chart-feed/yahooSource.mjs'

describe('chart feed server: Yahoo source', () => {
  it('maps ranges to Yahoo queries (3Y via periods)', () => {
    const now = 1_790_000_000
    const threeYears = buildYahooUrl('AAPL', '3Y', now)

    expect(threeYears.searchParams.get('interval')).toBe('1wk')
    expect(threeYears.searchParams.get('period2')).toBe(String(now))
    expect(Number(threeYears.searchParams.get('period1'))).toBe(
      now - Math.round(3 * 365.25 * 86400),
    )
    expect(buildYahooUrl('SAP.DE', 'MAX').toString()).toContain(
      '/v8/finance/chart/SAP.DE?interval=1mo&includePrePost=false&range=max',
    )
    expect(() => buildYahooUrl('AAPL', '2Y')).toThrow('Unsupported range')
  })

  it('validates symbols', () => {
    expect(isValidSymbol('^GDAXI')).toBe(true)
    expect(isValidSymbol('BRK-B')).toBe(true)
    expect(isValidSymbol('a b')).toBe(false)
    expect(isValidSymbol('')).toBe(false)
  })

  it('parses closes, skips gaps and exposes the latest price', () => {
    expect(
      parseYahooChart({
        chart: {
          error: null,
          result: [
            {
              meta: {
                currency: 'EUR',
                longName: 'SAP SE',
                regularMarketPrice: 184,
                regularMarketTime: 30,
              },
              timestamp: [10, 20, 25],
              indicators: { quote: [{ close: [180, null, 182.5] }] },
            },
          ],
        },
      }),
    ).toEqual({
      points: [
        [10000, 180],
        [25000, 182.5],
      ],
      currency: 'EUR',
      name: 'SAP SE',
      latest: [30000, 184],
    })
  })

  it('surfaces upstream errors', () => {
    expect(() =>
      parseYahooChart({
        chart: { result: null, error: { description: 'No data found' } },
      }),
    ).toThrow('No data found')
  })
})
