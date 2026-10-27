import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import { dismissVisibleEditPanels } from './fixtures'

const REMOTE = 'https://home.remote.test/'

async function addCardWithLocalLink(page: Page, localUrl: string) {
  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill(REMOTE)
  await page.getByLabel('Link title').fill('Home Assistant')
  await page.getByRole('button', { name: 'Create' }).click()

  const panel = page.getByTestId('card-edit-panel')

  await expect(panel).toBeVisible()
  await panel.getByLabel(/Edit local url for/).fill(localUrl)
  await dismissVisibleEditPanels(page)
  await page.getByRole('button', { name: 'Toggle interaction mode' }).click()

  return page.getByTestId(/link-card-/).filter({ hasText: 'Home Assistant' })
}

async function openedUrl(context: BrowserContext, click: () => Promise<void>) {
  const pagePromise = context.waitForEvent('page')

  await click()

  const opened = await pagePromise

  await expect.poll(() => opened.url()).not.toBe('about:blank')

  return opened.url()
}

test.beforeEach(async ({ page, context }, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chrome',
    'Same logic on every device; run once',
  )
  await context.route(`${REMOTE}**`, (route) =>
    route.fulfill({ body: 'remote', contentType: 'text/plain' }),
  )
  await page.goto('/')
})

test('opens the local link when it answers', async ({ page, context }) => {
  // The app's own server stands in for a device on the local network.
  const local = new URL('/privacy/', page.url()).toString()
  const card = await addCardWithLocalLink(page, local)

  expect(await openedUrl(context, () => card.locator('a').click())).toBe(local)
})

test('opens the main link when the local one does not answer', async ({
  page,
  context,
}) => {
  // Nothing listens on port 9 (discard).
  const card = await addCardWithLocalLink(page, '127.0.0.1:9')

  expect(await openedUrl(context, () => card.locator('a').click())).toBe(REMOTE)
})

test('keeps the local link after a reload', async ({ page }) => {
  await addCardWithLocalLink(page, '192.168.1.10:8123')
  await page.waitForTimeout(600)
  await page.reload()
  await page.getByRole('button', { name: 'Toggle interaction mode' }).click()

  const card = page.getByTestId(/link-card-/).first()

  await card.hover()
  await card.getByRole('button', { name: 'Update' }).click()

  await expect(page.getByLabel(/Edit local url for/)).toHaveValue(
    'http://192.168.1.10:8123/',
  )
})
