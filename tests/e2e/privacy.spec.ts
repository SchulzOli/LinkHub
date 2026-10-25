import { expect, test, type Page } from '@playwright/test'

import { dismissVisibleEditPanels } from './fixtures'

async function addLink(page: Page, url: string, title: string) {
  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill(url)
  await page.getByLabel('Link title').fill(title)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)
}

test('works as a pure, fully local link dashboard out of the box', async ({
  page,
}) => {
  const requests: string[] = []

  // Listen before the first load, so requests made at startup count too.
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('/')

  // Only link, group and image tools: no chart or feed buttons.
  await expect(page.getByRole('button', { name: 'Add link' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add chart' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add news feed' })).toHaveCount(
    0,
  )

  // No Auto tab either: browser data is never read.
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(
    page.getByRole('dialog').getByRole('tab', { name: 'Auto' }),
  ).toHaveCount(0)
  await page.keyboard.press('Escape')

  // A link card shows its letter: no icon is fetched from anywhere.
  await addLink(page, 'offline.example.com', 'Offline')
  await expect(
    page
      .getByTestId(/link-card-/)
      .filter({ hasText: 'Offline' })
      .getByTestId('card-image-placeholder'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Privacy' }).click()
  await expect(page.getByTestId('privacy-summary')).toHaveText('Fully local')

  for (const key of [
    'siteFavicons',
    'googleFavicons',
    'chartsAndFeeds',
    'linkCheck',
    'autoDashboard',
    'aiArrangement',
  ]) {
    await expect(page.getByTestId(`privacy-status-${key}`)).toContainText('Off')
  }

  await page.getByRole('tab', { name: 'Data' }).click()
  await expect(page.getByTestId('check-links')).toBeDisabled()

  // Only the app itself was loaded: no other host was contacted.
  const appOrigin = new URL(page.url()).origin

  expect(
    requests.filter(
      (url) => !url.startsWith(appOrigin) && !url.startsWith('data:'),
    ),
  ).toEqual([])
})

test('turns each network feature on separately and keeps the choice', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Privacy' }).click()

  await page.getByLabel('Charts and news feeds').check()
  await expect(page.getByTestId('privacy-summary')).toHaveText('1 of 6 on')
  await expect(page.getByTestId('privacy-status-chartsAndFeeds')).toContainText(
    'On',
  )
  await page.getByLabel('Link check').check()
  await expect(page.getByTestId('privacy-summary')).toHaveText('2 of 6 on')
  await page.keyboard.press('Escape')

  await expect(page.getByRole('button', { name: 'Add chart' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Add news feed' }),
  ).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Privacy' }).click()
  await expect(page.getByLabel('Charts and news feeds')).toBeChecked()
  await expect(page.getByLabel('Link check')).toBeChecked()
  await expect(page.getByLabel('Website icons')).not.toBeChecked()
  await expect(page.getByLabel('Google favicons')).not.toBeChecked()
})

test('loads website icons only after they are turned on', async ({
  page,
  context,
}) => {
  // Answered locally, so no real request leaves the test run.
  await context.route('https://en.wikipedia.org/**', (route) =>
    route.fulfill({ status: 404, body: '' }),
  )
  await page.goto('/')
  await addLink(page, 'en.wikipedia.org', 'Wiki')

  const card = page.getByTestId(/link-card-/).filter({ hasText: 'Wiki' })

  // Off: only the letter, no image element that could load anything.
  await expect(card.getByTestId('card-image-placeholder')).toBeVisible()
  await expect(card.getByTestId('card-image')).toHaveCount(0)

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Privacy' }).click()
  await page.getByLabel('Website icons').check()
  await page.keyboard.press('Escape')

  // On: the card tries the site's icon; this one has none and Google is
  // off, so it ends on its letter again.
  const image = card.getByTestId('card-image')

  await expect(image).toHaveCount(1)
  await expect(image).toHaveAttribute('src', /^data:/)
  await expect(card.getByTestId('card-image-placeholder')).toHaveCount(0)
})
