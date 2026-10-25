import type { ImageAsset } from '../../contracts/imageAsset'
import {
  base64ToBytes,
  bytesToBase64,
  createSyncKeyCheck,
  createSyncSalt,
  decryptSyncBytes,
  decryptSyncJson,
  deriveSyncKey,
  encryptSyncBytes,
  encryptSyncJson,
  SYNC_KDF_ITERATIONS,
  verifySyncKeyCheck,
} from './syncCrypto'
import {
  applyRemoteSyncRecords,
  collectLocalSyncRecords,
  hashActiveWorkspace,
  imageBlobPath,
  readLocalImageBlob,
} from './syncLocalData'
import {
  mergeSyncRecords,
  syncRecordKind,
  type SyncBase,
  type SyncRecordMap,
} from './syncMerge'
import { SyncWriteConflictError, type SyncTransport } from './webdavTransport'

/**
 * The sync folder holds three kinds of files:
 *
 * - `linkhaven-sync.json`: plain text, only the key-derivation salt and a
 *   check value, so every device derives the same key from the passphrase
 * - `state.bin`: every synced record, encrypted
 * - `images/<id>.bin`: each uploaded image, encrypted
 */

export const SYNC_META_PATH = 'linkhaven-sync.json'
export const SYNC_STATE_PATH = 'state.bin'
const MAX_ATTEMPTS = 4

type SyncMeta = {
  format: 'linkhaven.sync'
  version: 1
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  check: string
}

type RemoteState = {
  format: 'linkhaven.sync-state'
  version: 1
  updatedAt: string
  updatedBy: string
  records: SyncRecordMap
}

export class SyncPassphraseError extends Error {
  constructor() {
    super(
      'This passphrase does not match the one this sync folder was set up with.',
    )
    this.name = 'SyncPassphraseError'
  }
}

export class SyncFormatError extends Error {
  constructor() {
    super('The sync folder holds data from a newer Linkhaven. Update first.')
    this.name = 'SyncFormatError'
  }
}

function parseMeta(data: Uint8Array): SyncMeta {
  const meta = JSON.parse(new TextDecoder().decode(data)) as SyncMeta

  if (meta.format !== 'linkhaven.sync' || meta.version !== 1) {
    throw new SyncFormatError()
  }

  return meta
}

/**
 * Opens a sync folder: creates it on first use, otherwise checks the
 * passphrase against it. Returns the derived key.
 */
export async function connectSyncFolder(
  transport: SyncTransport,
  passphrase: string,
) {
  await transport.ensureFolder('')

  const existing = await transport.read(SYNC_META_PATH)

  if (existing) {
    const meta = parseMeta(existing.data)
    const key = await deriveSyncKey(
      passphrase,
      base64ToBytes(meta.kdf.salt),
      meta.kdf.iterations,
    )

    if (!(await verifySyncKeyCheck(key, meta.check))) {
      throw new SyncPassphraseError()
    }

    await transport.ensureFolder('images/')

    return { key, created: false }
  }

  const salt = createSyncSalt()
  const key = await deriveSyncKey(passphrase, salt)
  const meta: SyncMeta = {
    format: 'linkhaven.sync',
    version: 1,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: SYNC_KDF_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    check: await createSyncKeyCheck(key),
  }

  await transport.write(
    SYNC_META_PATH,
    new TextEncoder().encode(JSON.stringify(meta, null, 2)),
    { ifMatch: null },
  )
  await transport.ensureFolder('images/')

  return { key, created: true }
}

async function readRemoteState(transport: SyncTransport, key: CryptoKey) {
  const file = await transport.read(SYNC_STATE_PATH)

  if (!file) {
    return { records: {} as SyncRecordMap, etag: null }
  }

  const state = (await decryptSyncJson(
    key,
    SYNC_STATE_PATH,
    file.data,
  )) as RemoteState

  if (state.format !== 'linkhaven.sync-state' || state.version !== 1) {
    throw new SyncFormatError()
  }

  return { records: state.records ?? {}, etag: file.etag ?? undefined }
}

export type SyncResult = {
  received: number
  sent: number
  conflicts: number
  /** True when another sync should follow (conflict copies to upload). */
  again: boolean
  base: SyncBase
}

export async function runSyncOnce(input: {
  transport: SyncTransport
  key: CryptoKey
  base: SyncBase
  deviceId: string
}): Promise<SyncResult> {
  const { transport, key, deviceId } = input

  for (let attempt = 1; ; attempt += 1) {
    const activeHashAtStart = await hashActiveWorkspace()
    const local = await collectLocalSyncRecords()
    const remote = await readRemoteState(transport, key)
    const plan = mergeSyncRecords(local, remote.records, input.base)
    const remoteChanged =
      plan.pushRemote.length > 0 || plan.deleteRemote.length > 0

    try {
      // Images first, so no device ever sees a record without its file.
      for (const recordKey of plan.pushRemote) {
        if (syncRecordKind(recordKey) !== 'image') {
          continue
        }

        const blob = await readLocalImageBlob(recordKey)

        if (blob) {
          const path = imageBlobPath(recordKey.slice('image:'.length))

          await transport.write(
            path,
            await encryptSyncBytes(
              key,
              path,
              new Uint8Array(await blob.arrayBuffer()),
            ),
          )
        }
      }

      if (remoteChanged) {
        const state: RemoteState = {
          format: 'linkhaven.sync-state',
          version: 1,
          updatedAt: new Date().toISOString(),
          updatedBy: deviceId,
          records: plan.remote,
        }

        await transport.write(
          SYNC_STATE_PATH,
          await encryptSyncJson(key, SYNC_STATE_PATH, state),
          // Servers without ETags fall back to a plain write.
          { ifMatch: remote.etag },
        )
      }
    } catch (error) {
      if (error instanceof SyncWriteConflictError && attempt < MAX_ATTEMPTS) {
        continue
      }

      throw error
    }

    const skipped = await applyRemoteSyncRecords({
      plan,
      local,
      remote: plan.remote,
      remoteBefore: remote.records,
      activeHashAtStart,
      loadImageBlob: async (recordKey: string, asset: ImageAsset) => {
        const path = imageBlobPath(recordKey.slice('image:'.length))
        const file = await transport.read(path)

        if (!file) {
          throw new Error(`The image ${asset.name} is missing on the server.`)
        }

        return new File(
          [(await decryptSyncBytes(key, path, file.data)) as BlobPart],
          asset.originalFilename,
          { type: asset.mimeType },
        )
      },
    })

    for (const recordKey of plan.deleteRemote) {
      if (syncRecordKind(recordKey) === 'image') {
        // Best effort: a leftover file is harmless.
        await transport
          .remove(imageBlobPath(recordKey.slice('image:'.length)))
          .catch(() => undefined)
      }
    }

    const base = { ...plan.base }

    for (const recordKey of skipped) {
      if (input.base[recordKey] === undefined) {
        delete base[recordKey]
      } else {
        base[recordKey] = input.base[recordKey]
      }
    }

    return {
      received: plan.applyLocal.length + plan.deleteLocal.length,
      sent: plan.pushRemote.length + plan.deleteRemote.length,
      conflicts: plan.conflictCopies.length,
      again: plan.conflictCopies.length > 0 || skipped.length > 0,
      base,
    }
  }
}
