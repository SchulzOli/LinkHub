import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  CANVAS_TEST_ID,
  dismissVisibleEditPanels,
  openGroupEditor,
} from './fixtures'

type Point = {
  x: number
  y: number
}

async function getBoundingBox(locator: Locator, message: string) {
  const box = await locator.boundingBox()

  if (!box) {
    throw new Error(message)
  }

  return box
}

async function moveCanvasItemToPoint(page: Page, item: Locator, point: Point) {
  const box = await getBoundingBox(
    item,
    'missing geometry while moving canvas item',
  )

  await item.dispatchEvent('pointerdown', {
    clientX: box.x + Math.min(20, box.width / 2),
    clientY: box.y + Math.min(20, box.height / 2),
    button: 0,
  })
  await page.mouse.move(point.x, point.y)
  await page.mouse.up()
}

async function stageItemBelowGroup(
  page: Page,
  item: Locator,
  group: Locator,
  xOffset: number,
) {
  const groupBox = await getBoundingBox(
    group,
    'missing geometry while staging item',
  )

  await moveCanvasItemToPoint(page, item, {
    x: groupBox.x + Math.min(xOffset, groupBox.width - 24),
    y: groupBox.y + groupBox.height + 180,
  })
}

async function dragItemOntoGroupHeader(
  page: Page,
  item: Locator,
  groupHeader: Locator,
) {
  const headerBox = await getBoundingBox(
    groupHeader,
    'missing geometry while dragging item onto group header',
  )

  await moveCanvasItemToPoint(page, item, {
    x: headerBox.x + headerBox.width / 2,
    y: headerBox.y + headerBox.height / 2,
  })
}

function boxesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  )
}

async function expectItemNotToOverlapHeader(
  item: Locator,
  groupHeader: Locator,
) {
  await expect
    .poll(async () => {
      const itemBox = await item.boundingBox()
      const headerBox = await groupHeader.boundingBox()

      if (!itemBox || !headerBox) {
        throw new Error('missing geometry while asserting header overlap')
      }

      return boxesOverlap(itemBox, headerBox)
    })
    .toBe(false)
}

async function dropTestImage(page: Page, fileName: string) {
  const canvas = page.getByTestId(CANVAS_TEST_ID)
  const dataTransfer = await page.evaluateHandle((name) => {
    const transfer = new DataTransfer()
    const pngBytes = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
      0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84,
      120, 156, 99, 248, 255, 255, 63, 0, 5, 254, 2, 254, 167, 53, 129, 132, 0,
      0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ])
    const file = new File([pngBytes], name, {
      type: '',
    })

    transfer.items.add(file)

    return transfer
  }, fileName)

  await canvas.dispatchEvent('dragenter', { dataTransfer })
  await canvas.dispatchEvent('dragover', {
    clientX: 420,
    clientY: 320,
    dataTransfer,
  })
  await canvas.dispatchEvent('drop', {
    clientX: 420,
    clientY: 320,
    dataTransfer,
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
  await page.reload()
})

test('does not place a dragged card onto a group header', async ({ page }) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  const group = page.locator('article[data-testid^="card-group-"]').first()
  const groupHeader = page.getByTestId(/card-group-header-/).first()
  await expect(group).toBeVisible()

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('header-blocked.example.com')
  await page.getByLabel('Link title').fill('Blocked card')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  const card = page.getByTestId(/link-card-/).first()
  await expect(card).toBeVisible()

  await stageItemBelowGroup(page, card, group, 48)
  await dragItemOntoGroupHeader(page, card, groupHeader)
  await expectItemNotToOverlapHeader(card, groupHeader)
})

test('does not place a dragged picture node onto a group header', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  const group = page.locator('article[data-testid^="card-group-"]').first()
  const groupHeader = page.getByTestId(/card-group-header-/).first()
  await expect(group).toBeVisible()

  await dropTestImage(page, 'header-blocked-picture.png')

  const pictureNode = page.getByTestId(/picture-node-/).first()
  await expect(pictureNode).toBeVisible()

  await stageItemBelowGroup(page, pictureNode, group, 156)
  await dragItemOntoGroupHeader(page, pictureNode, groupHeader)
  await expectItemNotToOverlapHeader(pictureNode, groupHeader)
})
