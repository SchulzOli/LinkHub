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
const JOIN = 'J'.repeat(43)
const LAPTOP = { deviceId: 'b'.repeat(32), deviceToken: 'L'.repeat(43) }
const PHONE = { deviceId: 'c'.repeat(32), deviceToken: 'P'.repeat(43) }

function device(base: { deviceId: string; deviceToken: string }) {
  return { ...base, publicKey: 'pk', label: 'encrypted-label' }
}

describe('sync vault store', () => {
  let dataDir: string

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'linkhaven-vaults-'))
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  it('creates a vault with the first device and lets others join', async () => {
    const store = createVaultStore({ dataDir })

    await expect(
      store.registerDevice(VAULT, JOIN, device(PHONE)),
    ).rejects.toMatchObject({ status: 404 })

    await store.registerDevice(VAULT, JOIN, { ...device(LAPTOP), create: true })
    await expect(
      store.registerDevice(VAULT, 'X'.repeat(43), device(PHONE)),
    ).rejects.toMatchObject({ status: 403 })
    await store.registerDevice(VAULT, JOIN, device(PHONE))

    const devices = await store.listDevices(VAULT, LAPTOP.deviceToken)

    expect(
      devices.map((entry: { deviceId: string }) => entry.deviceId),
    ).toEqual([LAPTOP.deviceId, PHONE.deviceId])
  })

  it('gives the join token nothing but the join keyring', async () => {
    const store = createVaultStore({ dataDir })

    await store.registerDevice(VAULT, JOIN, { ...device(LAPTOP), create: true })
    await store.write(
      VAULT,
      'keyring/join',
      LAPTOP.deviceToken,
      Buffer.from('k'),
    )
    await store.write(VAULT, 'state.bin', LAPTOP.deviceToken, Buffer.from('s'))

    expect(
      (await store.read(VAULT, 'keyring/join', JOIN)).data.toString(),
    ).toBe('k')
    await expect(store.read(VAULT, 'state.bin', JOIN)).rejects.toMatchObject({
      status: 403,
    })
    await expect(
      store.write(VAULT, 'state.bin', JOIN, Buffer.from('x')),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('locks a removed device out and retires the old sync code', async () => {
    const store = createVaultStore({ dataDir })

    await store.registerDevice(VAULT, JOIN, { ...device(LAPTOP), create: true })
    await store.registerDevice(VAULT, JOIN, device(PHONE))
    await store.write(
      VAULT,
      `keyring/${PHONE.deviceId}`,
      PHONE.deviceToken,
      Buffer.from('k'),
    )

    expect(
      await store.removeDevice(VAULT, LAPTOP.deviceToken, PHONE.deviceId),
    ).toBe(true)
    await store.setJoinToken(VAULT, LAPTOP.deviceToken, 'N'.repeat(43))

    await expect(
      store.read(VAULT, 'state.bin', PHONE.deviceToken),
    ).rejects.toMatchObject({ status: 403 })
    // The old code can't bring the phone back.
    await expect(
      store.registerDevice(VAULT, JOIN, device(PHONE)),
    ).rejects.toMatchObject({ status: 403 })
    // Its keyring went with it.
    expect(
      await store.read(VAULT, `keyring/${PHONE.deviceId}`, LAPTOP.deviceToken),
    ).toBeNull()
  })

  it('writes only while the ETag still matches', async () => {
    const store = createVaultStore({ dataDir })

    await store.registerDevice(VAULT, JOIN, { ...device(LAPTOP), create: true })

    const token = LAPTOP.deviceToken
    const first = await store.write(
      VAULT,
      'state.bin',
      token,
      Buffer.from('a'),
      {
        ifNoneMatch: '*',
      },
    )

    await expect(
      store.write(VAULT, 'state.bin', token, Buffer.from('b'), {
        ifNoneMatch: '*',
      }),
    ).rejects.toMatchObject({ status: 412 })
    await store.write(VAULT, 'state.bin', token, Buffer.from('b'), {
      ifMatch: first.etag,
    })
    await expect(
      store.write(VAULT, 'state.bin', token, Buffer.from('c'), {
        ifMatch: first.etag,
      }),
    ).rejects.toMatchObject({ status: 412 })
  })

  it('enforces the vault quota and frees space on delete', async () => {
    const store = createVaultStore({ dataDir, maxVaultBytes: 10 })

    await store.registerDevice(VAULT, JOIN, { ...device(LAPTOP), create: true })

    const token = LAPTOP.deviceToken

    await store.write(VAULT, 'images/a.bin', token, Buffer.alloc(6))
    await expect(
      store.write(VAULT, 'images/b.bin', token, Buffer.alloc(6)),
    ).rejects.toMatchObject({ status: 507 })
    await store.remove(VAULT, 'images/a.bin', token)
    await store.write(VAULT, 'images/b.bin', token, Buffer.alloc(6))
  })

  it('removes vaults nobody used for a long time', async () => {
    let now = 1_000_000
    const store = createVaultStore({ dataDir, now: () => now })

    await store.registerDevice(VAULT, JOIN, { ...device(LAPTOP), create: true })
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

  const api = (path: string, token: string, init: RequestInit = {}) =>
    fetch(`${base}/sync/v1/vaults/${VAULT}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, ...init.headers },
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

  it('registers devices and serves their encrypted files', async () => {
    const created = await api('/devices', JOIN, {
      method: 'POST',
      body: JSON.stringify({ ...device(LAPTOP), create: true }),
    })

    expect(created.status).toBe(201)

    const put = await api('/files/state.bin', LAPTOP.deviceToken, {
      method: 'PUT',
      headers: { 'if-none-match': '*' },
      body: new Uint8Array([1, 2, 3]),
    })

    expect(put.status).toBe(201)

    const read = await api('/files/state.bin', LAPTOP.deviceToken)

    expect(read.headers.get('etag')).toBe(put.headers.get('etag'))
    expect([...new Uint8Array(await read.arrayBuffer())]).toEqual([1, 2, 3])
    expect((await api('/files/..%2Fescape', LAPTOP.deviceToken)).status).toBe(
      404,
    )

    const list = await (await api('/devices', LAPTOP.deviceToken)).json()

    expect(list.devices).toMatchObject([
      { deviceId: LAPTOP.deviceId, current: true, label: 'encrypted-label' },
    ])

    expect(
      (await api('', LAPTOP.deviceToken, { method: 'DELETE' })).status,
    ).toBe(204)
    expect((await api('/files/state.bin', LAPTOP.deviceToken)).status).toBe(404)
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
