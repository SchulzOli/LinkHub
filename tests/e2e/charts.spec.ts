import { expect, test, type Locator, type Page } from '@playwright/test'

import { moveCardIntoGroupBody, moveElementToPoint } from './dragHelpers'
import { dismissVisibleEditPanels, openGroupEditor } from './fixtures'

const FEED_URL = 'ws://127.0.0.1:8787/feed'

type Subscribe = {
  type: 'subscribe'
  id: string
  symbol: string
  range: string
  live: boolean
}

/**
 * In-test feed server speaking the LinkHub chart feed protocol. Every
 * subscribe gets a small deterministic snapshot; `tick` pushes live points.
 */
async function mockChartFeed(page: Page) {
  const subscribes: Subscribe[] = []
  const unsubscribes: string[] = []
  let send: (message: object) => void = () => undefined

  await page.routeWebSocket(FEED_URL, (ws) => {
    send = (message) => ws.send(JSON.stringify(message))
    ws.onMessage((raw) => {
      const message = JSON.parse(String(raw))

      if (message.type === 'unsubscribe') {
        unsubscribes.push(message.id)
        return
      }

      if (message.type !== 'subscribe') {
        return
      }

      subscribes.push(message)
      send({
        type: 'snapshot',
        id: message.id,
        symbol: message.symbol,
        range: message.range,
        currency: 'USD',
        name: `${message.symbol} Inc.`,
        points: [
          [Date.UTC(2026, 0, 1), 100],
          [Date.UTC(2026, 3, 1), 104],
          [Date.UTC(2026, 6, 1), 102],
          [Date.UTC(2026, 9, 1), 110],
        ],
      })
    })
  })

  return {
    subscribes,
    unsubscribes,
    tick: (id: string, symbol: string, point: [number, number]) =>
      send({ type: 'tick', id, symbol, point }),
    lastFor: (symbol: string) =>
      subscribes.filter((entry) => entry.symbol === symbol).at(-1),
  }
}

function rangeButton(scope: Locator, label: string) {
  return scope
    .getByRole('radiogroup', { name: 'Time range' })
    .getByRole('radio', { name: label, exact: true })
}

async function setChartSymbol(page: Page, chart: Locator, symbol: string) {
  await chart.getByRole('button', { name: 'Chart options' }).click()

  const options = page.getByTestId('chart-options')

  await options.getByLabel('Chart symbol').fill(symbol)
  await options.getByRole('button', { name: 'Apply source' }).click()
  await page.keyboard.press('Escape')
  await expect(options).toHaveCount(0)
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
})

test('adds a chart, streams snapshot and ticks, and switches range', async ({
  page,
}) => {
  const feed = await mockChartFeed(page)

  await page.reload()
  await page.getByRole('button', { name: 'Add chart' }).click()

  const chart = page.getByTestId(/chart-node-/).first()

  await expect(chart.getByTestId('chart-canvas')).toBeVisible()
  await expect(chart.getByTestId('chart-price')).toHaveText('$110.00')
  await expect(chart.getByTestId('chart-change')).toHaveText('+10.00%')
  expect(feed.lastFor('AAPL')).toMatchObject({ range: '1Y', live: true })

  feed.tick(feed.lastFor('AAPL')!.id, 'AAPL', [Date.UTC(2026, 9, 2), 121])
  await expect(chart.getByTestId('chart-price')).toHaveText('$121.00')
  await expect(chart.getByTestId('chart-status')).toHaveAttribute(
    'data-status',
    'open',
  )

  const firstId = feed.lastFor('AAPL')!.id

  await rangeButton(chart, '5Y').click()
  await expect(rangeButton(chart, '5Y')).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => feed.lastFor('AAPL')?.range).toBe('5Y')
  expect(feed.unsubscribes).toContain(firstId)
})

test('a group drives its charts but keeps values set on a single chart', async ({
  page,
}) => {
  const feed = await mockChartFeed(page)

  await page.reload()
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)

  const editor = page.getByTestId('group-edit-panel')

  await editor.getByLabel(/Edit group width/).fill('27')
  await editor.getByLabel(/Edit group height/).fill('11')
  await editor.getByLabel(/Edit group name/).fill('Stocks')
  await page.keyboard.press('Enter')
  await dismissVisibleEditPanels(page)

  const body = page.getByTestId(/card-group-body-/).first()

  await page.getByRole('button', { name: 'Add chart' }).click()

  const chartA = page.getByTestId(/chart-node-/).nth(0)

  await moveCardIntoGroupBody(page, chartA, body, {
    targetInset: 10,
    settleMs: 150,
  })
  await page.getByRole('button', { name: 'Add chart' }).click()

  const chartB = page.getByTestId(/chart-node-/).nth(1)
  const bodyBox = (await body.boundingBox())!

  await moveElementToPoint(
    page,
    chartB,
    { x: bodyBox.x + bodyBox.width - 300, y: bodyBox.y + 10 },
    { settleMs: 150 },
  )
  await setChartSymbol(page, chartB, 'MSFT')

  // The group recognises both charts.
  const groupButton = page.getByTestId(/group-chart-controls-/)

  await expect(groupButton).toHaveText('2')

  // 1) Group change reaches every member.
  await groupButton.click()

  const panel = page.getByTestId('group-chart-panel')

  await rangeButton(panel, 'Max').click()
  await expect(rangeButton(chartA, 'Max')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(rangeButton(chartB, 'Max')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect.poll(() => feed.lastFor('AAPL')?.range).toBe('MAX')
  await expect.poll(() => feed.lastFor('MSFT')?.range).toBe('MAX')
  await page.keyboard.press('Escape')

  // 2) A change on one chart stays on that chart.
  await rangeButton(chartA, '1M').click()
  await expect(rangeButton(chartA, '1M')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(rangeButton(chartB, 'Max')).toHaveAttribute(
    'aria-checked',
    'true',
  )

  // 3) The group notices the override and does not apply over it.
  await groupButton.click()
  await expect(panel.getByTestId('group-chart-override-range')).toHaveText(
    '1 own · apply to all',
  )
  await rangeButton(panel, '3Y').click()
  await expect(rangeButton(chartB, '3Y')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(rangeButton(chartA, '1M')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect.poll(() => feed.lastFor('MSFT')?.range).toBe('3Y')
  expect(feed.lastFor('AAPL')?.range).toBe('1M')

  // 4) Explicitly applying to all includes the overridden chart.
  await panel.getByTestId('group-chart-override-range').click()
  await expect(rangeButton(chartA, '3Y')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(panel.getByTestId('group-chart-override-range')).toHaveCount(0)
  await expect.poll(() => feed.lastFor('AAPL')?.range).toBe('3Y')

  // Filters follow the same rules: group overlay reaches both charts.
  await panel
    .getByRole('radiogroup', { name: 'Average' })
    .getByRole('radio', { name: 'SMA 50' })
    .click()
  await page.keyboard.press('Escape')
  await chartA.getByRole('button', { name: 'Chart options' }).click()
  await expect(
    page
      .getByTestId('chart-options')
      .getByRole('radiogroup', { name: 'Average' })
      .getByRole('radio', { name: 'SMA 50' }),
  ).toHaveAttribute('aria-checked', 'true')
})
