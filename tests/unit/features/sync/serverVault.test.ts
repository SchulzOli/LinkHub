import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createServerTransport,
  SyncDeviceRemovedError,
} from '../../../../src/features/sync/serverTransport'
import {
  createServerSync,
  fetchDeviceKeyring,
  joinServerSync,
  listServerDevices,
  removeServerDevice,
  sessionCipher,
  syncCodeOf,
  type ServerSyncSession,
} from '../../../../src/features/sync/serverVault'
import { keyringCipher } from '../../../../src/features/sync/syncKeys'
// @ts-expect-error -- plain ESM server module without type declarations
import {
  createLinkhavenServer,
  readServerConfig,
} from '../../../../server/linkhaven-server.mjs'

const fetch = globalThis.fetch.bind(globalThis)
const encoder = new TextEncoder()
const decoder = new TextDecoder()

describe('server sync with a device list', () => {
  let dataDir: string
  let server: ReturnType<typeof createLinkhavenServer>
  let serverUrl: string

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'linkhaven-vault-client-'))
    server = createLinkhavenServer({
      ...readServerConfig({}),
      dataDir,
      charts: false,
      newsProxy: false,
      idleDays: 0,
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    serverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
    await rm(dataDir, { recursive: true, force: true })
  })

  const transportOf = (session: ServerSyncSession) =>
    createServerTransport({
      serverUrl,
      vaultId: session.vaultId,
      token: session.deviceToken,
      fetch,
    })

  const cipherOf = (session: ServerSyncSession) =>
    sessionCipher(
      () => session,
      (keyring) => {
        session.keyring = keyring
      },
      fetch,
    )

  it('lets a removed device in nowhere and rotates the code and key', async () => {
    const laptop = await createServerSync({
      serverUrl,
      deviceName: 'Laptop',
      fetch,
    })
    const code = syncCodeOf(laptop.vaultId, laptop.keyring)!
    const phone = await joinServerSync({
      serverUrl,
      code,
      deviceName: 'Phone',
      fetch,
    })
    const tablet = await joinServerSync({
      serverUrl,
      code,
      deviceName: 'Tablet',
      fetch,
    })

    // The laptop writes the state; both others can read it.
    await transportOf(laptop).write(
      'state.bin',
      await cipherOf(laptop).encrypt(
        'state.bin',
        encoder.encode(
          JSON.stringify({
            format: 'linkhaven.sync-state',
            version: 1,
            records: {
              'image:pic': { hash: 'h', updatedAt: '', data: {} },
            },
            secret: 'v1',
          }),
        ),
      ),
    )

    await transportOf(laptop).write(
      'images/pic.bin',
      await cipherOf(laptop).encrypt('images/pic.bin', new Uint8Array([1, 2])),
    )

    const names = (await listServerDevices(laptop, fetch)).map(
      (device) => `${device.name}${device.current ? ' (me)' : ''}`,
    )

    expect(names).toEqual(['Laptop (me)', 'Phone', 'Tablet'])

    // The phone gets lost; the laptop removes it.
    const stolenFile = (await transportOf(phone).read('state.bin'))!
    const phoneOldKeyring = phone.keyring

    laptop.keyring = await removeServerDevice(laptop, phone.deviceId, fetch)

    expect(laptop.keyring.epoch).toBe(2)
    expect(syncCodeOf(laptop.vaultId, laptop.keyring)).not.toBe(code)

    // 1. The server refuses the phone at once.
    await expect(transportOf(phone).read('state.bin')).rejects.toMatchObject({
      status: 403,
    })
    await expect(fetchDeviceKeyring(phone, fetch)).rejects.toBeInstanceOf(
      SyncDeviceRemovedError,
    )

    // 2. The old code can't add it (or anyone) back.
    await expect(
      joinServerSync({ serverUrl, code, deviceName: 'Phone again', fetch }),
    ).rejects.toMatchObject({ status: 404 })

    // 3. Even with the server's files, its old key reads nothing new.
    const reencrypted = (await transportOf(laptop).read('state.bin'))!
    const phoneCipher = keyringCipher({
      getKeyring: () => phoneOldKeyring,
      refreshKeyring: async () => phoneOldKeyring,
    })

    expect(reencrypted.data).not.toEqual(stolenFile.data)
    await expect(
      phoneCipher.decrypt('state.bin', reencrypted.data),
    ).rejects.toThrow()

    // The tablet picks up the new key by itself and keeps syncing.
    const tabletState = JSON.parse(
      decoder.decode(
        await cipherOf(tablet).decrypt('state.bin', reencrypted.data),
      ),
    )

    expect(tabletState.secret).toBe('v1')

    // Images are re-encrypted too.
    const image = (await transportOf(tablet).read('images/pic.bin'))!

    expect([
      ...(await cipherOf(tablet).decrypt('images/pic.bin', image.data)),
    ]).toEqual([1, 2])
    await expect(
      phoneCipher.decrypt('images/pic.bin', image.data),
    ).rejects.toThrow()
    expect(tablet.keyring.epoch).toBe(2)
    expect(syncCodeOf(tablet.vaultId, tablet.keyring)).toBe(
      syncCodeOf(laptop.vaultId, laptop.keyring),
    )

    // And the new code adds a new device.
    const desktop = await joinServerSync({
      serverUrl,
      code: syncCodeOf(laptop.vaultId, laptop.keyring)!,
      deviceName: 'Desktop',
      fetch,
    })

    expect(
      (await listServerDevices(desktop, fetch)).map((device) => device.name),
    ).toEqual(['Laptop', 'Tablet', 'Desktop'])
  })
})
