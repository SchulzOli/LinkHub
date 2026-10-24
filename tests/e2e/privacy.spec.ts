import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('starts fully local and turns each network feature on separately', async ({
  page,
}) => {
  const requests: string[] = []

  page.on('request', (request) => requests.push(request.url()))

  // Off by default: nothing that would reach the network can be added.
  await expect(page.getByRole('button', { name: 'Add chart' })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Add news feed' }),
  ).toBeDisabled()

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Privacy' }).click()
  await expect(page.getByTestId('privacy-summary')).toHaveText('Fully local')
  await expect(page.getByTestId('privacy-status-googleFavicons')).toContainText(
    'Off',
  )
  await expect(page.getByTestId('privacy-status-chartsAndFeeds')).toContainText(
    'Off · no connections',
  )
  await expect(page.getByTestId('privacy-status-linkCheck')).toContainText(
    'Off',
  )

  await page.getByRole('tab', { name: 'Data' }).click()
  await expect(page.getByTestId('check-links')).toBeDisabled()

  await page.getByRole('tab', { name: 'Privacy' }).click()
  await page.getByLabel('Charts and news feeds').check()
  await expect(page.getByTestId('privacy-summary')).toHaveText('1 of 3 on')
  await expect(page.getByTestId('privacy-status-chartsAndFeeds')).toContainText(
    'On',
  )
  await page.getByLabel('Link check').check()
  await expect(page.getByTestId('privacy-summary')).toHaveText('2 of 3 on')
  await page.keyboard.press('Escape')

  await expect(page.getByRole('button', { name: 'Add chart' })).toBeEnabled()

  // The choice survives a reload.
  await page.reload()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Privacy' }).click()
  await expect(page.getByLabel('Charts and news feeds')).toBeChecked()
  await expect(page.getByLabel('Link check')).toBeChecked()
  await expect(page.getByLabel('Google favicons')).not.toBeChecked()

  // Only the app itself was loaded: no third-party host was contacted.
  const appOrigin = new URL(page.url()).origin

  expect(
    requests.filter(
      (url) => !url.startsWith(appOrigin) && !url.startsWith('data:'),
    ),
  ).toEqual([])
})
