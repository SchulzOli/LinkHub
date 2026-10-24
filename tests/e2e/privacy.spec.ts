import { expect, test } from '@playwright/test'

test('starts fully local and turns each network feature on separately', async ({
  page,
}) => {
  const requests: string[] = []

  // Listen before the first load, so requests made at startup count too.
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('/')

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

test('shows the letter placeholder when a site has no favicon and Google is off', async ({
  page,
  context,
}) => {
  await context.route('https://nofavicon.example.com/**', (route) =>
    route.fulfill({ status: 404, body: '' }),
  )
  await page.goto('/')

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('nofavicon.example.com')
  await page.getByLabel('Link title').fill('No icon')
  await page.getByRole('button', { name: 'Create' }).click()

  const image = page
    .getByTestId(/link-card-/)
    .filter({ hasText: 'No icon' })
    .locator('img')
    .first()

  await expect(image).toHaveAttribute('src', /^data:/)
})
