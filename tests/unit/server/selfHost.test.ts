// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// @ts-expect-error -- plain ESM server module without type declarations
import {
  createLinkhavenServer,
  readServerConfig,
} from '../../../server/linkhaven-server.mjs'

describe('self-hosted web app', () => {
  let root: string
  let server: ReturnType<typeof createLinkhavenServer>
  let base: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'linkhaven-selfhost-'))
    const web = join(root, 'web')

    await mkdir(join(web, 'assets'), { recursive: true })
    await mkdir(join(web, 'privacy'), { recursive: true })
    await writeFile(
      join(web, 'index.html'),
      '<!doctype html><html><head><title>Linkhaven</title></head><body></body></html>',
    )
    await writeFile(join(web, 'assets', 'app-1234.js'), 'console.log(1)')
    await writeFile(join(web, 'privacy', 'index.html'), '<p>privacy</p>')
    await writeFile(join(root, 'secret.txt'), 'outside the build')

    server = createLinkhavenServer({
      ...readServerConfig({}),
      dataDir: join(root, 'data'),
      webAppDir: web,
      charts: false,
      idleDays: 0,
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  })

  it('serves the app and tells it which services this server runs', async () => {
    const response = await fetch(`${base}/`)
    const html = await response.text()

    expect(response.headers.get('content-type')).toContain('text/html')
    expect(html).toContain('<meta name="linkhaven-server"')
    expect(
      JSON.parse(
        /content="([^"]+)"/
          .exec(html)![1]
          .replaceAll('&quot;', '"')
          .replaceAll('&amp;', '&'),
      ),
    ).toEqual({ sync: true, newsProxy: true, charts: false })

    const asset = await fetch(`${base}/assets/app-1234.js`)

    expect(asset.headers.get('content-type')).toContain('text/javascript')
    expect(asset.headers.get('cache-control')).toContain('immutable')

    const health = await (await fetch(`${base}/health`)).json()

    expect(health.services.webApp).toBe(true)
  })

  it('redirects folders to their index and keeps files outside private', async () => {
    const folder = await fetch(`${base}/privacy`, { redirect: 'manual' })

    expect(folder.status).toBe(301)
    expect(folder.headers.get('location')).toBe('/privacy/')
    expect(await (await fetch(`${base}/privacy/`)).text()).toContain('privacy')

    for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/nope.js']) {
      expect((await fetch(`${base}${path}`)).status).toBe(404)
    }
  })

  it('lets its own page write to sync, but not other sites', async () => {
    const own = await fetch(`${base}/sync/v1/info`, {
      headers: { origin: base },
    })
    const other = await fetch(`${base}/sync/v1/info`, {
      headers: { origin: 'https://evil.example' },
    })

    // Behind a proxy that rewrites Host, the browser's own word counts.
    const proxied = await fetch(`${base}/sync/v1/info`, {
      headers: {
        origin: 'https://linkhaven.tail1234.ts.net',
        'sec-fetch-site': 'same-origin',
      },
    })
    const crossSite = await fetch(`${base}/sync/v1/info`, {
      headers: {
        origin: 'https://evil.example',
        'sec-fetch-site': 'cross-site',
      },
    })

    expect(proxied.status).toBe(200)
    expect(crossSite.status).toBe(403)
    expect(own.status).toBe(200)
    expect(own.headers.get('access-control-allow-origin')).toBe(base)
    expect(other.status).toBe(403)
  })

  it('runs without a web app build', async () => {
    const bare = createLinkhavenServer({
      ...readServerConfig({}),
      dataDir: join(root, 'data2'),
      webAppDir: join(root, 'missing'),
      charts: false,
      idleDays: 0,
    })

    await new Promise<void>((resolve) => bare.listen(0, '127.0.0.1', resolve))

    const url = `http://127.0.0.1:${(bare.address() as AddressInfo).port}`

    expect((await fetch(`${url}/`)).status).toBe(404)
    expect((await (await fetch(`${url}/health`)).json()).services.webApp).toBe(
      false,
    )
    await new Promise((resolve) => bare.close(resolve))
  })
})
