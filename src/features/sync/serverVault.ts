import {
  createServerApi,
  createServerTransport,
  SyncDeviceRemovedError,
} from './serverTransport'
import {
  createJoinSecret,
  createSyncCodeParts,
  deriveJoinAccess,
  formatSyncCode,
  parseSyncCode,
} from './syncCode'
import { SyncDecryptError } from './syncCrypto'
import { readRemoteState, SYNC_STATE_PATH } from './syncEngine'
import {
  bytesToBase64Url,
  bytesToHex,
  decryptLabel,
  encryptLabel,
  generateDeviceKeyPair,
  keyringCipher,
  openForDevice,
  parseKeyring,
  randomBytes,
  sealForDevice,
  serializeKeyring,
  singleKeyCipher,
  type SyncCipher,
  type SyncKeyring,
} from './syncKeys'
import { imageBlobPath } from './syncLocalData'
import { syncRecordKind } from './syncMerge'
import {
  SyncHttpError,
  SyncWriteConflictError,
  type SyncFetch,
} from './webdavTransport'

/**
 * Sync through a Linkhaven server, with a device list: create a sync, join
 * one with its code, keep this device's keyring current, and remove a
 * device (which rotates the data key and the sync code). The keys are
 * described in syncKeys.ts.
 */

export const JOIN_KEYRING_PATH = 'keyring/join'

export function deviceKeyringPath(deviceId: string) {
  return `keyring/${deviceId}`
}

/** What this device keeps about a server sync. */
export type ServerSyncDevice = {
  serverUrl: string
  vaultId: string
  deviceId: string
  deviceToken: string
}

export type ServerSyncSession = ServerSyncDevice & {
  privateKey: CryptoKey
  keyring: SyncKeyring
}

function transportFor(device: ServerSyncDevice, fetch: SyncFetch) {
  return createServerTransport({
    serverUrl: device.serverUrl,
    vaultId: device.vaultId,
    token: device.deviceToken,
    fetch,
  })
}

function apiFor(device: ServerSyncDevice, fetch: SyncFetch) {
  return createServerApi({
    serverUrl: device.serverUrl,
    vaultId: device.vaultId,
    fetch,
  })
}

/** Turns "the server refused this device" into a clear error. */
async function asDevice<T>(task: () => Promise<T>) {
  try {
    return await task()
  } catch (error) {
    if (error instanceof SyncHttpError && error.status === 403) {
      throw new SyncDeviceRemovedError()
    }

    throw error
  }
}

async function registerThisDevice(input: {
  serverUrl: string
  vaultId: string
  joinToken: string
  deviceName: string
  labelKey: Uint8Array
  create: boolean
  fetch: SyncFetch
}) {
  const { privateKey, publicKey } = await generateDeviceKeyPair()
  const device: ServerSyncDevice = {
    serverUrl: input.serverUrl,
    vaultId: input.vaultId,
    deviceId: bytesToHex(randomBytes(16)),
    deviceToken: bytesToBase64Url(randomBytes(32)),
  }

  await apiFor(device, input.fetch).registerDevice(input.joinToken, {
    deviceId: device.deviceId,
    deviceToken: device.deviceToken,
    publicKey,
    label: await encryptLabel(input.labelKey, input.deviceName),
    create: input.create,
  })

  return { device, privateKey, publicKey }
}

async function writeDeviceKeyring(
  device: ServerSyncDevice,
  deviceId: string,
  publicKey: string,
  keyring: SyncKeyring,
  fetch: SyncFetch,
) {
  const path = deviceKeyringPath(deviceId)

  await transportFor(device, fetch).write(
    path,
    await sealForDevice(publicKey, path, serializeKeyring(keyring)),
  )
}

async function writeJoinKeyring(
  device: ServerSyncDevice,
  keyring: SyncKeyring,
  fetch: SyncFetch,
) {
  if (!keyring.joinSecret) {
    throw new SyncDecryptError()
  }

  const { joinKey } = await deriveJoinAccess(keyring.joinSecret)
  // A joining device learns the code from the person, not from here.
  const { joinSecret: _omit, ...withoutSecret } = keyring

  void _omit
  await transportFor(device, fetch).write(
    JOIN_KEYRING_PATH,
    await singleKeyCipher(joinKey).encrypt(
      JOIN_KEYRING_PATH,
      serializeKeyring(withoutSecret),
    ),
  )
}

export async function createServerSync(input: {
  serverUrl: string
  deviceName: string
  fetch: SyncFetch
}): Promise<ServerSyncSession> {
  const code = createSyncCodeParts()
  const keyring: SyncKeyring = {
    epoch: 1,
    keys: { 1: randomBytes(32) },
    labelKey: randomBytes(32),
    joinSecret: code.joinSecret,
  }
  const { joinToken } = await deriveJoinAccess(code.joinSecret)
  const { device, privateKey, publicKey } = await registerThisDevice({
    serverUrl: input.serverUrl,
    vaultId: code.vaultId,
    joinToken,
    deviceName: input.deviceName,
    labelKey: keyring.labelKey,
    create: true,
    fetch: input.fetch,
  })

  await writeJoinKeyring(device, keyring, input.fetch)
  await writeDeviceKeyring(
    device,
    device.deviceId,
    publicKey,
    keyring,
    input.fetch,
  )

  return { ...device, privateKey, keyring }
}

export async function joinServerSync(input: {
  serverUrl: string
  code: string
  deviceName: string
  fetch: SyncFetch
}): Promise<ServerSyncSession> {
  const code = parseSyncCode(input.code)
  const { joinToken, joinKey } = await deriveJoinAccess(code.joinSecret)
  const joinTransport = createServerTransport({
    serverUrl: input.serverUrl,
    vaultId: code.vaultId,
    token: joinToken,
    fetch: input.fetch,
  })
  let sealed

  try {
    sealed = await joinTransport.read(JOIN_KEYRING_PATH)
  } catch (error) {
    // Unknown vault or retired code: the server refuses either way.
    if (
      error instanceof SyncHttpError &&
      (error.status === 403 || error.status === 404)
    ) {
      sealed = null
    } else {
      throw error
    }
  }

  if (!sealed) {
    throw new SyncHttpError(
      404,
      'There is no sync for this code on this server. Check the code and the server address.',
    )
  }

  const keyring: SyncKeyring = {
    ...parseKeyring(
      await singleKeyCipher(joinKey).decrypt(JOIN_KEYRING_PATH, sealed.data),
    ),
    joinSecret: code.joinSecret,
  }
  const { device, privateKey, publicKey } = await registerThisDevice({
    serverUrl: input.serverUrl,
    vaultId: code.vaultId,
    joinToken,
    deviceName: input.deviceName,
    labelKey: keyring.labelKey,
    create: false,
    fetch: input.fetch,
  })

  await writeDeviceKeyring(
    device,
    device.deviceId,
    publicKey,
    keyring,
    input.fetch,
  )

  return { ...device, privateKey, keyring }
}

/** The keyring the server holds for this device: newest keys and code. */
export async function fetchDeviceKeyring(
  session: Pick<ServerSyncSession, keyof ServerSyncDevice | 'privateKey'>,
  fetch: SyncFetch,
) {
  const path = deviceKeyringPath(session.deviceId)
  const file = await asDevice(() => transportFor(session, fetch).read(path))

  if (!file) {
    throw new SyncDeviceRemovedError()
  }

  return parseKeyring(await openForDevice(session.privateKey, path, file.data))
}

export function sessionCipher(
  getSession: () => ServerSyncSession,
  onKeyring: (keyring: SyncKeyring) => void,
  fetch: SyncFetch,
): SyncCipher {
  return keyringCipher({
    getKeyring: () => getSession().keyring,
    refreshKeyring: async () => {
      const keyring = await fetchDeviceKeyring(getSession(), fetch)

      onKeyring(keyring)

      return keyring
    },
  })
}

export function syncCodeOf(vaultId: string, keyring: SyncKeyring) {
  return keyring.joinSecret
    ? formatSyncCode({ vaultId, joinSecret: keyring.joinSecret })
    : null
}

export type SyncDeviceInfo = {
  deviceId: string
  name: string
  createdAt: number
  lastSeenAt: number
  current: boolean
}

export async function listServerDevices(
  session: ServerSyncSession,
  fetch: SyncFetch,
): Promise<SyncDeviceInfo[]> {
  const devices = await asDevice(() =>
    apiFor(session, fetch).listDevices(session.deviceToken),
  )

  return Promise.all(
    devices.map(async (device) => ({
      deviceId: device.deviceId,
      name:
        (await decryptLabel(session.keyring.labelKey, device.label)) ??
        'Unknown device',
      createdAt: device.createdAt,
      lastSeenAt: device.lastSeenAt,
      current: device.current,
    })),
  )
}

/**
 * Re-encrypts every file of the vault with the keyring's current key:
 * the images first, then the state (with its ETag, retrying when another
 * device wrote it meanwhile).
 */
async function reencryptVault(
  session: ServerSyncSession,
  oldCipher: SyncCipher,
  newCipher: SyncCipher,
  fetch: SyncFetch,
) {
  const transport = transportFor(session, fetch)

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const file = await transport.read(SYNC_STATE_PATH)

    if (!file) {
      return
    }

    const { records } = await readRemoteState(
      { ...transport, read: async () => file },
      oldCipher,
    )

    for (const key of Object.keys(records)) {
      if (syncRecordKind(key) !== 'image') {
        continue
      }

      const path = imageBlobPath(key.slice('image:'.length))
      const image = await transport.read(path)

      if (image) {
        await transport.write(
          path,
          await newCipher.encrypt(
            path,
            await oldCipher.decrypt(path, image.data),
          ),
        )
      }
    }

    try {
      await transport.write(
        SYNC_STATE_PATH,
        await newCipher.encrypt(
          SYNC_STATE_PATH,
          await oldCipher.decrypt(SYNC_STATE_PATH, file.data),
        ),
        { ifMatch: file.etag ?? undefined },
      )
      return
    } catch (error) {
      if (!(error instanceof SyncWriteConflictError) || attempt === 4) {
        throw error
      }
    }
  }
}

/**
 * Removes a device: the server revokes its token at once. Then a new data
 * key and a new sync code are made, handed only to the remaining devices
 * (each sealed to its own public key), and everything is re-encrypted, so
 * the removed device can't read anything that follows, even with the old
 * code or a copy of the server's files.
 */
export async function removeServerDevice(
  session: ServerSyncSession,
  deviceId: string,
  fetch: SyncFetch,
): Promise<SyncKeyring> {
  const api = apiFor(session, fetch)
  const devices = await asDevice(() => api.listDevices(session.deviceToken))

  await api.removeDevice(session.deviceToken, deviceId)

  const previous = session.keyring
  const epoch = previous.epoch + 1
  const keyring: SyncKeyring = {
    epoch,
    // The previous key stays for files not re-encrypted yet.
    keys: {
      [previous.epoch]: previous.keys[previous.epoch],
      [epoch]: randomBytes(32),
    },
    labelKey: previous.labelKey,
    joinSecret: createJoinSecret(),
  }

  // Remaining devices first, so they can read new files right away.
  for (const device of devices) {
    if (device.deviceId !== deviceId) {
      await writeDeviceKeyring(
        session,
        device.deviceId,
        device.publicKey,
        keyring,
        fetch,
      )
    }
  }

  const { joinToken } = await deriveJoinAccess(keyring.joinSecret!)

  await api.setJoinToken(session.deviceToken, joinToken)
  await writeJoinKeyring(session, keyring, fetch)

  const cipherFor = (current: SyncKeyring) =>
    keyringCipher({
      getKeyring: () => current,
      refreshKeyring: async () => current,
    })

  await reencryptVault(
    session,
    cipherFor({ ...keyring, keys: { ...previous.keys, ...keyring.keys } }),
    cipherFor(keyring),
    fetch,
  )

  return keyring
}

/** Leaves the sync: the server forgets this device and its keyring. */
export async function leaveServerSync(
  session: ServerSyncDevice,
  fetch: SyncFetch,
) {
  try {
    await apiFor(session, fetch).removeDevice(
      session.deviceToken,
      session.deviceId,
    )
  } catch (error) {
    // Already removed, or the server is gone: leaving still works locally.
    if (!(error instanceof SyncHttpError)) {
      throw error
    }
  }
}

export async function destroyServerSync(
  session: ServerSyncDevice,
  fetch: SyncFetch,
) {
  await asDevice(() => transportFor(session, fetch).destroyVault())
}
