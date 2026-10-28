import { expect, test, type Page } from '@playwright/test'

import { dismissVisibleEditPanels, enableNetworkFeatures } from './fixtures'

const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#ffc230"/></svg>'

async function serveIcons(page: Page) {
  const requested: string[] = []

  await page.route('https://cdn.jsdelivr.net/**', (route) => {
    requested.push(route.request().url())
    return route.fulfill({ contentType: 'image/svg+xml', body: ICON_SVG })
  })
  // Nothing else may be asked about these local addresses.
  await page.route('https://www.google.com/**', (route) => route.abort())

  return requested
}

async function addCard(page: Page, url: string, title: string) {
  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill(url)
  await page.getByLabel('Link title').fill(title)
  await page.getByRole('button', { name: 'Create' }).click()
  await dismissVisibleEditPanels(page)
}

const cardImage = (page: Page, title: string) =>
  page
    .getByTestId(/link-card-/)
    .filter({ hasText: title })
    .getByTestId('card-image')

// The drawn default picture: Google isn't asked about local addresses.
const placeholder = (page: Page, title: string) =>
  page
    .getByTestId(/link-card-/)
    .filter({ hasText: title })
    .getByTestId('card-image-placeholder')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
})

test('a new homelab card gets its app icon', async ({ page }) => {
  await enableNetworkFeatures(page, { appIcons: true, googleFavicons: true })
  const requested = await serveIcons(page)

  await page.reload()
  await addCard(page, '192.168.1.20:7878', 'Radarr')

  await expect(cardImage(page, 'Radarr')).toHaveAttribute('src', /^blob:/)
  expect(requested).toEqual([
    'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/radarr.svg',
  ])
})

test('Find app icons gives existing cards their icon', async ({ page }) => {
  await enableNetworkFeatures(page, { googleFavicons: true })
  const requested = await serveIcons(page)

  await page.reload()
  await addCard(page, '192.168.1.20:8096', 'Jellyfin')
  await addCard(page, 'jellyfin.example.com', 'Jellyfin (remote)')
  await addCard(page, '192.168.1.30:3000', 'Schaltzentrale')

  // Off: nothing requested, and Google isn't asked about local addresses.
  expect(requested).toEqual([])
  await expect(placeholder(page, 'Schaltzentrale')).toBeVisible()

  await page.getByRole('button', { name: 'Open menu' }).click()

  const menu = page.getByRole('dialog')

  await menu.getByRole('tab', { name: 'Privacy' }).click()
  await page.getByLabel('App icons').check()
  await menu.getByRole('tab', { name: 'Data' }).click()
  await page.getByTestId('find-app-icons').click()
  await expect(menu.getByText('2 of 3 cards got an app icon')).toBeVisible()

  // One request serves both Jellyfin cards.
  expect(requested).toEqual([
    'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/jellyfin.svg',
  ])
  await page.keyboard.press('Escape')
  await expect(cardImage(page, 'Jellyfin (remote)')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await expect(placeholder(page, 'Schaltzentrale')).toBeVisible()
})
