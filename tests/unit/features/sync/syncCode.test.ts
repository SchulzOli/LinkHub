import { describe, expect, it } from 'vitest'

import {
  createSyncCodeParts,
  deriveJoinAccess,
  formatSyncCode,
  parseSyncCode,
} from '../../../../src/features/sync/syncCode'
import {
  generateDeviceKeyPair,
  keyringCipher,
  openForDevice,
  sealForDevice,
  type SyncKeyring,
} from '../../../../src/features/sync/syncKeys'

describe('sync codes', () => {
  it('round-trips and forgives how people type codes', () => {
    const parts = createSyncCodeParts()
    const code = formatSyncCode(parts)

    expect(code).toMatch(/^lh2(-[0-9A-Z]{1,4}){15}$/)
    expect(parseSyncCode(code).vaultId).toBe(parts.vaultId)
    expect([...parseSyncCode(code).joinSecret]).toEqual([...parts.joinSecret])

    const sloppy = ` ${code.toLowerCase().replace(/-/g, ' ')} `
      .replace(/0/g, 'o')
      .replace(/1/g, 'l')

    expect(parseSyncCode(sloppy).vaultId).toBe(parts.vaultId)
    expect(() => parseSyncCode('lh2-1234')).toThrow()
    expect(() => parseSyncCode(`${code}U`)).toThrow()
  })

  it('derives the same join access from the same code', async () => {
    const parts = createSyncCodeParts()
    const first = await deriveJoinAccess(parts.joinSecret)
    const again = await deriveJoinAccess(new Uint8Array(parts.joinSecret))

    expect(first.joinToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(again.joinToken).toBe(first.joinToken)
  })
})

describe('sync keys', () => {
  it('seals a keyring that only the addressed device can open', async () => {
    const phone = await generateDeviceKeyPair()
    const laptop = await generateDeviceKeyPair()
    const sealed = await sealForDevice(
      phone.publicKey,
      'keyring/phone',
      new TextEncoder().encode('keys'),
    )

    expect(
      new TextDecoder().decode(
        await openForDevice(phone.privateKey, 'keyring/phone', sealed),
      ),
    ).toBe('keys')
    await expect(
      openForDevice(laptop.privateKey, 'keyring/phone', sealed),
    ).rejects.toThrow()
  })

  it('reads files of older epochs and fetches newer keys when needed', async () => {
    const epoch1: SyncKeyring = {
      epoch: 1,
      keys: { 1: crypto.getRandomValues(new Uint8Array(32)) },
      labelKey: new Uint8Array(32),
    }
    const epoch2: SyncKeyring = {
      ...epoch1,
      epoch: 2,
      keys: { ...epoch1.keys, 2: crypto.getRandomValues(new Uint8Array(32)) },
    }
    const writer = keyringCipher({
      getKeyring: () => epoch2,
      refreshKeyring: async () => epoch2,
    })
    let current = epoch1
    const reader = keyringCipher({
      getKeyring: () => current,
      refreshKeyring: async () => (current = epoch2),
    })
    const sealed = await writer.encrypt('state.bin', new Uint8Array([7]))

    expect([...(await reader.decrypt('state.bin', sealed))]).toEqual([7])
    expect(current).toBe(epoch2)

    // A device that only ever had epoch 1 can't read epoch 2 files.
    const removed = keyringCipher({
      getKeyring: () => epoch1,
      refreshKeyring: async () => epoch1,
    })

    await expect(removed.decrypt('state.bin', sealed)).rejects.toThrow()
  })
})
