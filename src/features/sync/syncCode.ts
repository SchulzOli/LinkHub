import { bytesToBase64Url, bytesToHex, randomBytes } from './syncKeys'

/**
 * A sync code lets a new device join a sync on a Linkhaven server: the
 * vault id (16 bytes) and a join secret (20 bytes), written for people in
 * Crockford base32 groups of four (`lh2-7XK2-…`, also shown as a QR code).
 *
 * From the join secret, HKDF derives:
 *
 * - the join token, with which the server lets a device register (and
 *   nothing else)
 * - the join key, which opens the keyring a new device starts from
 *
 * Every device then gets its own token and keys. Removing a device makes
 * a new code, so an old one stops working.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const PREFIX = 'lh2'
const VAULT_ID_BYTES = 16
const JOIN_SECRET_BYTES = 20
const CODE_BYTES = VAULT_ID_BYTES + JOIN_SECRET_BYTES

export class SyncCodeError extends Error {
  constructor() {
    super('That is not a valid sync code.')
    this.name = 'SyncCodeError'
  }
}

function encodeBase32(bytes: Uint8Array) {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

function decodeBase32(text: string) {
  const bytes: number[] = []
  let bits = 0
  let value = 0

  for (const char of text) {
    const index = ALPHABET.indexOf(char)

    if (index < 0) {
      throw new SyncCodeError()
    }

    value = (value << 5) | index
    bits += 5

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  // A canonical code leaves its padding bits zero; anything else is a typo.
  if (bits >= 5 || (value & ((1 << bits) - 1)) !== 0) {
    throw new SyncCodeError()
  }

  return new Uint8Array(bytes)
}

export type SyncCodeParts = { vaultId: string; joinSecret: Uint8Array }

function hexToBytes(hex: string) {
  return new Uint8Array(
    (hex.match(/.{2}/g) ?? []).map((pair) => Number.parseInt(pair, 16)),
  )
}

export function formatSyncCode({ vaultId, joinSecret }: SyncCodeParts) {
  const bytes = new Uint8Array(CODE_BYTES)

  bytes.set(hexToBytes(vaultId), 0)
  bytes.set(joinSecret, VAULT_ID_BYTES)

  const groups = encodeBase32(bytes).match(/.{1,4}/g) ?? []

  return [PREFIX, ...groups].join('-')
}

/** Reads a typed or pasted code; forgiving about case, spaces and O/0, I/1. */
export function parseSyncCode(input: string): SyncCodeParts {
  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/^LH2/, '')
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')

  const bytes = decodeBase32(cleaned)

  if (bytes.length !== CODE_BYTES) {
    throw new SyncCodeError()
  }

  return {
    vaultId: bytesToHex(bytes.slice(0, VAULT_ID_BYTES)),
    joinSecret: bytes.slice(VAULT_ID_BYTES),
  }
}

export function createSyncCodeParts(): SyncCodeParts {
  return {
    vaultId: bytesToHex(randomBytes(VAULT_ID_BYTES)),
    joinSecret: randomBytes(JOIN_SECRET_BYTES),
  }
}

export function createJoinSecret() {
  return randomBytes(JOIN_SECRET_BYTES)
}

const encoder = new TextEncoder()

/** The join token (for the server) and join key (for the join keyring). */
export async function deriveJoinAccess(joinSecret: Uint8Array) {
  const material = await crypto.subtle.importKey(
    'raw',
    joinSecret as BufferSource,
    'HKDF',
    false,
    ['deriveBits', 'deriveKey'],
  )
  const params = (label: string) => ({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: new Uint8Array(0),
    info: encoder.encode(`linkhaven sync v2 ${label}`),
  })

  return {
    joinToken: bytesToBase64Url(
      new Uint8Array(
        await crypto.subtle.deriveBits(params('join token'), material, 256),
      ),
    ),
    joinKey: await crypto.subtle.deriveKey(
      params('join key'),
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    ),
  }
}
