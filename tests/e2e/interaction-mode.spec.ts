import { expect, test } from '@playwright/test'

import { dismissVisibleEditPanels, openGroupEditor } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
  await page.reload()
})

test('switches between edit and view behavior', async ({ page, context }) => {
  await page.getByRole('button', { name: 'Add your first link' }).click()
  await page.getByLabel('Link URL').fill('example.com')
  await page.getByLabel('Link title').fill('Example')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  const modeToggle = page.getByRole('button', {
    name: 'Toggle interaction mode',
  })
  await expect(modeToggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.workspaceShell')).toHaveAttribute(
    'data-mode',
    'edit',
  )

  const card = page.getByTestId(/link-card-/).first()
  await card.hover()
  await expect(card.getByRole('button', { name: 'Update' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Delete' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Resize e' })).toBeVisible()

  const beforeResize = await card.boundingBox()
  if (!beforeResize) throw new Error('card missing bounding box before resize')

  await page
    .getByTestId(/link-card-/)
    .first()
    .getByRole('button', { name: 'Resize e' })
    .dispatchEvent('pointerdown', {
      clientX: beforeResize.x + beforeResize.width,
      clientY: beforeResize.y + beforeResize.height / 2,
      button: 0,
    })
  await page.mouse.move(
    beforeResize.x + beforeResize.width + 40,
    beforeResize.y + beforeResize.height / 2,
  )
  await expect(page.getByTestId('card-snap-preview')).toBeVisible()
  await page.mouse.up()
  await expect
    .poll(() =>
      card.evaluate((node) => ({
        width: getComputedStyle(node).width,
        height: getComputedStyle(node).height,
      })),
    )
    .toEqual({ width: '168px', height: '120px' })

  await page.getByRole('button', { name: 'Add group' }).click()
  await expect(page.getByTestId('group-edit-panel')).toHaveCount(0)
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  const groupHeader = page.getByTestId(/card-group-header-/).first()
  await groupHeader.hover()
  await expect(page.getByRole('button', { name: 'Update group' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete group' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Resize group e' }),
  ).toBeVisible()

  await card.hover()
  await card.getByRole('button', { name: 'Update' }).click()
  await expect(page.getByLabel(/Edit title for/)).toBeVisible()
  await page.getByLabel(/Edit width for/).fill('4')
  await page.getByLabel(/Edit height for/).fill('6')
  await page.getByLabel(/Show title on/).uncheck()
  await page.getByLabel(/Show image on/).check()
  await page.getByRole('button', { name: 'Fill color preset 3' }).click()
  await page.getByRole('button', { name: 'Border color preset 4' }).click()
  await expect
    .poll(() =>
      card.evaluate((node) => ({
        width: getComputedStyle(node).width,
        height: getComputedStyle(node).height,
        fillColor: getComputedStyle(node)
          .getPropertyValue('--card-surface')
          .trim(),
        borderColor: getComputedStyle(node)
          .getPropertyValue('--card-outline')
          .trim(),
        layout: node
          .querySelector('[data-layout]')
          ?.getAttribute('data-layout'),
      })),
    )
    .toEqual({
      width: '96px',
      height: '144px',
      fillColor: '#24364a',
      borderColor: '#66c7b5',
      layout: 'single-content',
    })
  await expect(card.getByTestId('card-title')).toHaveCount(0)
  await expect(card.getByTestId('card-image')).toBeVisible()

  await dismissVisibleEditPanels(page)
  await expect(page.getByLabel(/Edit title for/)).toHaveCount(0)

  const before = await card.boundingBox()
  if (!before) throw new Error('card missing bounding box')

  await card.dispatchEvent('pointerdown', {
    clientX: before.x + 20,
    clientY: before.y + 20,
    button: 0,
  })
  await page.mouse.move(before.x + 120, before.y + 100)
  await expect(page.getByTestId('card-snap-preview')).toBeVisible()
  await page.mouse.up()

  await modeToggle.click()
  await expect(modeToggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.workspaceShell')).toHaveAttribute(
    'data-mode',
    'view',
  )
  await expect(page.getByRole('button', { name: 'Update' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Resize e' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Update group' })).toHaveCount(
    0,
  )
  await expect(page.getByRole('button', { name: 'Delete group' })).toHaveCount(
    0,
  )
  await expect(
    page.getByRole('button', { name: 'Resize group e' }),
  ).toHaveCount(0)
  await card.hover()
  await page.waitForTimeout(550)
  await expect(page.getByTestId('card-url-tooltip')).toHaveText('example.com')

  const edgeClickBox = await card.boundingBox()
  if (!edgeClickBox) throw new Error('card missing bounding box in view mode')

  const pagePromise = context.waitForEvent('page')
  await card.click({ position: { x: 6, y: edgeClickBox.height - 6 } })
  const openedPage = await pagePromise
  await openedPage.waitForLoadState()
  await expect(openedPage).toHaveURL('https://example.com/')
})

test('enters edit mode immediately when creating a new link or group without auto-opening the group editor', async ({
  page,
}) => {
  const modeToggle = page.getByRole('button', {
    name: 'Toggle interaction mode',
  })

  await modeToggle.click()
  await expect(modeToggle).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('example.com')
  await page.getByLabel('Link title').fill('Example')
  await page.getByRole('button', { name: 'Create' }).click()

  await expect(modeToggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  await modeToggle.click()
  await expect(modeToggle).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('button', { name: 'Add group' }).click()

  await expect(modeToggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('group-edit-panel')).toHaveCount(0)
  await openGroupEditor(page)
  await expect(page.getByTestId('group-edit-panel')).toBeVisible()
})

test('persists interaction mode across reloads', async ({ page }) => {
  const modeToggle = page.getByRole('button', {
    name: 'Toggle interaction mode',
  })

  await expect(modeToggle).toHaveAttribute('aria-pressed', 'true')

  await modeToggle.click()

  await expect(modeToggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.workspaceShell')).toHaveAttribute(
    'data-mode',
    'view',
  )

  await page.reload()

  await expect(modeToggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.workspaceShell')).toHaveAttribute(
    'data-mode',
    'view',
  )
})

test('scales the title down on very small cards instead of hiding it', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add your first link' }).click()
  await page.getByLabel('Link URL').fill('example.com')
  await page.getByLabel('Link title').fill('Dashboard')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()

  const card = page.getByTestId(/link-card-/).first()

  await page.getByLabel(/Edit width for/).fill('1')
  await page.getByLabel(/Edit height for/).fill('1')

  await expect
    .poll(() =>
      card.evaluate((node) => ({
        width: getComputedStyle(node).width,
        height: getComputedStyle(node).height,
      })),
    )
    .toEqual({
      width: '120px',
      height: '120px',
    })

  await expect(
    page.getByText('Enter a width and height between 2 and 12 cells.'),
  ).toBeVisible()

  await page.getByLabel(/Edit width for/).fill('2')
  await page.getByLabel(/Edit height for/).fill('2')

  await expect
    .poll(() =>
      card.evaluate((node) => ({
        width: getComputedStyle(node).width,
        height: getComputedStyle(node).height,
        layout: node
          .querySelector('[data-layout]')
          ?.getAttribute('data-layout'),
        contentFits: (() => {
          const image = node.querySelector('[data-testid="card-image"]')
          const title = node.querySelector('[data-testid="card-title"]')

          if (
            !(image instanceof HTMLElement) ||
            !(title instanceof HTMLElement)
          ) {
            return false
          }

          const cardRect = node.getBoundingClientRect()
          const imageRect = image.getBoundingClientRect()
          const titleRect = title.getBoundingClientRect()

          return (
            titleRect.left >= cardRect.left &&
            titleRect.right <= cardRect.right &&
            titleRect.bottom <= cardRect.bottom &&
            titleRect.top >= imageRect.bottom - 1
          )
        })(),
      })),
    )
    .toEqual({
      width: '48px',
      height: '48px',
      layout: 'dual-content',
      contentFits: false,
    })

  await expect(card.getByTestId('card-title')).toHaveCount(1)
  await expect(card.getByTestId('card-image')).toBeVisible()
})

test('keeps the card edit panel fully inside the viewport on small screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 })
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
  await page.reload()

  await page.getByRole('button', { name: 'Add your first link' }).click()
  await page.getByLabel('Link URL').fill('example.com')
  await page.getByLabel('Link title').fill('Example')
  await page.getByRole('button', { name: 'Create' }).click()

  const card = page.getByTestId(/link-card-/).first()
  await expect(card).toBeVisible()
  await dismissVisibleEditPanels(page)
  const before = await card.boundingBox()
  if (!before) throw new Error('card missing bounding box before move')

  await card.dispatchEvent('pointerdown', {
    clientX: before.x + 20,
    clientY: before.y + 20,
    button: 0,
  })
  await page.mouse.move(before.x + 180, before.y + 260)
  await page.mouse.up()

  await card.hover()
  await page.getByRole('button', { name: 'Update' }).click()

  await expect(page.getByTestId('card-edit-panel')).toBeVisible()

  const cardBox = await card.boundingBox()
  if (!cardBox)
    throw new Error('card missing bounding box after opening edit panel')

  const panelBox = await page.getByTestId('card-edit-panel').boundingBox()
  if (!panelBox) throw new Error('card edit panel missing bounding box')

  const overlapsCard = !(
    panelBox.x + panelBox.width <= cardBox.x ||
    cardBox.x + cardBox.width <= panelBox.x ||
    panelBox.y + panelBox.height <= cardBox.y ||
    cardBox.y + cardBox.height <= panelBox.y
  )

  expect(panelBox.x).toBeGreaterThanOrEqual(0)
  expect(panelBox.y).toBeGreaterThanOrEqual(0)
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(390)
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(700)
  expect(overlapsCard).toBe(false)

  const panelScrollState = await page
    .getByTestId('card-edit-panel')
    .evaluate((node) => ({
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    }))
  expect(panelScrollState.scrollHeight).toBeGreaterThan(
    panelScrollState.clientHeight,
  )

  const cardBoxBeforePanelScroll = await card.boundingBox()
  if (!cardBoxBeforePanelScroll) {
    throw new Error('card missing bounding box before panel scroll')
  }

  await page.getByTestId('card-edit-panel').hover()
  await page.mouse.wheel(0, 360)

  await expect
    .poll(() =>
      page
        .getByTestId('card-edit-panel')
        .evaluate((node) => Math.round(node.scrollTop)),
    )
    .toBeGreaterThan(Math.round(panelScrollState.scrollTop))

  const cardBoxAfterPanelScroll = await card.boundingBox()
  if (!cardBoxAfterPanelScroll) {
    throw new Error('card missing bounding box after panel scroll')
  }

  expect(
    Math.abs(cardBoxAfterPanelScroll.width - cardBoxBeforePanelScroll.width),
  ).toBeLessThan(1)
  expect(
    Math.abs(cardBoxAfterPanelScroll.height - cardBoxBeforePanelScroll.height),
  ).toBeLessThan(1)
})

test('selects cards with an exclusive marquee that only keeps fully enclosed cards', async ({
  page,
}) => {
  for (const entry of [
    { title: 'One', url: 'one.example.com' },
    { title: 'Two', url: 'two.example.com' },
  ]) {
    await page.getByRole('button', { name: 'Add link' }).click()
    await page.getByLabel('Link URL').fill(entry.url)
    await page.getByLabel('Link title').fill(entry.title)
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByTestId('card-edit-panel')).toBeVisible()
    await dismissVisibleEditPanels(page)
  }

  const cards = page.getByTestId(/link-card-/)
  await expect(cards).toHaveCount(2)

  const firstCard = cards.nth(0)
  const secondCard = cards.nth(1)
  const firstBox = await firstCard.boundingBox()
  const secondBox = await secondCard.boundingBox()

  if (!firstBox || !secondBox) {
    throw new Error('missing card bounding boxes for marquee selection')
  }

  const marqueeStart = {
    x: Math.min(firstBox.x, secondBox.x) - 20,
    y: Math.min(firstBox.y, secondBox.y) - 20,
  }
  const marqueeEnd = {
    x:
      Math.max(firstBox.x + firstBox.width, secondBox.x + secondBox.width) + 20,
    y:
      Math.max(firstBox.y + firstBox.height, secondBox.y + secondBox.height) +
      20,
  }

  await page.mouse.move(marqueeStart.x, marqueeStart.y)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(marqueeEnd.x, marqueeEnd.y)
  await expect(page.getByTestId('selection-marquee')).toBeVisible()
  await page.mouse.up({ button: 'left' })

  await expect(firstCard).toHaveAttribute('data-selected', 'true')
  await expect(secondCard).toHaveAttribute('data-selected', 'true')

  const partialEnd = {
    x: firstBox.x + firstBox.width / 2,
    y: firstBox.y + firstBox.height / 2,
  }

  await page.mouse.move(marqueeStart.x, marqueeStart.y)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(partialEnd.x, partialEnd.y)
  await page.mouse.up({ button: 'left' })

  await expect(firstCard).toHaveAttribute('data-selected', 'false')
  await expect(secondCard).toHaveAttribute('data-selected', 'false')
})

test('selects groups with an exclusive marquee that only keeps fully enclosed groups', async ({
  page,
}) => {
  for (let index = 0; index < 2; index += 1) {
    await page.getByRole('button', { name: 'Add group' }).click()
    await openGroupEditor(page)
    await page.getByLabel(/Edit group width for/).fill('4')
    await page.getByLabel(/Edit group height for/).fill('4')
    await dismissVisibleEditPanels(page)
  }

  const groups = page.locator('article[data-testid^="card-group-"]')
  await expect(groups).toHaveCount(2)

  const firstGroup = groups.nth(0)
  const secondGroup = groups.nth(1)
  const firstBox = await firstGroup.boundingBox()
  const secondBox = await secondGroup.boundingBox()

  if (!firstBox || !secondBox) {
    throw new Error('missing group bounding boxes for marquee selection')
  }

  const marqueeStart = {
    x: Math.min(firstBox.x, secondBox.x) - 20,
    y: Math.min(firstBox.y, secondBox.y) - 20,
  }
  const marqueeEnd = {
    x:
      Math.max(firstBox.x + firstBox.width, secondBox.x + secondBox.width) + 20,
    y:
      Math.max(firstBox.y + firstBox.height, secondBox.y + secondBox.height) +
      20,
  }

  await page.mouse.move(marqueeStart.x, marqueeStart.y)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(marqueeEnd.x, marqueeEnd.y)
  await page.mouse.up({ button: 'left' })

  await expect(firstGroup).toHaveAttribute('data-selected', 'true')
  await expect(secondGroup).toHaveAttribute('data-selected', 'true')

  const partialEnd = {
    x: firstBox.x + firstBox.width / 2,
    y: firstBox.y + firstBox.height / 2,
  }

  await page.mouse.move(marqueeStart.x, marqueeStart.y)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(partialEnd.x, partialEnd.y)
  await page.mouse.up({ button: 'left' })

  await expect(firstGroup).toHaveAttribute('data-selected', 'false')
  await expect(secondGroup).toHaveAttribute('data-selected', 'false')
})
