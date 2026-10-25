import { create } from 'zustand'

import { SyncDecryptError } from '../features/sync/syncCrypto'
import {
  connectSyncFolder,
  runSyncOnce,
  SyncFormatError,
  SyncPassphraseError,
} from '../features/sync/syncEngine'
import {
  getSyncFetch,
  releaseSyncServerAccess,
  requestSyncServerAccess,
} from '../features/sync/syncPlatform'
import {
  createWebDavTransport,
  normalizeSyncFolderUrl,
  SyncHttpError,
} from '../features/sync/webdavTransport'
import {
  clearSyncConnection,
  loadSyncBase,
  loadSyncConnection,
  loadSyncKey,
  saveSyncBase,
  saveSyncConnection,
  saveSyncKey,
  type SyncConnection,
} from '../storage/syncRepository'
import { createId } from '../utils/id'
import { isNetworkFeatureEnabled } from './useNetworkFeaturesStore'

export type SyncStatus = {
  kind: 'idle' | 'busy' | 'success' | 'warning' | 'error'
  message: string
}

type ConnectInput = {
  url: string
  username: string
  password: string
  passphrase: string
  deviceName: string
}

type SyncState = {
  loaded: boolean
  connection: SyncConnection | null
  status: SyncStatus
  load: () => Promise<SyncConnection | null>
  connect: (input: ConnectInput) => Promise<boolean>
  /** Syncs now; does nothing while sync is off or not set up. */
  sync: () => Promise<void>
  disconnect: () => Promise<void>
}

let loadPromise: Promise<SyncConnection | null> | null = null
let syncPromise: Promise<void> | null = null
let syncQueued = false

export const SYNC_OFF_MESSAGE =
  'Device sync is off. Turn it on in Menu → Privacy.'

function describeError(error: unknown) {
  if (
    error instanceof SyncPassphraseError ||
    error instanceof SyncFormatError ||
    error instanceof SyncHttpError
  ) {
    return error.message
  }

  if (error instanceof SyncDecryptError) {
    return 'The sync data could not be decrypted. Was the folder set up with another passphrase?'
  }

  if (error instanceof TypeError && /url/i.test(error.message)) {
    return 'That is not a valid address.'
  }

  return 'Sync failed. Try again later.'
}

function describeResult(result: {
  received: number
  sent: number
  conflicts: number
}) {
  if (result.received === 0 && result.sent === 0) {
    return 'Up to date.'
  }

  const parts = [
    result.received > 0 ? `${result.received} received` : null,
    result.sent > 0 ? `${result.sent} sent` : null,
    result.conflicts > 0
      ? `${result.conflicts} conflict${result.conflicts === 1 ? '' : 's'} kept as a copy`
      : null,
  ].filter(Boolean)

  return `Synced: ${parts.join(', ')}.`
}

async function createTransport(connection: SyncConnection) {
  return createWebDavTransport({
    url: connection.url,
    username: connection.username,
    password: connection.password,
    fetch: await getSyncFetch(),
  })
}

function defaultDeviceName() {
  if (typeof navigator === 'undefined') {
    return 'This device'
  }

  const agent = navigator.userAgent

  if (/android/i.test(agent)) return 'Android'
  if (/iphone|ipad/i.test(agent)) return 'iPhone or iPad'
  if (/mac os/i.test(agent)) return 'Mac'
  if (/windows/i.test(agent)) return 'Windows PC'
  if (/linux/i.test(agent)) return 'Linux PC'

  return 'This device'
}

export const DEFAULT_SYNC_DEVICE_NAME = defaultDeviceName()

export const useSyncStore = create<SyncState>((set, get) => ({
  loaded: false,
  connection: null,
  status: { kind: 'idle', message: '' },
  load: () => {
    loadPromise ??= loadSyncConnection()
      .catch(() => null)
      .then((connection) => {
        set({ connection, loaded: true })

        return connection
      })

    return loadPromise
  },
  connect: async (input) => {
    let url: string

    try {
      url = normalizeSyncFolderUrl(input.url)
    } catch (error) {
      set({
        status: {
          kind: 'error',
          message:
            error instanceof Error && error.message.startsWith('Use')
              ? error.message
              : 'That is not a valid address.',
        },
      })
      return false
    }

    // Before anything async: the browser only asks from a click.
    if (!(await requestSyncServerAccess(url))) {
      set({
        status: {
          kind: 'error',
          message: 'Access to the sync server was not granted.',
        },
      })
      return false
    }

    set({
      status: {
        kind: 'busy',
        message: 'Connecting and deriving the encryption key…',
      },
    })

    const connection: SyncConnection = {
      url,
      username: input.username.trim(),
      password: input.password,
      deviceId: createId(),
      deviceName: input.deviceName.trim() || DEFAULT_SYNC_DEVICE_NAME,
    }

    try {
      const { key, created } = await connectSyncFolder(
        await createTransport(connection),
        input.passphrase,
      )

      await saveSyncKey(key)
      await saveSyncBase({})
      await saveSyncConnection(connection)
      set({
        connection,
        status: {
          kind: 'success',
          message: created
            ? 'Sync folder set up. Use the same passphrase on your other devices.'
            : 'Connected to the sync folder.',
        },
      })
    } catch (error) {
      set({ status: { kind: 'error', message: describeError(error) } })
      return false
    }

    await get().sync()

    return true
  },
  sync: () => {
    if (syncPromise) {
      // A change came in while syncing: sync once more afterwards.
      syncQueued = true
      return syncPromise
    }

    syncPromise = (async () => {
      const connection = get().connection ?? (await get().load())

      if (!connection) {
        return
      }

      if (!isNetworkFeatureEnabled('deviceSync')) {
        set({ status: { kind: 'warning', message: SYNC_OFF_MESSAGE } })
        return
      }

      set({ status: { kind: 'busy', message: 'Syncing…' } })

      try {
        const key = await loadSyncKey()

        if (!key) {
          throw new SyncPassphraseError()
        }

        const transport = await createTransport(connection)
        let base = await loadSyncBase()
        let totals = { received: 0, sent: 0, conflicts: 0 }

        // A second round uploads conflict copies made in the first.
        for (let round = 0; round < 2; round += 1) {
          const result = await runSyncOnce({
            transport,
            key,
            base,
            deviceId: connection.deviceId,
          })

          base = result.base
          await saveSyncBase(base)
          totals = {
            received: totals.received + result.received,
            sent: totals.sent + result.sent,
            conflicts: totals.conflicts + result.conflicts,
          }

          if (!result.again) {
            break
          }
        }

        const next = { ...connection, lastSyncAt: new Date().toISOString() }

        await saveSyncConnection(next)
        set({
          connection: next,
          status: {
            kind: totals.conflicts > 0 ? 'warning' : 'success',
            message: describeResult(totals),
          },
        })
      } catch (error) {
        set({ status: { kind: 'error', message: describeError(error) } })
      }
    })().finally(() => {
      syncPromise = null

      if (syncQueued) {
        syncQueued = false
        void get().sync()
      }
    })

    return syncPromise
  },
  disconnect: async () => {
    const { connection } = get()

    await clearSyncConnection()

    if (connection) {
      await releaseSyncServerAccess(connection.url)
    }

    set({
      connection: null,
      status: {
        kind: 'idle',
        message:
          'Disconnected. Your data stays on this device and in the sync folder.',
      },
    })
  },
}))
