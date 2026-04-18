import { expect, test, type Page } from '@playwright/test'

import { dismissVisibleEditPanels } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
  await page.reload()
})

async function createLink(
  page: Page,
  input: {
    title: string
    url: string
  },
) {
  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill(input.url)
  await page.getByLabel('Link title').fill(input.title)
  await page.getByRole('button', { name: /^Create$/ }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)
}

test('creates, switches, and persists multiple workspaces', async ({
  page,
}) => {
  await createLink(page, {
    title: 'Home Card',
    url: 'https://home.example.com',
  })
  await expect(
    page.getByTestId(/link-card-/).filter({ hasText: 'Home Card' }),
  ).toHaveCount(1)

  await page.getByTestId('workspace-rail-toggle').click()
  await expect(page.getByTestId('workspace-rail')).toHaveAttribute(
    'data-open',
    'true',
  )
  await page.getByTestId('create-workspace').click()
  await expect(page.getByRole('tab', { name: 'Board 2' })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  await createLink(page, {
    title: 'Board Two Card',
    url: 'https://board-two.example.com',
  })
  await expect(
    page.getByTestId(/link-card-/).filter({ hasText: 'Board Two Card' }),
  ).toHaveCount(1)

  await page.getByTestId('workspace-rail-toggle').click()
  await page.getByRole('tab', { name: 'Home' }).click()
  await expect(
    page.getByTestId(/link-card-/).filter({ hasText: 'Home Card' }),
  ).toHaveCount(1)
  await expect(
    page.getByTestId(/link-card-/).filter({ hasText: 'Board Two Card' }),
  ).toHaveCount(0)

  await page.getByTestId('workspace-rail-toggle').click()
  await page.getByRole('tab', { name: 'Board 2' }).click()
  await expect(
    page.getByTestId(/link-card-/).filter({ hasText: 'Board Two Card' }),
  ).toHaveCount(1)

  await page.waitForTimeout(350)
  await page.reload()

  await expect(
    page.getByTestId(/link-card-/).filter({ hasText: 'Board Two Card' }),
  ).toHaveCount(1)
  await page.getByTestId('workspace-rail-toggle').click()
  await page.getByRole('tab', { name: 'Home' }).click()
  await expect(
    page.getByTestId(/link-card-/).filter({ hasText: 'Home Card' }),
  ).toHaveCount(1)
})

test('keeps the workspace rail open when pinned', async ({ page }) => {
  await page.getByTestId('workspace-rail-toggle').click()
  await page.getByTestId('workspace-rail-pin').click()
  await expect(page.getByTestId('workspace-rail-pin')).toHaveAttribute(
    'data-state',
    'pinned',
  )
  await expect(page.getByTestId('workspace-rail')).toHaveAttribute(
    'data-pinned',
    'true',
  )

  await page.mouse.click(40, 40)

  await expect(page.getByTestId('workspace-rail')).toHaveAttribute(
    'data-open',
    'true',
  )

  await page.reload()

  await expect(page.getByTestId('workspace-rail')).toHaveAttribute(
    'data-open',
    'true',
  )
  await expect(page.getByTestId('workspace-rail')).toHaveAttribute(
    'data-pinned',
    'true',
  )
})

test('auto-hides the workspace rail on outside click when unpinned', async ({
  page,
}) => {
  await page.getByTestId('workspace-rail-toggle').click()
  await expect(page.getByTestId('workspace-rail-pin')).toHaveAttribute(
    'data-state',
    'auto-hide',
  )
  await expect(page.getByTestId('workspace-rail')).toHaveAttribute(
    'data-open',
    'true',
  )

  await page.mouse.click(40, 40)

  await expect(page.getByTestId('workspace-rail')).toHaveAttribute(
    'data-open',
    'false',
  )
})

test('renames, reorders, and deletes workspaces from the data menu in edit mode', async ({
  page,
}) => {
  await page.getByTestId('workspace-rail-toggle').click()
  await page.getByTestId('create-workspace').click()
  await page.getByTestId('workspace-rail-toggle').click()
  await page.getByTestId('create-workspace').click()

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Data' }).click()

  const boardThreeRow = page
    .getByTestId('workspace-management-list')
    .locator('article')
    .filter({ hasText: 'Board 3' })
    .first()

  await boardThreeRow.getByRole('button', { name: 'Edit' }).click()
  await page.getByTestId('workspace-editor-name').fill('Ideas')
  await page.getByTestId('workspace-editor-save').click()
  await expect(page.getByTestId('workspace-status')).toContainText(
    'Updated workspace “Ideas”.',
  )

  const ideasRow = page
    .getByTestId('workspace-management-list')
    .locator('article')
    .filter({ hasText: 'Ideas' })
    .first()

  await ideasRow.getByRole('button', { name: 'Move left' }).click()
  await expect(page.getByTestId('workspace-status')).toContainText(
    'Moved “Ideas”.',
  )

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByTestId('workspace-rail-toggle').click()

  await expect(
    page.locator('[data-testid^="workspace-tab-"]').nth(0),
  ).toHaveText('Home')
  await expect(
    page.locator('[data-testid^="workspace-tab-"]').nth(1),
  ).toHaveText('Ideas')
  await expect(
    page.locator('[data-testid^="workspace-tab-"]').nth(2),
  ).toHaveText('Board 2')

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Data' }).click()

  const boardTwoRow = page
    .getByTestId('workspace-management-list')
    .locator('article')
    .filter({ hasText: 'Board 2' })
    .first()

  await boardTwoRow.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete workspace' }).click()
  await expect(page.getByTestId('workspace-status')).toContainText(
    'Deleted workspace “Board 2”.',
  )
  await expect(
    page
      .getByTestId('workspace-management-list')
      .locator('article')
      .filter({ hasText: 'Board 2' }),
  ).toHaveCount(0)

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByTestId('workspace-rail-toggle').click()
  await expect(
    page.locator('[data-testid^="workspace-tab-"]').nth(0),
  ).toHaveText('Home')
  await expect(
    page.locator('[data-testid^="workspace-tab-"]').nth(1),
  ).toHaveText('Ideas')
  await expect(page.locator('[data-testid^="workspace-tab-"]')).toHaveCount(2)
  await expect(page.getByRole('tab', { name: 'Board 2' })).toHaveCount(0)
})
