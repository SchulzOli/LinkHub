import { expect, test } from '@playwright/test'

import { dismissVisibleEditPanels } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
  await page.reload()
})

test('supports wheel zoom and ctrl+wheel panning', async ({ page }) => {
  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('example.com')
  await page.getByLabel('Link title').fill('Example')
  await page.getByRole('button', { name: 'Create' }).click()

  const canvas = page.getByTestId('infinite-canvas')
  const card = page.getByTestId(/link-card-/).first()
  await expect(card).toBeVisible()
  await dismissVisibleEditPanels(page)
  const favicon = card.locator('img').first()

  const before = await card.boundingBox()
  if (!before) throw new Error('card missing bounding box before navigation')
  const beforeFavicon = await favicon.boundingBox()
  if (!beforeFavicon)
    throw new Error('favicon missing bounding box before navigation')
  const beforeRatio = beforeFavicon.width / before.width
  const canvasBox = await canvas.boundingBox()

  if (!canvasBox) {
    throw new Error('canvas missing bounding box before navigation')
  }

  await page.mouse.move(canvasBox.x + 24, canvasBox.y + 24)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(canvasBox.x + 144, canvasBox.y + 104)
  await page.mouse.up({ button: 'right' })

  const afterRightPan = await card.boundingBox()
  if (!afterRightPan) {
    throw new Error('card missing bounding box after right-button pan')
  }
  expect(afterRightPan.x).toBeGreaterThan(before.x)
  expect(afterRightPan.y).toBeGreaterThan(before.y)

  await page.mouse.move(
    afterRightPan.x + afterRightPan.width / 2,
    afterRightPan.y + afterRightPan.height / 2,
  )
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(
    afterRightPan.x + afterRightPan.width / 2 + 72,
    afterRightPan.y + afterRightPan.height / 2 + 52,
  )
  await page.mouse.up({ button: 'right' })

  const afterCardRightPan = await card.boundingBox()
  if (!afterCardRightPan) {
    throw new Error('card missing bounding box after right-button card pan')
  }
  expect(afterCardRightPan.x).toBeGreaterThan(afterRightPan.x)
  expect(afterCardRightPan.y).toBeGreaterThan(afterRightPan.y)

  await canvas.dispatchEvent('wheel', {
    deltaY: -120,
    clientX: before.x + before.width / 2,
    clientY: before.y + before.height / 2,
    bubbles: true,
    cancelable: true,
  })

  await expect
    .poll(() =>
      Promise.all([
        card.evaluate((node) => ({
          width: Math.round(node.getBoundingClientRect().width),
          height: Math.round(node.getBoundingClientRect().height),
        })),
        favicon.evaluate((node) => ({
          width: Math.round(node.getBoundingClientRect().width),
          height: Math.round(node.getBoundingClientRect().height),
        })),
      ]).then(([cardBox, faviconBox]) => ({
        width: cardBox.width,
        height: cardBox.height,
        faviconWidth: faviconBox.width,
        faviconHeight: faviconBox.height,
      })),
    )
    .toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number),
      faviconWidth: expect.any(Number),
      faviconHeight: expect.any(Number),
    })

  const afterZoomCard = await card.boundingBox()
  const afterZoomFavicon = await favicon.boundingBox()

  if (!afterZoomCard || !afterZoomFavicon) {
    throw new Error('missing bounding box after zoom')
  }

  const afterZoomRatio = afterZoomFavicon.width / afterZoomCard.width

  expect(afterZoomCard.width).toBeGreaterThan(before.width)
  expect(afterZoomCard.height).toBeGreaterThan(before.height)
  expect(afterZoomFavicon.width).toBeGreaterThan(beforeFavicon.width)
  expect(afterZoomFavicon.height).toBeGreaterThan(beforeFavicon.height)
  expect(Math.abs(afterZoomRatio - beforeRatio)).toBeLessThan(0.02)

  await canvas.dispatchEvent('wheel', {
    ctrlKey: true,
    deltaY: 120,
    bubbles: true,
    cancelable: true,
  })

  const afterVerticalScroll = await card.boundingBox()
  if (!afterVerticalScroll) {
    throw new Error('card missing bounding box after vertical scroll')
  }
  expect(afterVerticalScroll.y).toBeLessThan(afterZoomCard.y)

  await canvas.dispatchEvent('wheel', {
    altKey: true,
    deltaY: 120,
    bubbles: true,
    cancelable: true,
  })

  const afterHorizontalScroll = await card.boundingBox()
  if (!afterHorizontalScroll) {
    throw new Error('card missing bounding box after horizontal scroll')
  }
  expect(afterHorizontalScroll.x).toBeLessThan(afterVerticalScroll.x)

  for (let index = 0; index < 20; index += 1) {
    await canvas.dispatchEvent('wheel', {
      deltaY: 120,
      clientX: before.x + before.width / 2,
      clientY: before.y + before.height / 2,
      bubbles: true,
      cancelable: true,
    })
  }

  const afterZoomOutCard = await card.boundingBox()
  const afterZoomOutFavicon = await favicon.boundingBox()

  if (!afterZoomOutCard || !afterZoomOutFavicon) {
    throw new Error('missing bounding box after zoom out')
  }

  const afterZoomOutRatio = afterZoomOutFavicon.width / afterZoomOutCard.width

  expect(afterZoomOutCard.width).toBeLessThan(before.width * 0.3)
  expect(afterZoomOutCard.height).toBeLessThan(before.height * 0.3)
  expect(afterZoomOutFavicon.width).toBeLessThan(beforeFavicon.width * 0.3)
  expect(afterZoomOutFavicon.height).toBeLessThan(beforeFavicon.height * 0.3)
  expect(Math.abs(afterZoomOutRatio - beforeRatio)).toBeLessThan(0.02)
})
