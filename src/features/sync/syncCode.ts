import { bytesToBase64 } from './syncCrypto'

/**
 * A sync code is 32 random bytes, written for people: 52 characters in
 * Crockford base32, in groups of four (`lh1-7XK2-…`). Everything a device
 * needs comes from it, so there are no accounts and no passphrase:
 *
 * - the vault id the server files the data under
 * - the access token that proves a device may read and write the vault
 * - the AES key that encrypts everything before it leaves the device
 *
 * Each is derived with HKDF under its own label, so the server, which only
 * sees the vault id and the token, learns nothing about the key.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const PREFIX = 'lh1'
const CODE_BYTES = 32

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

  return new Uint8Array(bytes)
}

export function formatSyncCode(secret: Uint8Array) {
  const groups = encodeBase32(secret).match(/.{1,4}/g) ?? []

  return [PREFIX, ...groups].join('-')
}

/** Reads a typed or pasted code; forgiving about case, spaces and O/0, I/1. */
export function parseSyncCode(input: string) {
  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/^LH[1IL]/, '')
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')

  const secret = decodeBase32(cleaned)

  if (secret.length !== CODE_BYTES) {
    throw new SyncCodeError()
  }

  return secret
}

export function createSyncSecret() {
  return crypto.getRandomValues(new Uint8Array(CODE_BYTES))
}

const encoder = new TextEncoder()

function hex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function base64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export type SyncVaultAccess = {
  vaultId: string
  token: string
  key: CryptoKey
}

export async function deriveSyncVaultAccess(
  secret: Uint8Array,
): Promise<SyncVaultAccess> {
  const material = await crypto.subtle.importKey(
    'raw',
    secret as BufferSource,
    'HKDF',
    false,
    ['deriveBits', 'deriveKey'],
  )
  const params = (label: string) => ({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: new Uint8Array(0),
    info: encoder.encode(`linkhaven sync v1 ${label}`),
  })
  const bits = async (label: string, length: number) =>
    new Uint8Array(
      await crypto.subtle.deriveBits(params(label), material, length),
    )

  return {
    vaultId: hex(await bits('vault id', 128)),
    token: base64Url(await bits('access token', 256)),
    key: await crypto.subtle.deriveKey(
      params('encryption key'),
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    ),
  }
}
