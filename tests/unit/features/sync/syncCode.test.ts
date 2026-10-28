import { describe, expect, it } from 'vitest'

import {
  createSyncSecret,
  deriveSyncVaultAccess,
  formatSyncCode,
  parseSyncCode,
} from '../../../../src/features/sync/syncCode'
import {
  decryptSyncBytes,
  encryptSyncBytes,
} from '../../../../src/features/sync/syncCrypto'

describe('sync codes', () => {
  it('round-trips and forgives how people type codes', () => {
    const secret = createSyncSecret()
    const code = formatSyncCode(secret)

    expect(code).toMatch(/^lh1(-[0-9A-Z]{1,4}){13}$/)
    expect([...parseSyncCode(code)]).toEqual([...secret])

    const sloppy = ` ${code.toLowerCase().replace(/-/g, ' ')} `
      .replace(/0/g, 'o')
      .replace(/1/g, 'l')

    expect([...parseSyncCode(sloppy)]).toEqual([...secret])
    expect(() => parseSyncCode('lh1-1234')).toThrow()
    expect(() => parseSyncCode(`${code}U`)).toThrow()
  })

  it('derives the same vault on every device and separate keys per code', async () => {
    const secret = createSyncSecret()
    const first = await deriveSyncVaultAccess(secret)
    const again = await deriveSyncVaultAccess(new Uint8Array(secret))
    const other = await deriveSyncVaultAccess(createSyncSecret())

    expect(first.vaultId).toMatch(/^[a-f0-9]{32}$/)
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(again.vaultId).toBe(first.vaultId)
    expect(again.token).toBe(first.token)
    expect(other.vaultId).not.toBe(first.vaultId)
    // The token the server sees is not the key that encrypts.
    expect(first.token).not.toContain(first.vaultId)

    const sealed = await encryptSyncBytes(
      first.key,
      'state.bin',
      new TextEncoder().encode('secret'),
    )

    expect(
      new TextDecoder().decode(
        await decryptSyncBytes(again.key, 'state.bin', sealed),
      ),
    ).toBe('secret')
    await expect(
      decryptSyncBytes(other.key, 'state.bin', sealed),
    ).rejects.toThrow()
  })
})
