import { expect, test, type Page } from '@playwright/test'

import { moveCardIntoGroupBody } from './dragHelpers'
import {
  CANVAS_TEST_ID,
  dismissVisibleEditPanels,
  openGroupEditor,
} from './fixtures'

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

test('creates, drags, and persists a link card', async ({ page }) => {
  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('example.com')
  await page.getByLabel('Link title').fill('Example')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  const card = page.getByTestId(/link-card-/).first()
  await expect(card).toBeVisible()
  await expect(card).toContainText('Example')

  const before = await card.boundingBox()
  if (!before) throw new Error('card missing bounding box')
  expect(Math.round(before.width)).toBe(120)
  expect(Math.round(before.height)).toBe(120)

  await card.dispatchEvent('pointerdown', {
    clientX: before.x + 20,
    clientY: before.y + 20,
    button: 0,
  })
  await page.mouse.move(before.x + 120, before.y + 100)
  await expect(page.getByTestId('card-snap-preview')).toBeVisible()
  await page.mouse.up()

  const after = await card.boundingBox()
  if (!after) throw new Error('card missing bounding box after drag')
  expect(after.x).not.toBe(before.x)

  await page.waitForTimeout(250)
  await page.reload()
  await expect(page.getByTestId(/link-card-/).first()).toContainText('Example')
})

test('shows the protocol-free url when title display is enabled but the title is empty', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add link' }).click()
  await page
    .getByLabel('Link URL')
    .fill('https://www.example.com/some/path?x=1')
  await page.getByLabel('Link title').fill('')
  await page.getByRole('button', { name: 'Create' }).click()

  const card = page.getByTestId(/link-card-/).first()
  await expect(card).toBeVisible()
  await expect(card.getByTestId('card-title')).toHaveText(
    'example.com/some/path?x=1',
  )
})

test('supports canvas paste for quick link creation', async ({ page }) => {
  const canvas = page.getByTestId(CANVAS_TEST_ID)
  await canvas.click()

  await page.evaluate(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: async () => 'https://example.com',
      },
    })

    window.dispatchEvent(new Event('paste'))
  })

  await expect(page.getByTestId(/link-card-/).first()).toBeVisible()
  await expect(page.getByTestId(/link-card-/).first()).toContainText(
    'example.com',
  )
})

test('moves cards together with their group', async ({ page }) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  const group = page.getByTestId(/card-group-/).first()
  const groupBody = page.getByTestId(/card-group-body-/).first()
  const groupHeader = page.getByTestId(/card-group-header-/).first()
  await expect(group).toBeVisible()

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('example.com')
  await page.getByLabel('Link title').fill('Example')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  const card = page.getByTestId(/link-card-/).first()
  await expect(card).toBeVisible()

  const groupBefore = await group.boundingBox()
  const cardBefore = await card.boundingBox()

  if (!groupBefore || !cardBefore) {
    throw new Error('group or card missing bounding box before group move')
  }

  await moveCardIntoGroupBody(page, card, groupBody)

  const cardInsideGroup = await card.boundingBox()

  if (!cardInsideGroup) {
    throw new Error('card missing bounding box after moving into group')
  }

  const headerBefore = await groupHeader.boundingBox()

  if (!headerBefore) {
    throw new Error('group header missing bounding box before group move')
  }

  await groupHeader.dispatchEvent('pointerdown', {
    clientX: headerBefore.x + 18,
    clientY: headerBefore.y + headerBefore.height / 2,
    button: 0,
  })
  await page.mouse.move(headerBefore.x + 114, headerBefore.y + 90)
  await page.mouse.up()

  await expect
    .poll(async () => {
      const groupAfter = await group.boundingBox()
      const cardAfter = await card.boundingBox()

      return {
        groupX: Math.round(groupAfter?.x ?? 0),
        cardX: Math.round(cardAfter?.x ?? 0),
      }
    })
    .toEqual({
      groupX: Math.round(groupBefore.x + 96),
      cardX: Math.round(cardInsideGroup.x + 96),
    })
})

test('allows groups larger than 12 cells while keeping a 2x2 minimum', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)

  const group = page.getByTestId(/card-group-/).first()
  await expect(group).toBeVisible()

  await page.getByLabel(/Edit group width for/).fill('14')
  await page.getByLabel(/Edit group height for/).fill('13')

  await expect
    .poll(() =>
      group.evaluate((node) => ({
        width: getComputedStyle(node).width,
        height: getComputedStyle(node).height,
      })),
    )
    .toEqual({
      width: '336px',
      height: '312px',
    })

  await page.getByLabel(/Edit group width for/).fill('1')
  await page.getByLabel(/Edit group height for/).fill('1')

  await expect(
    page.getByText('Enter a width and height of at least 2 cells.'),
  ).toBeVisible()

  await page.getByLabel(/Edit group width for/).fill('2')
  await page.getByLabel(/Edit group height for/).fill('2')

  await expect
    .poll(() =>
      group.evaluate((node) => ({
        width: getComputedStyle(node).width,
        height: getComputedStyle(node).height,
      })),
    )
    .toEqual({
      width: '48px',
      height: '48px',
    })
})

test('does not include outside cards when only the group moves over them', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  const group = page.getByTestId(/card-group-/).first()
  const groupBody = page.getByTestId(/card-group-body-/).first()
  const groupHeader = page.getByTestId(/card-group-header-/).first()
  await expect(group).toBeVisible()

  for (const entry of [
    { url: 'one.example.com', title: 'One' },
    { url: 'two.example.com', title: 'Two' },
  ]) {
    await page.getByRole('button', { name: 'Add link' }).click()
    await page.getByLabel('Link URL').fill(entry.url)
    await page.getByLabel('Link title').fill(entry.title)
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByTestId('card-edit-panel')).toBeVisible()
    await dismissVisibleEditPanels(page)
  }

  const cards = page.getByTestId(/link-card-/)
  const insideCard = cards.nth(0)
  const outsideCard = cards.nth(1)

  const groupBox = await group.boundingBox()

  if (!groupBox) {
    throw new Error('missing geometry for group setup')
  }

  await moveCardIntoGroupBody(page, insideCard, groupBody)

  const outsideBeforeSweep = await outsideCard.boundingBox()
  const headerBeforeSweep = await groupHeader.boundingBox()

  if (!outsideBeforeSweep || !headerBeforeSweep) {
    throw new Error('missing geometry before sweep move')
  }

  await groupHeader.dispatchEvent('pointerdown', {
    clientX: headerBeforeSweep.x + 18,
    clientY: headerBeforeSweep.y + headerBeforeSweep.height / 2,
    button: 0,
  })
  await page.mouse.move(headerBeforeSweep.x + 130, headerBeforeSweep.y + 10)
  await page.mouse.up()

  const headerBeforeSecondMove = await groupHeader.boundingBox()

  if (!headerBeforeSecondMove) {
    throw new Error('missing group header before second move')
  }

  await groupHeader.dispatchEvent('pointerdown', {
    clientX: headerBeforeSecondMove.x + 18,
    clientY: headerBeforeSecondMove.y + headerBeforeSecondMove.height / 2,
    button: 0,
  })
  await page.mouse.move(headerBeforeSecondMove.x + 90, headerBeforeSecondMove.y)
  await page.mouse.up()

  await expect
    .poll(async () => {
      const outsideAfter = await outsideCard.boundingBox()

      return {
        outsideX: Math.round(outsideAfter?.x ?? 0),
      }
    })
    .toEqual({
      outsideX: Math.round(outsideBeforeSweep.x),
    })
})

test('does not include outside groups when only the group moves over them', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await page.getByLabel(/Edit group width for/).fill('14')
  await page.getByLabel(/Edit group height for/).fill('13')
  await dismissVisibleEditPanels(page)

  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  const groups = page.locator('article[data-testid^="card-group-"]')
  const movingGroup = groups.first()
  const stationaryGroup = groups.nth(1)
  const movingGroupBody = page.getByTestId(/card-group-body-/).first()
  const movingGroupHeader = page.getByTestId(/card-group-header-/).first()

  const movingGroupBefore = await movingGroup.boundingBox()
  const movingGroupBodyBefore = await movingGroupBody.boundingBox()
  const movingHeaderBeforeSweep = await movingGroupHeader.boundingBox()
  const stationaryBeforeSweep = await stationaryGroup.boundingBox()

  if (
    !movingGroupBefore ||
    !movingGroupBodyBefore ||
    !movingHeaderBeforeSweep ||
    !stationaryBeforeSweep
  ) {
    throw new Error('missing geometry before sweeping a group over another')
  }

  const bodyOffsetX = movingGroupBodyBefore.x - movingGroupBefore.x
  const bodyOffsetY = movingGroupBodyBefore.y - movingGroupBefore.y
  const desiredGroupX = stationaryBeforeSweep.x - bodyOffsetX - 24
  const desiredGroupY = stationaryBeforeSweep.y - bodyOffsetY - 24
  const deltaX = desiredGroupX - movingGroupBefore.x
  const deltaY = desiredGroupY - movingGroupBefore.y

  await movingGroupHeader.dispatchEvent('pointerdown', {
    clientX: movingHeaderBeforeSweep.x + 18,
    clientY: movingHeaderBeforeSweep.y + movingHeaderBeforeSweep.height / 2,
    button: 0,
  })
  await page.mouse.move(
    movingHeaderBeforeSweep.x + 18 + deltaX,
    movingHeaderBeforeSweep.y + movingHeaderBeforeSweep.height / 2 + deltaY,
  )
  await page.mouse.up()

  const movingHeaderBeforeSecondMove = await movingGroupHeader.boundingBox()
  const stationaryBeforeSecondMove = await stationaryGroup.boundingBox()

  if (!movingHeaderBeforeSecondMove || !stationaryBeforeSecondMove) {
    throw new Error('missing geometry before second group move')
  }

  await movingGroupHeader.dispatchEvent('pointerdown', {
    clientX: movingHeaderBeforeSecondMove.x + 18,
    clientY:
      movingHeaderBeforeSecondMove.y + movingHeaderBeforeSecondMove.height / 2,
    button: 0,
  })
  await page.mouse.move(
    movingHeaderBeforeSecondMove.x + 114,
    movingHeaderBeforeSecondMove.y + movingHeaderBeforeSecondMove.height / 2,
  )
  await page.mouse.up()

  await expect
    .poll(async () => {
      const stationaryAfter = await stationaryGroup.boundingBox()

      return {
        stationaryX: Math.round(stationaryAfter?.x ?? 0),
      }
    })
    .toEqual({
      stationaryX: Math.round(stationaryBeforeSecondMove.x),
    })
})

test('does not include outside pictures when only the group moves over them', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  const group = page.getByTestId(/card-group-/).first()
  const groupHeader = page.getByTestId(/card-group-header-/).first()
  await expect(group).toBeVisible()

  await dropTestImage(page, 'inside-picture.png')
  await dropTestImage(page, 'outside-picture.png')

  const pictures = page.getByTestId(/picture-node-/)
  const insidePicture = pictures.nth(0)
  const outsidePicture = pictures.nth(1)

  const groupBox = await group.boundingBox()
  const insideBox = await insidePicture.boundingBox()

  if (!groupBox || !insideBox) {
    throw new Error('missing geometry for outside picture setup')
  }

  await insidePicture.dispatchEvent('pointerdown', {
    clientX: insideBox.x + 20,
    clientY: insideBox.y + 20,
    button: 0,
  })
  await page.mouse.move(groupBox.x + 36, groupBox.y + groupBox.height - 36)
  await page.mouse.up()

  const outsideBeforeSweep = await outsidePicture.boundingBox()
  const headerBeforeSweep = await groupHeader.boundingBox()

  if (!outsideBeforeSweep || !headerBeforeSweep) {
    throw new Error('missing geometry before picture sweep move')
  }

  await groupHeader.dispatchEvent('pointerdown', {
    clientX: headerBeforeSweep.x + 18,
    clientY: headerBeforeSweep.y + headerBeforeSweep.height / 2,
    button: 0,
  })
  await page.mouse.move(headerBeforeSweep.x + 130, headerBeforeSweep.y + 10)
  await page.mouse.up()

  const headerBeforeSecondMove = await groupHeader.boundingBox()

  if (!headerBeforeSecondMove) {
    throw new Error('missing group header before second picture move')
  }

  await groupHeader.dispatchEvent('pointerdown', {
    clientX: headerBeforeSecondMove.x + 18,
    clientY: headerBeforeSecondMove.y + headerBeforeSecondMove.height / 2,
    button: 0,
  })
  await page.mouse.move(headerBeforeSecondMove.x + 90, headerBeforeSecondMove.y)
  await page.mouse.up()

  await expect
    .poll(async () => {
      const outsideAfter = await outsidePicture.boundingBox()

      return {
        outsideX: Math.round(outsideAfter?.x ?? 0),
        outsideY: Math.round(outsideAfter?.y ?? 0),
      }
    })
    .toEqual({
      outsideX: Math.round(outsideBeforeSweep.x),
      outsideY: Math.round(outsideBeforeSweep.y),
    })
})

test('keeps cards editable after they are inside a group', async ({ page }) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  const group = page.getByTestId(/card-group-/).first()
  const groupBody = page.getByTestId(/card-group-body-/).first()
  await expect(group).toBeVisible()

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('editable.example.com')
  await page.getByLabel('Link title').fill('Editable')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  const card = page.getByTestId(/link-card-/).first()
  const groupBox = await group.boundingBox()

  if (!groupBox) {
    throw new Error('missing geometry for editable card in group test')
  }

  await moveCardIntoGroupBody(page, card, groupBody)

  await card.hover()
  await card.getByRole('button', { name: 'Update' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()

  await page.getByLabel(/Edit title for/).fill('Edited inside group')
  await expect(card).toContainText('Edited inside group')
})

test('keeps link opening as a workspace-level setting', async ({ page }) => {
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Options' }).click()
  await page.getByLabel('Open links in new tab').uncheck()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('override.example.com')
  await page.getByLabel('Link title').fill('Override target')
  await page.getByRole('button', { name: 'Create' }).click()
  const card = page.getByTestId(/link-card-/).first()
  await expect(card).toBeVisible()

  await card.hover()
  await card.getByRole('button', { name: 'Update' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await expect(page.getByLabel(/Open in new tab on/)).toHaveCount(0)
  await dismissVisibleEditPanels(page)

  await expect(card).toBeVisible()

  await page.getByRole('button', { name: 'Toggle interaction mode' }).click()
  await expect(card.locator('a')).toHaveCount(1)
  await expect(card.locator('a')).not.toHaveAttribute('target', '_blank')
})

test('keeps cards visually above the group while the header is hovered', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  const group = page.getByTestId(/card-group-/).first()
  const groupBody = page.getByTestId(/card-group-body-/).first()
  const groupHeader = page.getByTestId(/card-group-header-/).first()
  await expect(group).toBeVisible()

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('stacking.example.com')
  await page.getByLabel('Link title').fill('Stacking')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  const card = page.getByTestId(/link-card-/).first()
  const groupBox = await group.boundingBox()

  if (!groupBox) {
    throw new Error('missing geometry for group stacking test')
  }

  await moveCardIntoGroupBody(page, card, groupBody)

  await groupHeader.hover()

  const stackedCardBox = await card.boundingBox()
  const cardTestId = await card.getAttribute('data-testid')

  if (!stackedCardBox || !cardTestId) {
    throw new Error('missing card geometry after hovering the group header')
  }

  await expect
    .poll(() =>
      page.evaluate(
        ({ x, y }) =>
          document
            .elementFromPoint(x, y)
            ?.closest('[data-testid^="link-card-"]')
            ?.getAttribute('data-testid') ?? null,
        {
          x: stackedCardBox.x + stackedCardBox.width / 2,
          y: stackedCardBox.y + stackedCardBox.height / 2,
        },
      ),
    )
    .toBe(cardTestId)
})

test('prefers a newly copied link over stale in-memory card clipboard data', async ({
  page,
}) => {
  await page.evaluate(() => {
    let clipboardText = ''

    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: async () => clipboardText,
        writeText: async (value: string) => {
          clipboardText = value
        },
      },
    })

    Object.assign(window, {
      __setClipboardTextForTest: (value: string) => {
        clipboardText = value
      },
    })
  })

  await page.getByRole('button', { name: 'Add your first link' }).click()
  await page.getByLabel('Link URL').fill('one.example.com')
  await page.getByLabel('Link title').fill('One')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  const cards = page.getByTestId(/link-card-/)
  await expect(cards).toHaveCount(1)

  await cards.first().click()
  await page.keyboard.press('Control+c')

  await page.evaluate(() => {
    ;(
      window as typeof window & {
        __setClipboardTextForTest: (value: string) => void
      }
    ).__setClipboardTextForTest('https://example.com')
  })

  await page.getByTestId(CANVAS_TEST_ID).click()
  await page.evaluate(() => {
    window.dispatchEvent(new Event('paste'))
  })

  await expect(cards).toHaveCount(2)
  await expect(cards.nth(1)).not.toContainText('One')
})
