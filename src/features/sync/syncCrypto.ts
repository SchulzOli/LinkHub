/**
 * End-to-end encryption for device sync. Everything is encrypted on the
 * device with a key derived from the user's sync passphrase before it is
 * uploaded; the storage provider only ever sees ciphertext.
 *
 * File layout: "LHS1" | flags (1 byte, bit 0 = gzip) | IV (12 bytes) |
 * AES-GCM ciphertext. The file's path is bound in as additional data, so
 * a file can't be swapped for another one on the server unnoticed.
 */

const MAGIC = [0x4c, 0x48, 0x53, 0x31] // "LHS1"
const FLAG_GZIP = 1
const IV_BYTES = 12
const HEADER_BYTES = MAGIC.length + 1 + IV_BYTES

export const SYNC_KDF_ITERATIONS = 600_000
const KEY_CHECK_PATH = 'linkhaven-sync-check'
const KEY_CHECK_TEXT = 'linkhaven-sync-key-check'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export class SyncDecryptError extends Error {
  constructor() {
    super('The sync data could not be decrypted.')
    this.name = 'SyncDecryptError'
  }
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

export function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export function createSyncSalt() {
  return crypto.getRandomValues(new Uint8Array(16))
}

/** A non-extractable AES key; it can be stored in IndexedDB as is. */
export async function deriveSyncKey(
  passphrase: string,
  salt: Uint8Array,
  iterations = SYNC_KDF_ITERATIONS,
) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function transform(bytes: Uint8Array, stream: GenericTransformStream) {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  const response = new Response(source.pipeThrough(stream))

  return new Uint8Array(await response.arrayBuffer())
}

function canCompress() {
  return (
    typeof CompressionStream !== 'undefined' &&
    typeof DecompressionStream !== 'undefined'
  )
}

export async function encryptSyncBytes(
  key: CryptoKey,
  path: string,
  plain: Uint8Array,
  options: { compress?: boolean } = {},
) {
  const compress = (options.compress ?? true) && canCompress()
  const payload = compress
    ? await transform(plain, new CompressionStream('gzip'))
    : plain
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: encoder.encode(path),
      },
      key,
      payload as BufferSource,
    ),
  )
  const output = new Uint8Array(HEADER_BYTES + cipher.length)

  output.set(MAGIC, 0)
  output[MAGIC.length] = compress ? FLAG_GZIP : 0
  output.set(iv, MAGIC.length + 1)
  output.set(cipher, HEADER_BYTES)

  return output
}

export async function decryptSyncBytes(
  key: CryptoKey,
  path: string,
  data: Uint8Array,
) {
  if (
    data.length < HEADER_BYTES ||
    MAGIC.some((byte, index) => data[index] !== byte)
  ) {
    throw new SyncDecryptError()
  }

  const flags = data[MAGIC.length]
  const iv = data.slice(MAGIC.length + 1, HEADER_BYTES)
  let plain: Uint8Array

  try {
    plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: encoder.encode(path) },
        key,
        data.slice(HEADER_BYTES),
      ),
    )
  } catch {
    throw new SyncDecryptError()
  }

  if (flags & FLAG_GZIP) {
    if (!canCompress()) {
      throw new SyncDecryptError()
    }

    return transform(plain, new DecompressionStream('gzip'))
  }

  return plain
}

/** Stored next to the salt, so a wrong passphrase is caught at once. */
export async function createSyncKeyCheck(key: CryptoKey) {
  return bytesToBase64(
    await encryptSyncBytes(
      key,
      KEY_CHECK_PATH,
      encoder.encode(KEY_CHECK_TEXT),
      {
        compress: false,
      },
    ),
  )
}

export async function verifySyncKeyCheck(key: CryptoKey, check: string) {
  try {
    const plain = await decryptSyncBytes(
      key,
      KEY_CHECK_PATH,
      base64ToBytes(check),
    )

    return decoder.decode(plain) === KEY_CHECK_TEXT
  } catch {
    return false
  }
}
