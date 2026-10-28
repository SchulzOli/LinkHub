import { expect, test, type BrowserContext } from '@playwright/test'

const FOLDER = 'https://dav.sync.test/me/Linkhaven/'

/** A minimal WebDAV server, answered inside the test run. */
async function routeWebDav(context: BrowserContext) {
  const files = new Map<string, { body: Buffer; etag: string }>()
  let revision = 0

  await context.route('https://dav.sync.test/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, MKCOL, OPTIONS',
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, If-Match, If-None-Match',
      'Access-Control-Expose-Headers': 'ETag',
    }
    const file = files.get(path)

    switch (request.method()) {
      case 'OPTIONS':
        return route.fulfill({ status: 204, headers: cors })
      case 'MKCOL':
        return route.fulfill({ status: 201, headers: cors })
      case 'GET':
        return file
          ? route.fulfill({
              status: 200,
              body: file.body,
              headers: { ...cors, ETag: file.etag },
            })
          : route.fulfill({ status: 404, headers: cors })
      case 'PUT': {
        const ifMatch = request.headers()['if-match']

        if (ifMatch && file?.etag !== ifMatch) {
          return route.fulfill({ status: 412, headers: cors })
        }

        revision += 1
        files.set(path, {
          body: request.postDataBuffer() ?? Buffer.alloc(0),
          etag: `"${revision}"`,
        })

        return route.fulfill({ status: 201, headers: cors })
      }
      default:
        return route.fulfill({ status: 405, headers: cors })
    }
  })

  return files
}

test('sets up device sync from Privacy and the Sync tab', async ({
  page,
  context,
}) => {
  const files = await routeWebDav(context)

  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()

  const menu = page.getByRole('dialog')

  // No Sync tab until Device sync is turned on.
  await expect(menu.getByRole('tab', { name: 'Sync' })).toHaveCount(0)
  await menu.getByRole('tab', { name: 'Privacy' }).click()
  await page.getByLabel('Device sync').check()
  await menu.getByRole('tab', { name: 'Sync' }).click()
  await page.getByRole('button', { name: 'WebDAV folder' }).click()

  await page.getByLabel('WebDAV folder address').fill(FOLDER)
  await page.getByLabel('Sync user name').fill('me')
  await page.getByLabel('Sync app password').fill('secret')
  await page.getByLabel('Sync passphrase').fill('correct horse battery')
  await page.getByTestId('sync-connect').click()

  await expect(page.getByTestId('sync-status')).toContainText('Synced', {
    timeout: 20000,
  })
  await expect(page.getByTestId('sync-now')).toBeVisible()
  expect([...files.keys()].sort()).toEqual([
    '/me/Linkhaven/linkhaven-sync.json',
    '/me/Linkhaven/state.bin',
  ])

  // Settings survive a reload; turning the switch off hides the tab.
  await page.reload()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await menu.getByRole('tab', { name: 'Sync' }).click()
  await expect(page.getByTestId('sync-now')).toBeVisible()
  await menu.getByRole('tab', { name: 'Privacy' }).click()
  await page.getByLabel('Device sync').uncheck()
  await expect(menu.getByRole('tab', { name: 'Sync' })).toHaveCount(0)
})
