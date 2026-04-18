import { expect, test } from '@playwright/test'

test('shows only the taskbar and onboarding on an empty board', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByTestId('bottom-taskbar')).toBeVisible()
  await expect(page.getByTestId('empty-canvas-guide')).toBeVisible()
  await expect(page.getByTestId('infinite-canvas')).toBeVisible()
})
