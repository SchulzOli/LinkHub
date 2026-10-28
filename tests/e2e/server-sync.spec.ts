import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test, type Browser, type Page } from '@playwright/test'

// @ts-expect-error -- plain ESM server module without type declarations
import {
  createLinkhavenServer,
  readServerConfig,
} from '../../server/linkhaven-server.mjs'

import { dismissVisibleEditPanels } from './fixtures'

let server: ReturnType<typeof createLinkhavenServer>
let serverUrl: string
let dataDir: string

test.beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'linkhaven-e2e-sync-'))
  server = createLinkhavenServer({
    ...readServerConfig({}),
    dataDir,
    charts: false,
    idleDays: 0,
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  serverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  await rm(dataDir, { recursive: true, force: true })
})

/** A fresh browser profile: a separate device with its own storage. */
async function openDevice(browser: Browser) {
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('/')

  return page
}

async function openSyncTab(page: Page) {
  await page.getByRole('button', { name: 'Open menu' }).click()

  const menu = page.getByRole('dialog')

  await menu.getByRole('tab', { name: 'Privacy' }).click()
  await page.getByLabel('Device sync').check()
  await menu.getByRole('tab', { name: 'Sync' }).click()
  await page.getByLabel('Sync server address').fill(serverUrl)
}

test.skip(
  ({ isMobile }) => isMobile,
  'Two devices and one server; runs once, on desktop',
)

test('two devices sync through the Linkhaven server with a sync code', async ({
  browser,
}) => {
  // Device A: a card, then create a sync.
  const laptop = await openDevice(browser)

  await laptop.getByRole('button', { name: 'Add link' }).click()
  await laptop.getByLabel('Link URL').fill('docs.example.com')
  await laptop.getByLabel('Link title').fill('Team docs')
  await laptop.getByRole('button', { name: 'Create' }).click()
  await dismissVisibleEditPanels(laptop)

  await openSyncTab(laptop)
  await laptop.getByTestId('sync-create').click()
  await expect(laptop.getByTestId('sync-status')).toContainText('Synced', {
    timeout: 20000,
  })
  await laptop.getByTestId('sync-show-code').click()

  const code = (await laptop.getByTestId('sync-code').textContent())!.trim()

  expect(code).toMatch(/^lh1-/)
  await expect(laptop.getByRole('img', { name: /QR code/ })).toBeVisible()

  // Device B: a wrong code is caught, the right one brings the card over.
  const phone = await openDevice(browser)

  await openSyncTab(phone)
  await phone
    .getByLabel('Sync code')
    .fill(code.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')))
  await phone.getByTestId('sync-join').click()
  await expect(phone.getByTestId('sync-status')).toContainText(
    'no sync for this code',
  )

  await phone.getByLabel('Sync code').fill(code.toLowerCase())
  await phone.getByTestId('sync-join').click()
  await expect(phone.getByTestId('sync-status')).toContainText('Synced', {
    timeout: 20000,
  })
  await phone.keyboard.press('Escape')
  await expect(
    phone.getByTestId(/link-card-/).filter({ hasText: 'Team docs' }),
  ).toHaveCount(1)

  // Removing the server data ends the sync for everyone.
  await phone.getByRole('button', { name: 'Open menu' }).click()
  await phone.getByRole('dialog').getByRole('tab', { name: 'Sync' }).click()
  phone.once('dialog', (dialog) => void dialog.accept())
  await phone.getByTestId('sync-delete-server-data').click()
  await expect(phone.getByTestId('sync-status')).toContainText(
    'deleted the synced data',
  )
  await expect(phone.getByTestId('sync-create')).toBeVisible()
})
