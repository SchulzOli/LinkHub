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

test.skip(
  ({ isMobile }) => isMobile,
  'Two devices and one server; runs once, on desktop',
)

test.beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'linkhaven-e2e-scope-'))
  server = createLinkhavenServer({
    ...readServerConfig({}),
    dataDir,
    charts: false,
    webApp: false,
    idleDays: 0,
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  serverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(async () => {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  await rm(dataDir, { recursive: true, force: true })
})

async function openDevice(browser: Browser) {
  const page = await (await browser.newContext()).newPage()

  await page.goto('/')

  return page
}

async function addCard(page: Page, url: string, title: string) {
  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill(url)
  await page.getByLabel('Link title').fill(title)
  await page.getByRole('button', { name: 'Create' }).click()
  await dismissVisibleEditPanels(page)
}

async function openSyncTab(page: Page, deviceName: string) {
  await page.getByRole('button', { name: 'Open menu' }).click()

  const menu = page.getByRole('dialog')

  await menu.getByRole('tab', { name: 'Privacy' }).click()
  await page.getByLabel('Device sync').check()
  await menu.getByRole('tab', { name: 'Sync' }).click()
  await page.getByLabel('Sync server address').fill(serverUrl)
  await page.getByLabel('Device name').fill(deviceName)
}

const card = (page: Page, title: string) =>
  page.getByTestId(/link-card-/).filter({ hasText: title })

test('a work computer syncs only the workspace it is given', async ({
  browser,
}) => {
  test.setTimeout(90_000)

  // The laptop: a homelab card on Home, a work card on Board 2.
  const laptop = await openDevice(browser)

  await addCard(laptop, '192.168.1.5:8096', 'Jellyfin')
  await laptop.getByTestId('workspace-rail-toggle').click()
  await laptop.getByTestId('create-workspace').click()
  await addCard(laptop, 'jira.example.com', 'Jira')
  await laptop.getByTestId('workspace-rail-toggle').click()

  await openSyncTab(laptop, 'Laptop')
  await laptop.getByTestId('sync-create').click()
  await expect(laptop.getByTestId('sync-status')).toContainText('Synced', {
    timeout: 20000,
  })
  await laptop.getByTestId('sync-show-code').click()

  const code = (await laptop.getByTestId('sync-code').textContent())!.trim()

  // The work computer joins and chooses before anything arrives.
  const office = await openDevice(browser)

  await addCard(office, 'intranet.example.com', 'Intranet')
  await openSyncTab(office, 'Office')
  await office.getByLabel('Only workspaces I choose').check()
  await office.getByLabel('Sync code').fill(code)
  await office.getByTestId('sync-join').click()
  await expect(office.getByTestId('sync-status')).toContainText(
    /Synced|Up to date/,
    { timeout: 20000 },
  )

  // Nothing came over; it can pick from the sync's workspaces.
  await expect(office.getByLabel('Sync Board 2')).not.toBeChecked()
  await office.getByLabel('Sync Board 2').check()
  await expect(office.getByTestId('sync-status')).toContainText('received', {
    timeout: 20000,
  })
  await office.keyboard.press('Escape')
  await expect(card(office, 'Jellyfin')).toHaveCount(0)
  await office.getByTestId('workspace-rail-toggle').click()
  await office.getByRole('tab', { name: 'Board 2' }).click()
  await expect(card(office, 'Jira')).toHaveCount(1)

  // A change at work reaches the laptop; the office's own Home doesn't.
  await addCard(office, 'confluence.example.com', 'Confluence')
  await office.getByRole('button', { name: 'Open menu' }).click()
  await office.getByRole('dialog').getByRole('tab', { name: 'Sync' }).click()
  await office.getByTestId('sync-now').click()
  await expect(office.getByTestId('sync-status')).toContainText(
    /Synced|Up to date/,
  )

  await laptop.getByTestId('sync-now').click()
  await expect(laptop.getByTestId('sync-status')).toContainText('received', {
    timeout: 20000,
  })
  await laptop.keyboard.press('Escape')
  await expect(card(laptop, 'Confluence')).toHaveCount(1)
  await laptop.getByTestId('workspace-rail-toggle').click()
  await expect(laptop.getByRole('tab', { name: 'Home' })).toHaveCount(1)
  await laptop.getByRole('tab', { name: 'Home' }).click()
  await expect(card(laptop, 'Jellyfin')).toHaveCount(1)
  await expect(card(laptop, 'Intranet')).toHaveCount(0)
})
