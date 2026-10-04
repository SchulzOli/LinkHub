import { expect, test } from '@playwright/test'

import {
  moveCardIntoGroupBody,
  moveElementToPoint,
  moveGroupIntoGroupBody,
} from './dragHelpers'
import { dismissVisibleEditPanels, openGroupEditor } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
  await page.reload()
})

test('collapses a group, hides child cards, and pulls lower cards upward', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  const group = page.getByTestId(/card-group-/).first()
  const groupBody = page.getByTestId(/card-group-body-/).first()

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('inside.example.com')
  await page.getByLabel('Link title').fill('Inside')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('below.example.com')
  await page.getByLabel('Link title').fill('Below')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  const insideCard = page.getByTestId(/link-card-/).filter({
    hasText: 'Inside',
  })
  const belowCard = page.getByTestId(/link-card-/).filter({ hasText: 'Below' })

  await moveCardIntoGroupBody(page, insideCard, groupBody)

  const groupBefore = await group.boundingBox()

  if (!groupBefore) {
    throw new Error('missing geometry for collapse test group')
  }

  await moveElementToPoint(page, belowCard, {
    x: groupBefore.x + groupBefore.width / 2,
    y: groupBefore.y + groupBefore.height + 36,
  })

  const belowBefore = await belowCard.boundingBox()

  if (!belowBefore) {
    throw new Error('missing geometry for lower card before collapse')
  }

  await page
    .getByTestId(/group-collapse-toggle-/)
    .first()
    .click()
  await expect(insideCard).toHaveCount(0)

  await expect
    .poll(async () => {
      const groupAfter = await group.boundingBox()
      const belowAfter = await belowCard.boundingBox()

      return {
        belowY: Math.round(belowAfter?.y ?? 0),
        groupHeight: Math.round(groupAfter?.height ?? 0),
      }
    })
    .toEqual({
      belowY: Math.round(belowBefore.y - (groupBefore.height - 48)),
      groupHeight: 48,
    })
})

test('keeps the group header the same size when collapsed', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  const header = page.getByTestId(/card-group-header-/).first()
  const expanded = await header.boundingBox()

  if (!expanded) {
    throw new Error('missing header geometry before collapse')
  }

  await page
    .getByTestId(/group-collapse-toggle-/)
    .first()
    .click()

  await expect
    .poll(async () => {
      const collapsed = await header.boundingBox()

      return {
        height: Math.round(collapsed?.height ?? 0),
        width: Math.round(collapsed?.width ?? 0),
      }
    })
    .toEqual({
      height: Math.round(expanded.height),
      width: Math.round(expanded.width),
    })
  // Title row is vertically centred in the collapsed group.
  const group = page.getByTestId(/card-group-/).first()
  const groupBox = await group.boundingBox()
  const headerBox = await header.boundingBox()

  if (!groupBox || !headerBox) {
    throw new Error('missing collapsed geometry')
  }

  const gapAbove = headerBox.y - groupBox.y
  const gapBelow =
    groupBox.y + groupBox.height - (headerBox.y + headerBox.height)

  expect(Math.abs(gapAbove - gapBelow)).toBeLessThanOrEqual(1)
})

test('toggles group collapse from the header in view mode', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  const groupBody = page.getByTestId(/card-group-body-/).first()
  const groupHeader = page.getByTestId(/card-group-header-/).first()

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('viewmode.example.com')
  await page.getByLabel('Link title').fill('View child')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  const childCard = page.getByTestId(/link-card-/).filter({
    hasText: 'View child',
  })

  await moveCardIntoGroupBody(page, childCard, groupBody)
  await page.getByRole('button', { name: 'Toggle interaction mode' }).click()

  await groupHeader.click()
  await expect(childCard).toHaveCount(0)

  await groupHeader.click()
  await expect(childCard).toBeVisible()
})

test('collapsing a parent group hides nested child groups and restores them on expand', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await page.getByLabel(/Edit group width for/).fill('14')
  await page.getByLabel(/Edit group height for/).fill('13')
  await dismissVisibleEditPanels(page)

  const groupArticles = page.locator('article[data-testid^="card-group-"]')
  const parentGroup = groupArticles.first()
  const parentGroupBody = page.getByTestId(/card-group-body-/).first()
  const parentCollapseToggle = page
    .getByTestId(/group-collapse-toggle-/)
    .first()

  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  const childGroup = groupArticles.nth(1)
  const childGroupHeader = page.getByTestId(/card-group-header-/).nth(1)
  const childGroupTestId = await childGroup.getAttribute('data-testid')

  if (!childGroupTestId) {
    throw new Error('missing test id for nested child group')
  }

  const nestedChildGroup = page.locator(
    `article[data-testid="${childGroupTestId}"]`,
  )

  await moveGroupIntoGroupBody(page, childGroupHeader, parentGroupBody)
  await expect(nestedChildGroup).toBeVisible()

  await parentCollapseToggle.click()
  await expect(nestedChildGroup).toHaveCount(0)

  await parentCollapseToggle.click()
  await expect(nestedChildGroup).toBeVisible()
  await expect(parentGroup).toBeVisible()
})

test('collapsing a group hides chart and feed nodes inside it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await page.getByLabel(/Edit group width for/).fill('30')
  await page.getByLabel(/Edit group height for/).fill('22')
  await dismissVisibleEditPanels(page)

  const group = page.getByTestId(/card-group-/).first()
  const groupBody = page.getByTestId(/card-group-body-/).first()
  const toggle = page.getByTestId(/group-collapse-toggle-/).first()

  await page.getByRole('button', { name: 'Add chart' }).click()
  const chart = page.getByTestId(/chart-node-/).first()
  const body = await groupBody.boundingBox()

  if (!body) {
    throw new Error('missing group body geometry')
  }

  await moveElementToPoint(page, chart.locator('header'), {
    x: body.x + 220,
    y: body.y + 40,
  })
  await page.mouse.click(10, 10)

  await toggle.click()
  await expect(group).toHaveAttribute('data-collapsed', 'true')
  await expect(chart).toHaveCount(0)

  await toggle.click()
  await expect(group).toHaveAttribute('data-collapsed', 'false')
  await expect(chart).toBeVisible()
})
