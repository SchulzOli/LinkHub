// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// @ts-expect-error -- plain ESM server module without type declarations
import {
  createLinkhavenServer,
  readServerConfig,
} from '../../../server/linkhaven-server.mjs'
// @ts-expect-error -- plain ESM server module without type declarations
import { createVaultStore } from '../../../server/sync/vaultStore.mjs'

const VAULT = 'a'.repeat(32)
const TOKEN = 'T'.repeat(43)
const OTHER_TOKEN = 'U'.repeat(43)

describe('sync vault store', () => {
  let dataDir: string

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'linkhaven-vaults-'))
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  it('claims a vault with its first token and refuses others', async () => {
    const store = createVaultStore({ dataDir })

    await store.write(VAULT, 'state.bin', TOKEN, Buffer.from('one'))

    await expect(
      store.read(VAULT, 'state.bin', OTHER_TOKEN),
    ).rejects.toMatchObject({ status: 403 })
    expect((await store.read(VAULT, 'state.bin', TOKEN)).data.toString()).toBe(
      'one',
    )
  })

  it('writes only while the ETag still matches', async () => {
    const store = createVaultStore({ dataDir })
    const first = await store.write(
      VAULT,
      'state.bin',
      TOKEN,
      Buffer.from('a'),
      {
        ifNoneMatch: '*',
      },
    )

    await expect(
      store.write(VAULT, 'state.bin', TOKEN, Buffer.from('b'), {
        ifNoneMatch: '*',
      }),
    ).rejects.toMatchObject({ status: 412 })

    await store.write(VAULT, 'state.bin', TOKEN, Buffer.from('b'), {
      ifMatch: first.etag,
    })
    await expect(
      store.write(VAULT, 'state.bin', TOKEN, Buffer.from('c'), {
        ifMatch: first.etag,
      }),
    ).rejects.toMatchObject({ status: 412 })
  })

  it('enforces the vault quota and frees space on delete', async () => {
    const store = createVaultStore({ dataDir, maxVaultBytes: 10 })

    await store.write(VAULT, 'images/a.bin', TOKEN, Buffer.alloc(6))
    await expect(
      store.write(VAULT, 'images/b.bin', TOKEN, Buffer.alloc(6)),
    ).rejects.toMatchObject({ status: 507 })

    await store.remove(VAULT, 'images/a.bin', TOKEN)
    await store.write(VAULT, 'images/b.bin', TOKEN, Buffer.alloc(6))
  })

  it('removes vaults nobody used for a long time', async () => {
    let now = 1_000_000
    const store = createVaultStore({ dataDir, now: () => now })

    await store.write(VAULT, 'state.bin', TOKEN, Buffer.from('x'))
    now += 10_000

    expect(await store.removeIdleVaults(60_000)).toBe(0)
    now += 60_000
    expect(await store.removeIdleVaults(60_000)).toBe(1)
    expect(await store.exists(VAULT)).toBe(false)
  })
})

describe('Linkhaven server', () => {
  let dataDir: string
  let server: ReturnType<typeof createLinkhavenServer>
  let base: string

  const api = (path: string, init: RequestInit = {}) =>
    fetch(`${base}/sync/v1/vaults/${VAULT}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${TOKEN}`, ...init.headers },
    })

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'linkhaven-server-'))
    server = createLinkhavenServer({
      ...readServerConfig({}),
      dataDir,
      charts: false,
      idleDays: 0,
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
    await rm(dataDir, { recursive: true, force: true })
  })

  it('stores and returns encrypted files with ETags', async () => {
    const created = await api('/files/state.bin', {
      method: 'PUT',
      headers: { 'if-none-match': '*' },
      body: new Uint8Array([1, 2, 3]),
    })

    expect(created.status).toBe(201)

    const etag = created.headers.get('etag')!
    const read = await api('/files/state.bin')

    expect(read.headers.get('etag')).toBe(etag)
    expect([...new Uint8Array(await read.arrayBuffer())]).toEqual([1, 2, 3])

    const stale = await api('/files/state.bin', {
      method: 'PUT',
      headers: { 'if-match': '"stale"' },
      body: new Uint8Array([4]),
    })

    expect(stale.status).toBe(412)
    expect((await api('/files/missing.bin')).status).toBe(404)
    expect((await api('/files/..%2Fescape')).status).toBe(404)
    expect(
      (await fetch(`${base}/sync/v1/vaults/${VAULT}/files/state.bin`)).status,
    ).toBe(401)

    expect((await api('', { method: 'DELETE' })).status).toBe(204)
    expect((await api('/files/state.bin')).status).toBe(404)
  })

  it('answers Linkhaven pages and refuses other sites', async () => {
    const preflight = await fetch(`${base}/sync/v1/info`, {
      method: 'OPTIONS',
      headers: { origin: 'https://schulzoli.github.io' },
    })

    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe(
      'https://schulzoli.github.io',
    )
    expect(preflight.headers.get('access-control-expose-headers')).toBe('etag')

    const foreign = await fetch(`${base}/sync/v1/info`, {
      headers: { origin: 'https://evil.example' },
    })

    expect(foreign.status).toBe(403)

    const health = await (await fetch(`${base}/health`)).json()

    expect(health.services).toEqual({
      sync: true,
      newsProxy: true,
      charts: false,
    })
  })
})
