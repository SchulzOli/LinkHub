import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { expect, test } from '@playwright/test'

// @ts-expect-error -- plain ESM server module without type declarations
import {
  createLinkhavenServer,
  readServerConfig,
} from '../../server/linkhaven-server.mjs'

// The web app as `npm run build:pwa` builds it, served by the server.
const webAppDir = resolve('dist-pwa')

let server: ReturnType<typeof createLinkhavenServer>
let serverUrl: string
let dataDir: string

test.skip(
  ({ isMobile }) => isMobile,
  'One server, one flow; runs once, on desktop',
)
test.skip(
  !process.env.CI && !existsSync(join(webAppDir, 'index.html')),
  'Needs the web app build: npm run build:pwa',
)

test.beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'linkhaven-e2e-selfhost-'))
  server = createLinkhavenServer({
    ...readServerConfig({}),
    dataDir,
    webAppDir,
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

test('a self-hosted server serves the app and syncs it without setup', async ({
  page,
}) => {
  await page.goto(serverUrl)
  await page.getByRole('button', { name: 'Open menu' }).click()

  const menu = page.getByRole('dialog')

  await menu.getByRole('tab', { name: 'Privacy' }).click()
  await page.getByLabel('Device sync').check()
  await menu.getByRole('tab', { name: 'Sync' }).click()

  // This server is the default; nothing to type.
  await expect(
    page.getByRole('button', { name: 'This server' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('sync-server-url')).toHaveText(serverUrl)

  await page.getByTestId('sync-create').click()
  await expect(page.getByTestId('sync-status')).toContainText('Synced', {
    timeout: 20000,
  })

  // Another server can still be entered.
  await page.getByTestId('sync-disconnect').click()
  await expect(page.getByRole('button', { name: 'Self-hosted' })).toBeVisible()
  await page.getByRole('button', { name: 'Self-hosted' }).click()
  await expect(page.getByLabel('Sync server address')).toBeVisible()
})
