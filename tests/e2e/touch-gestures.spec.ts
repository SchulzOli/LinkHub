import { expect, test, type Page } from '@playwright/test'

import { dismissVisibleEditPanels } from './fixtures'

type TouchPoint = { x: number; y: number }

/** Real multi-touch input through Chromium's DevTools protocol. */
async function touch(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  const send = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: TouchPoint[],
  ) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((point, id) => ({ ...point, id })),
    })

  return {
    /** Moves fingers from `from` to `to` in a few steps. */
    async gesture(from: TouchPoint[], to: TouchPoint[], steps = 8) {
      await send('touchStart', from)

      for (let step = 1; step <= steps; step += 1) {
        await send(
          'touchMove',
          from.map((point, index) => ({
            x: point.x + ((to[index].x - point.x) * step) / steps,
            y: point.y + ((to[index].y - point.y) * step) / steps,
          })),
        )
      }

      await send('touchEnd', [])
    },
    async tap(point: TouchPoint) {
      await send('touchStart', [point])
      await send('touchEnd', [])
    },
  }
}

async function addCard(page: Page) {
  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('docs.example.com')
  await page.getByLabel('Link title').fill('Docs')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  return page.getByTestId(/link-card-/).filter({ hasText: 'Docs' })
}

/** An empty spot of canvas, away from the card and the taskbar. */
async function emptySpot(page: Page, dx = 0, dy = 0) {
  const viewport = page.viewportSize()!

  return { x: viewport.width * 0.8 + dx, y: viewport.height * 0.25 + dy }
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chrome',
    'Touch gestures run on the phone project',
  )
  await page.goto('/')
})

test('pans the canvas with one finger and zooms with two', async ({ page }) => {
  const card = await addCard(page)
  const fingers = await touch(page)
  const before = (await card.boundingBox())!

  // One finger on empty canvas pans instead of drawing a selection.
  const from = await emptySpot(page)

  await fingers.gesture([from], [{ x: from.x - 60, y: from.y + 40 }])
  await expect(page.getByTestId('selection-marquee')).toHaveCount(0)

  const panned = (await card.boundingBox())!

  expect(panned.x).toBeCloseTo(before.x - 60, 0)
  expect(panned.y).toBeCloseTo(before.y + 40, 0)
  expect(panned.width).toBeCloseTo(before.width, 0)

  // Two fingers spreading apart zoom in.
  const center = await emptySpot(page)

  await fingers.gesture(
    [
      { x: center.x - 20, y: center.y },
      { x: center.x + 20, y: center.y },
    ],
    [
      { x: center.x - 40, y: center.y },
      { x: center.x + 40, y: center.y },
    ],
  )

  const zoomed = (await card.boundingBox())!

  expect(zoomed.width).toBeGreaterThan(panned.width * 1.5)
})

test('zooms in on a double tap and back on the next', async ({ page }) => {
  const card = await addCard(page)
  const fingers = await touch(page)
  const before = (await card.boundingBox())!
  const spot = await emptySpot(page)

  await fingers.tap(spot)
  await fingers.tap(spot)
  await expect
    .poll(async () => (await card.boundingBox())!.width)
    .toBeGreaterThan(before.width * 1.5)

  await page.waitForTimeout(400)
  await fingers.tap(spot)
  await fingers.tap(spot)
  await expect
    .poll(async () => (await card.boundingBox())!.width)
    .toBeCloseTo(before.width, 0)
})

test('a drag across a card in view mode scrolls instead of opening it', async ({
  page,
  context,
}) => {
  const card = await addCard(page)

  await page.getByRole('button', { name: 'Toggle interaction mode' }).click()

  const fingers = await touch(page)
  const box = (await card.boundingBox())!
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  let opened = false

  context.on('page', () => {
    opened = true
  })
  await fingers.gesture([start], [{ x: start.x + 50, y: start.y }])
  await page.waitForTimeout(300)

  expect(opened).toBe(false)
  expect((await card.boundingBox())!.x).toBeCloseTo(box.x + 50, 0)
})

test('draws in a note with one finger', async ({ page }) => {
  await page.getByRole('button', { name: 'Add note' }).click()

  const pad = page.getByTestId('note-pad')
  const box = (await pad.boundingBox())!
  const fingers = await touch(page)
  const before = await page.getByTestId('note-stroke').count()

  await fingers.gesture(
    [{ x: box.x + 20, y: box.y + 30 }],
    [{ x: box.x + 120, y: box.y + 80 }],
  )

  await expect(page.getByTestId('note-stroke')).toHaveCount(before + 1)
})

test('types in a note after a double tap', async ({ page }) => {
  await page.getByRole('button', { name: 'Add note' }).click()

  const box = (await page.getByTestId('note-pad').boundingBox())!
  const fingers = await touch(page)
  const spot = { x: box.x + 40, y: box.y + 60 }

  await fingers.tap(spot)
  await fingers.tap(spot)
  await expect(page.getByTestId('note-text-input')).toBeVisible()
  await page.keyboard.type('Hi')
  await page.getByTestId('note-text-input').blur()
  await expect(page.getByTestId('note-text')).toHaveText('Hi')
  // The two taps were for typing, not dots.
  await page.waitForTimeout(400)
  await expect(page.getByTestId('note-stroke')).toHaveCount(0)
})
