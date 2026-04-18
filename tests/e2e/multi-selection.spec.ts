import { expect, test } from '@playwright/test'

import { moveCardIntoGroupBody, moveGroupIntoGroupBody } from './dragHelpers'
import { dismissVisibleEditPanels, openGroupEditor } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
  await page.reload()
})

test('supports multiselect keyboard copy cut paste, delete and group repositioning in edit mode', async ({
  page,
}) => {
  for (const [title, url] of [
    ['One', 'one.example.com'],
    ['Two', 'two.example.com'],
  ] as const) {
    await page.getByRole('button', { name: 'Add link' }).click()
    await page.getByLabel('Link URL').fill(url)
    await page.getByLabel('Link title').fill(title)
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByTestId('card-edit-panel')).toBeVisible()
    await dismissVisibleEditPanels(page)
  }

  const cards = page.getByTestId(/link-card-/)
  await expect(cards).toHaveCount(2)

  const firstCard = cards.nth(0)
  const secondCard = cards.nth(1)

  await firstCard.click()
  await expect(firstCard).toHaveAttribute('data-selected', 'true')

  await page.keyboard.down('Control')
  await secondCard.click()
  await page.keyboard.up('Control')

  await expect(firstCard).toHaveAttribute('data-selected', 'true')
  await expect(secondCard).toHaveAttribute('data-selected', 'true')

  const firstBefore = await firstCard.boundingBox()
  const secondBefore = await secondCard.boundingBox()

  if (!firstBefore || !secondBefore) {
    throw new Error('selected cards missing bounding boxes')
  }

  await firstCard.dispatchEvent('pointerdown', {
    clientX: firstBefore.x + 24,
    clientY: firstBefore.y + 24,
    button: 0,
  })
  await page.mouse.move(firstBefore.x + 72, firstBefore.y + 72)
  await page.mouse.up()

  await expect
    .poll(async () => {
      const firstAfter = await firstCard.boundingBox()
      const secondAfter = await secondCard.boundingBox()

      return {
        firstX: Math.round(firstAfter?.x ?? 0),
        secondX: Math.round(secondAfter?.x ?? 0),
      }
    })
    .toEqual({
      firstX: Math.round(firstBefore.x + 48),
      secondX: Math.round(secondBefore.x + 48),
    })

  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(cards).toHaveCount(4)

  await page.keyboard.press('Control+z')
  await expect(cards).toHaveCount(2)

  await page.keyboard.press('Control+v')
  await expect(cards).toHaveCount(4)

  await page.keyboard.press('Control+x')
  await expect(cards).toHaveCount(2)
  await expect(firstCard).toHaveAttribute('data-selected', 'false')
  await expect(secondCard).toHaveAttribute('data-selected', 'false')

  await page.keyboard.press('Control+z')
  await expect(cards).toHaveCount(4)

  await firstCard.click()
  await expect(firstCard).toHaveAttribute('data-selected', 'true')
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(cards).toHaveCount(5)

  await page.keyboard.press('Delete')
  await expect(cards).toHaveCount(4)
  await expect(firstCard).toHaveAttribute('data-selected', 'false')
})

test('applies keyboard copy cut paste delete and undo to selected group subtrees', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await page.getByLabel(/Edit group width for/).fill('14')
  await page.getByLabel(/Edit group height for/).fill('13')
  await dismissVisibleEditPanels(page)

  const groupArticles = page.locator('article[data-testid^="card-group-"]')
  const groupHeaders = page.getByTestId(/card-group-header-/)
  const groupBodies = page.getByTestId(/card-group-body-/)
  const cards = page.locator('article[data-testid^="link-card-"]')

  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('parent.example.com')
  await page.getByLabel('Link title').fill('Parent child')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('nested.example.com')
  await page.getByLabel('Link title').fill('Nested child')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  const parentBody = groupBodies.first()
  const childHeader = groupHeaders.nth(1)
  const childBody = groupBodies.nth(1)
  const parentCard = cards.filter({ hasText: 'Parent child' })
  const nestedCard = cards.filter({ hasText: 'Nested child' })

  await moveCardIntoGroupBody(page, parentCard, parentBody)
  await moveGroupIntoGroupBody(page, childHeader, parentBody, {
    placement: 'fit-inside-end',
  })
  await moveCardIntoGroupBody(page, nestedCard, childBody)

  await expect(groupArticles).toHaveCount(2)
  await expect(cards).toHaveCount(2)

  await groupHeaders.first().click()
  await expect(groupArticles.first()).toHaveAttribute('data-selected', 'true')

  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(groupArticles).toHaveCount(4)
  await expect(cards).toHaveCount(4)

  await page.keyboard.press('Control+z')
  await expect(groupArticles).toHaveCount(2)
  await expect(cards).toHaveCount(2)

  await groupHeaders.first().click()
  await page.keyboard.press('Control+x')
  await expect(groupArticles).toHaveCount(0)
  await expect(cards).toHaveCount(0)

  await page.keyboard.press('Control+z')
  await expect(groupArticles).toHaveCount(2)
  await expect(cards).toHaveCount(2)

  await groupHeaders.first().click()
  await page.keyboard.press('Delete')
  await expect(groupArticles).toHaveCount(0)
  await expect(cards).toHaveCount(0)

  await page.keyboard.press('Control+z')
  await expect(groupArticles).toHaveCount(2)
  await expect(cards).toHaveCount(2)
})
