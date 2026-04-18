import { expect, test, type Page } from '@playwright/test'

import {
  CANVAS_TEST_ID,
  dismissVisibleEditPanels,
  openGroupEditor,
} from './fixtures'

async function dropPngOnCanvas(page: Page, fileName: string) {
  const canvas = page.getByTestId(CANVAS_TEST_ID)
  const dataTransfer = await page.evaluateHandle((name) => {
    const transfer = new DataTransfer()
    const pngBytes = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
      0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84,
      120, 156, 99, 248, 255, 255, 63, 0, 5, 254, 2, 254, 167, 53, 129, 132, 0,
      0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ])
    const file = new File([pngBytes], name, { type: '' })

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

test('exports and imports the current canvas with bundled images', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('example.com')
  await page.getByLabel('Link title').fill('Example')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  const card = page.getByTestId(/link-card-/).filter({ hasText: 'Example' })
  await expect(card).toHaveCount(1)
  await card.click()

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Templates' }).click()
  await page.getByTestId('open-template-create').click()
  await page.getByLabel('Template name').fill('Data backup template')
  await page.getByRole('button', { name: 'Create template' }).click()
  await expect(page.getByTestId('template-status')).toContainText(
    'Saved template “Data backup template”.',
  )
  await page.keyboard.press('Escape')

  await dropPngOnCanvas(page, 'roundtrip.png')
  await expect(page.getByTestId(/picture-node-/).first()).toBeVisible()

  await dropPngOnCanvas(page, 'gallery-only.png')
  await expect(page.getByTestId(/picture-node-/)).toHaveCount(2)
  await page
    .getByTestId(/picture-node-/)
    .last()
    .getByRole('button', { name: 'Delete' })
    .click({ force: true })
  await expect(page.getByTestId(/picture-node-/)).toHaveCount(1)

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Data' }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('export-canvas-bundle').click()
  const download = await downloadPromise
  const downloadPath = await download.path()

  if (!downloadPath) {
    throw new Error('missing exported canvas bundle path')
  }

  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Templates' }).click()
  const templateRow = page
    .getByTestId('templates-panel')
    .locator('article')
    .filter({ hasText: 'Data backup template' })
    .first()
  await templateRow.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete template' }).click()
  await expect(
    page
      .getByTestId('templates-panel')
      .locator('article')
      .filter({ hasText: 'Data backup template' }),
  ).toHaveCount(0)

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('second.example.com')
  await page.getByLabel('Link title').fill('Second')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  await expect(page.getByTestId(/link-card-/)).toHaveCount(2)

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Data' }).click()
  await page.getByTestId('canvas-import-input').setInputFiles(downloadPath)
  await page.getByRole('button', { name: 'Import bundle' }).click()

  await expect(page.getByTestId(/link-card-/)).toHaveCount(1)
  await expect(page.getByTestId(/link-card-/).first()).toContainText('Example')
  await expect(page.getByTestId(/picture-node-/).first()).toBeVisible()

  await page.getByRole('button', { name: 'Open image gallery' }).click()
  await expect(page.getByRole('heading', { name: 'roundtrip' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'gallery-only' }),
  ).toBeVisible()

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Templates' }).click()
  const restoredTemplate = page
    .getByTestId('templates-panel')
    .locator('article')
    .filter({ hasText: 'Data backup template' })
    .first()

  await expect(restoredTemplate).toBeVisible()
  await restoredTemplate.getByRole('button', { name: 'Insert' }).click()
  await expect(page.getByTestId('template-status')).toContainText(
    'Inserted “Data backup template”.',
  )
  await expect(page.getByTestId(/link-card-/)).toHaveCount(2)

  await page.reload()
  await expect(page.getByTestId(/link-card-/).first()).toContainText('Example')
  await expect(page.getByTestId(/picture-node-/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Templates' }).click()
  await expect(page.getByTestId('templates-panel')).toContainText(
    'Data backup template',
  )
})

test('imports a canvas bundle as a new workspace without replacing the current canvas', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('example.com')
  await page.getByLabel('Link title').fill('Original')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Data' }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('export-canvas-bundle').click()
  const download = await downloadPromise
  const downloadPath = await download.path()

  if (!downloadPath) {
    throw new Error('missing exported canvas bundle path')
  }

  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('current.example.com')
  await page.getByLabel('Link title').fill('Current only')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  await expect(page.getByTestId(/link-card-/)).toHaveCount(2)

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Data' }).click()
  await page.getByTestId('canvas-import-input').setInputFiles(downloadPath)
  await page.getByRole('button', { name: 'Import as new workspace' }).click()

  await expect(page.getByTestId(/link-card-/)).toHaveCount(1)
  await expect(page.getByTestId(/link-card-/).first()).toContainText('Original')

  await page.getByTestId('workspace-rail-toggle').click()
  const workspaceTabs = page.locator('[data-testid^="workspace-tab-"]')
  await expect(workspaceTabs).toHaveCount(2)
  await expect(workspaceTabs.nth(1)).toHaveAttribute('aria-selected', 'true')

  await workspaceTabs.nth(0).click()
  await expect(page.getByTestId(/link-card-/)).toHaveCount(2)
  await expect(
    page.getByTestId(/link-card-/).filter({ hasText: 'Current only' }),
  ).toHaveCount(1)

  await page.getByTestId('workspace-rail-toggle').click()
  await workspaceTabs.nth(1).click()
  await expect(page.getByTestId(/link-card-/)).toHaveCount(1)
  await expect(page.getByTestId(/link-card-/).first()).toContainText('Original')

  await page.reload()
  await expect(page.getByTestId(/link-card-/)).toHaveCount(1)
  await expect(page.getByTestId(/link-card-/).first()).toContainText('Original')
  await page.getByTestId('workspace-rail-toggle').click()
  await expect(page.locator('[data-testid^="workspace-tab-"]')).toHaveCount(2)
})
