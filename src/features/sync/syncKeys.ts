import {
  base64ToBytes,
  bytesToBase64,
  decryptSyncBytes,
  encryptSyncBytes,
  SyncDecryptError,
} from './syncCrypto'

/**
 * Keys for sync through a Linkhaven server, where devices can be removed:
 *
 * - The data is encrypted with a **data key**. Each key has an epoch
 *   number; removing a device starts a new epoch with a new key, and every
 *   file says which epoch encrypted it ("LHS2" files).
 * - Every device has its own **ECDH key pair**. The current keys travel to
 *   each device in its own **keyring**, sealed to that device's public key,
 *   so only that device can open it. A removed device gets no new keyring.
 * - The sync code's **join key** seals one more keyring for devices that
 *   are still to join.
 */

/** A device's view of the vault's keys. Raw key bytes, never sent plainly. */
export type SyncKeyring = {
  /** The epoch new files are encrypted with. */
  epoch: number
  /** Data keys by epoch: the current one and the one before it. */
  keys: Record<number, Uint8Array>
  /** Encrypts device names; it never changes. */
  labelKey: Uint8Array
  /** The current sync code's secret (absent in the join keyring). */
  joinSecret?: Uint8Array
}

export type SyncCipher = {
  encrypt: (path: string, plain: Uint8Array) => Promise<Uint8Array>
  decrypt: (path: string, data: Uint8Array) => Promise<Uint8Array>
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length))
}

export function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function bytesToBase64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function importAesKey(raw: Uint8Array) {
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** One fixed key (WebDAV): the "LHS1" format. */
export function singleKeyCipher(key: CryptoKey): SyncCipher {
  return {
    encrypt: (path, plain) => encryptSyncBytes(key, path, plain),
    decrypt: (path, data) => decryptSyncBytes(key, path, data),
  }
}

// "LHS2" | epoch (uint32, big endian) | an "LHS1" body bound to path+epoch
const EPOCH_MAGIC = [0x4c, 0x48, 0x53, 0x32]
const EPOCH_HEADER_BYTES = EPOCH_MAGIC.length + 4

function epochPath(path: string, epoch: number) {
  return `${path}#epoch=${epoch}`
}

export function readFileEpoch(data: Uint8Array) {
  if (
    data.length < EPOCH_HEADER_BYTES ||
    EPOCH_MAGIC.some((byte, index) => data[index] !== byte)
  ) {
    throw new SyncDecryptError()
  }

  return new DataView(data.buffer, data.byteOffset + 4, 4).getUint32(0)
}

/**
 * Encrypts with the keyring's current data key; decrypts with whichever
 * epoch a file names. A file from a newer epoch (another device removed a
 * device meanwhile) fetches this device's keyring once and tries again.
 */
export function keyringCipher(input: {
  getKeyring: () => SyncKeyring
  refreshKeyring: () => Promise<SyncKeyring>
}): SyncCipher {
  const imported = new Map<string, Promise<CryptoKey>>()
  const keyFor = (keyring: SyncKeyring, epoch: number) => {
    const raw = keyring.keys[epoch]

    if (!raw) {
      return null
    }

    const id = `${epoch}:${bytesToBase64(raw)}`
    let key = imported.get(id)

    if (!key) {
      key = importAesKey(raw)
      imported.set(id, key)
    }

    return key
  }

  return {
    encrypt: async (path, plain) => {
      const keyring = input.getKeyring()
      const key = keyFor(keyring, keyring.epoch)

      if (!key) {
        throw new SyncDecryptError()
      }

      const body = await encryptSyncBytes(
        await key,
        epochPath(path, keyring.epoch),
        plain,
      )
      const output = new Uint8Array(EPOCH_HEADER_BYTES + body.length)

      output.set(EPOCH_MAGIC, 0)
      new DataView(output.buffer).setUint32(4, keyring.epoch)
      output.set(body, EPOCH_HEADER_BYTES)

      return output
    },
    decrypt: async (path, data) => {
      const epoch = readFileEpoch(data)
      let key = keyFor(input.getKeyring(), epoch)

      if (!key) {
        key = keyFor(await input.refreshKeyring(), epoch)
      }

      if (!key) {
        throw new SyncDecryptError()
      }

      return decryptSyncBytes(
        await key,
        epochPath(path, epoch),
        data.slice(EPOCH_HEADER_BYTES),
      )
    },
  }
}

type KeyringJson = {
  v: 1
  epoch: number
  keys: Record<string, string>
  labelKey: string
  joinSecret?: string
}

export function serializeKeyring(keyring: SyncKeyring) {
  const json: KeyringJson = {
    v: 1,
    epoch: keyring.epoch,
    keys: Object.fromEntries(
      Object.entries(keyring.keys).map(([epoch, raw]) => [
        epoch,
        bytesToBase64(raw),
      ]),
    ),
    labelKey: bytesToBase64(keyring.labelKey),
    ...(keyring.joinSecret
      ? { joinSecret: bytesToBase64(keyring.joinSecret) }
      : {}),
  }

  return encoder.encode(JSON.stringify(json))
}

export function parseKeyring(bytes: Uint8Array): SyncKeyring {
  const json = JSON.parse(decoder.decode(bytes)) as KeyringJson

  if (json.v !== 1 || !Number.isInteger(json.epoch) || !json.keys) {
    throw new SyncDecryptError()
  }

  return {
    epoch: json.epoch,
    keys: Object.fromEntries(
      Object.entries(json.keys).map(([epoch, raw]) => [
        Number(epoch),
        base64ToBytes(raw),
      ]),
    ),
    labelKey: base64ToBytes(json.labelKey),
    ...(json.joinSecret ? { joinSecret: base64ToBytes(json.joinSecret) } : {}),
  }
}

/** A device's key pair; the private key can't be exported. */
export async function generateDeviceKeyPair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  )
  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', pair.publicKey),
  )

  return { privateKey: pair.privateKey, publicKey: bytesToBase64(publicKey) }
}

const SEAL_MAGIC = [0x4c, 0x48, 0x4b, 0x31] // "LHK1"
const PUBLIC_KEY_BYTES = 65

async function sealKeyFromSecret(shared: ArrayBuffer, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, [
    'deriveKey',
  ])

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as BufferSource,
      info: encoder.encode('linkhaven sync v2 keyring'),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Seals bytes so only the holder of `publicKey`'s private key can open
 * them (ECIES: a fresh ECDH key pair per seal, HKDF, AES-GCM).
 */
export async function sealForDevice(
  publicKey: string,
  path: string,
  plain: Uint8Array,
) {
  const recipient = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(publicKey) as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
  const ephemeralPublic = new Uint8Array(
    await crypto.subtle.exportKey('raw', ephemeral.publicKey),
  )
  const shared = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipient },
    ephemeral.privateKey,
    256,
  )
  const body = await encryptSyncBytes(
    await sealKeyFromSecret(shared, ephemeralPublic),
    path,
    plain,
    { compress: false },
  )
  const output = new Uint8Array(4 + PUBLIC_KEY_BYTES + body.length)

  output.set(SEAL_MAGIC, 0)
  output.set(ephemeralPublic, 4)
  output.set(body, 4 + PUBLIC_KEY_BYTES)

  return output
}

export async function openForDevice(
  privateKey: CryptoKey,
  path: string,
  sealed: Uint8Array,
) {
  if (
    sealed.length < 4 + PUBLIC_KEY_BYTES ||
    SEAL_MAGIC.some((byte, index) => sealed[index] !== byte)
  ) {
    throw new SyncDecryptError()
  }

  const ephemeralPublic = sealed.slice(4, 4 + PUBLIC_KEY_BYTES)

  try {
    const sender = await crypto.subtle.importKey(
      'raw',
      ephemeralPublic,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    )
    const shared = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: sender },
      privateKey,
      256,
    )

    return await decryptSyncBytes(
      await sealKeyFromSecret(shared, ephemeralPublic),
      path,
      sealed.slice(4 + PUBLIC_KEY_BYTES),
    )
  } catch {
    throw new SyncDecryptError()
  }
}

/** Device names are encrypted with the keyring's label key. */
export async function encryptLabel(labelKey: Uint8Array, label: string) {
  return bytesToBase64(
    await encryptSyncBytes(
      await importAesKey(labelKey),
      'device-label',
      encoder.encode(label.slice(0, 120)),
      { compress: false },
    ),
  )
}

export async function decryptLabel(labelKey: Uint8Array, label: string) {
  try {
    return decoder.decode(
      await decryptSyncBytes(
        await importAesKey(labelKey),
        'device-label',
        base64ToBytes(label),
      ),
    )
  } catch {
    return null
  }
}
