import { create } from 'zustand'

import {
  createServerTransport,
  normalizeSyncServerUrl,
  SyncDeviceRemovedError,
} from '../features/sync/serverTransport'
import {
  createServerSync,
  destroyServerSync,
  fetchDeviceKeyring,
  joinServerSync,
  leaveServerSync,
  listServerDevices,
  removeServerDevice,
  sessionCipher,
  syncCodeOf,
  type ServerSyncSession,
  type SyncDeviceInfo,
} from '../features/sync/serverVault'
import { SyncCodeError } from '../features/sync/syncCode'
import { SyncDecryptError } from '../features/sync/syncCrypto'
import {
  connectSyncFolder,
  runSyncOnce,
  SyncFormatError,
  SyncPassphraseError,
} from '../features/sync/syncEngine'
import { singleKeyCipher, type SyncCipher } from '../features/sync/syncKeys'
import {
  getSyncFetch,
  releaseSyncServerAccess,
  requestSyncServerAccess,
} from '../features/sync/syncPlatform'
import type { SyncScope } from '../features/sync/syncScope'
import {
  createWebDavTransport,
  normalizeSyncFolderUrl,
  SyncHttpError,
  type SyncTransport,
} from '../features/sync/webdavTransport'
import {
  clearSyncConnection,
  loadDeviceKey,
  loadSyncBase,
  loadSyncConnection,
  loadSyncKey,
  loadSyncKeyring,
  saveDeviceKey,
  saveSyncBase,
  saveSyncConnection,
  saveSyncKey,
  saveSyncKeyring,
  type ServerSyncConnection,
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
  /** Which workspaces this device syncs; all when missing. */
  scope?: SyncScope
}

type ConnectServerInput = {
  serverUrl: string
  deviceName: string
  scope?: SyncScope
} & ({ mode: 'create' } | { mode: 'join'; code: string })

type SyncState = {
  loaded: boolean
  connection: SyncConnection | null
  status: SyncStatus
  /** The current sync code (server sync), to add another device. */
  syncCode: string | null
  /** The server sync's devices; null until loaded. */
  devices: SyncDeviceInfo[] | null
  /** Every workspace in the sync as of the last sync, for choosing. */
  remoteWorkspaces: Array<{ id: string; name: string }>
  /** Which workspaces this device syncs; syncs right away. */
  setScope: (scope: SyncScope) => Promise<void>
  load: () => Promise<SyncConnection | null>
  /** Connects to a WebDAV folder with a passphrase. */
  connect: (input: ConnectInput) => Promise<boolean>
  /** Creates a new sync on a Linkhaven server, or joins one with its code. */
  connectServer: (input: ConnectServerInput) => Promise<boolean>
  /** Syncs now; does nothing while sync is off or not set up. */
  sync: () => Promise<void>
  loadDevices: () => Promise<void>
  /** Removes another device and rotates the keys and the sync code. */
  removeDevice: (deviceId: string) => Promise<boolean>
  /** `deleteServerData`: also remove the vault from a Linkhaven server. */
  disconnect: (options?: { deleteServerData?: boolean }) => Promise<void>
}

let loadPromise: Promise<SyncConnection | null> | null = null
let syncPromise: Promise<void> | null = null
let syncQueued = false
let session: ServerSyncSession | null = null

export const SYNC_OFF_MESSAGE =
  'Device sync is off. Turn it on in Menu → Privacy.'

const REMOVED_MESSAGE =
  'This device was removed from the sync on another device. Your data stays here; join again with the current sync code to sync it.'

function describeError(error: unknown) {
  if (error instanceof SyncDeviceRemovedError) {
    return REMOVED_MESSAGE
  }

  if (
    error instanceof SyncPassphraseError ||
    error instanceof SyncFormatError ||
    error instanceof SyncHttpError ||
    error instanceof SyncCodeError
  ) {
    return error.message
  }

  if (error instanceof SyncDecryptError) {
    return 'The sync data could not be decrypted. Was it set up with another passphrase or code?'
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

function isServerConnection(
  connection: SyncConnection | null,
): connection is ServerSyncConnection {
  return connection?.provider === 'server'
}

/** This device's server session: its keys, loaded once. */
async function getSession(connection: ServerSyncConnection) {
  if (session?.deviceId === connection.deviceId) {
    return session
  }

  const [privateKey, keyring] = await Promise.all([
    loadDeviceKey(),
    loadSyncKeyring(),
  ])

  if (!privateKey || !keyring) {
    throw new SyncDeviceRemovedError()
  }

  session = {
    serverUrl: connection.url,
    vaultId: connection.vaultId,
    deviceId: connection.deviceId,
    deviceToken: connection.deviceToken,
    privateKey,
    keyring,
  }

  return session
}

async function createCipherAndTransport(
  connection: SyncConnection,
  onKeyringChange: (session: ServerSyncSession) => void,
): Promise<{ transport: SyncTransport; cipher: SyncCipher }> {
  const fetch = await getSyncFetch()

  if (isServerConnection(connection)) {
    const current = await getSession(connection)
    const update = (keyring: ServerSyncSession['keyring']) => {
      current.keyring = keyring
      void saveSyncKeyring(keyring)
      onKeyringChange(current)
    }

    // Picks up a new key or code from a device removal elsewhere.
    update(await fetchDeviceKeyring(current, fetch))

    return {
      transport: createServerTransport({
        serverUrl: connection.url,
        vaultId: connection.vaultId,
        token: connection.deviceToken,
        fetch,
      }),
      cipher: sessionCipher(() => current, update, fetch),
    }
  }

  const key = await loadSyncKey()

  if (!key) {
    throw new SyncPassphraseError()
  }

  return {
    transport: createWebDavTransport({
      url: connection.url,
      username: connection.username,
      password: connection.password,
      fetch,
    }),
    cipher: singleKeyCipher(key),
  }
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

export const useSyncStore = create<SyncState>((set, get) => {
  /** Forgets the sync on this device (data and server stay as they are). */
  const forgetLocally = async () => {
    await clearSyncConnection()
    loadPromise = null
    session = null
    set({
      connection: null,
      syncCode: null,
      devices: null,
      remoteWorkspaces: [],
    })
  }

  const showKeyring = (current: ServerSyncSession) =>
    set({ syncCode: syncCodeOf(current.vaultId, current.keyring) })

  return {
    loaded: false,
    connection: null,
    status: { kind: 'idle', message: '' },
    syncCode: null,
    devices: null,
    remoteWorkspaces: [],
    load: () => {
      loadPromise ??= loadSyncConnection()
        .catch(() => null)
        .then(async (stored) => {
          // A server sync from before the device list can't be used.
          const connection =
            stored?.provider === 'server' && !stored.deviceToken ? null : stored

          if (stored && !connection) {
            await clearSyncConnection()
            set({
              status: {
                kind: 'warning',
                message:
                  'Sync through the server changed. Create or join the sync again.',
              },
            })
          }

          if (isServerConnection(connection)) {
            const keyring = await loadSyncKeyring()

            set({
              syncCode: keyring
                ? syncCodeOf(connection.vaultId, keyring)
                : null,
            })
          }

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
        provider: 'webdav',
        url,
        username: input.username.trim(),
        password: input.password,
        deviceId: createId(),
        deviceName: input.deviceName.trim() || DEFAULT_SYNC_DEVICE_NAME,
        ...(input.scope ? { scope: input.scope } : {}),
      }

      try {
        const { key, created } = await connectSyncFolder(
          createWebDavTransport({
            url,
            username: connection.username,
            password: connection.password,
            fetch: await getSyncFetch(),
          }),
          input.passphrase,
        )

        await saveSyncKey(key)
        await saveSyncBase({})
        await saveSyncConnection(connection)
        loadPromise = Promise.resolve(connection)
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
    connectServer: async (input) => {
      let serverUrl: string

      try {
        serverUrl = normalizeSyncServerUrl(input.serverUrl)
      } catch {
        set({
          status: {
            kind: 'error',
            message: 'That is not a valid server address.',
          },
        })
        return false
      }

      // Before anything async: the browser only asks from a click.
      if (!(await requestSyncServerAccess(serverUrl))) {
        set({
          status: {
            kind: 'error',
            message: 'Access to the sync server was not granted.',
          },
        })
        return false
      }

      set({
        status: { kind: 'busy', message: 'Connecting to the sync server…' },
      })

      const deviceName = input.deviceName.trim() || DEFAULT_SYNC_DEVICE_NAME

      try {
        const fetch = await getSyncFetch()
        const created =
          input.mode === 'create'
            ? await createServerSync({ serverUrl, deviceName, fetch })
            : await joinServerSync({
                serverUrl,
                code: input.code,
                deviceName,
                fetch,
              })
        const connection: ServerSyncConnection = {
          provider: 'server',
          url: serverUrl,
          vaultId: created.vaultId,
          deviceId: created.deviceId,
          deviceToken: created.deviceToken,
          deviceName,
          ...(input.scope ? { scope: input.scope } : {}),
        }

        await saveDeviceKey(created.privateKey)
        await saveSyncKeyring(created.keyring)
        await saveSyncBase({})
        await saveSyncConnection(connection)
        session = created
        loadPromise = Promise.resolve(connection)
        set({
          connection,
          syncCode: syncCodeOf(created.vaultId, created.keyring),
          devices: null,
          status: {
            kind: 'success',
            message:
              input.mode === 'create'
                ? 'Sync created. Add your other devices with the sync code.'
                : 'Joined the sync.',
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
          const { transport, cipher } = await createCipherAndTransport(
            connection,
            showKeyring,
          )
          let base = await loadSyncBase()
          let totals = { received: 0, sent: 0, conflicts: 0 }
          const scope = connection.scope
          const copyIds: string[] = []
          let remoteWorkspaces = get().remoteWorkspaces

          // A second round uploads conflict copies made in the first.
          for (let round = 0; round < 2; round += 1) {
            const result = await runSyncOnce({
              transport,
              cipher,
              base,
              deviceId: connection.deviceId,
              scope,
            })

            base = result.base
            remoteWorkspaces = result.remoteWorkspaces
            await saveSyncBase(base)

            copyIds.push(...result.conflictCopyIds)
            totals = {
              received: totals.received + result.received,
              sent: totals.sent + result.sent,
              conflicts: totals.conflicts + result.conflicts,
            }

            if (!result.again) {
              break
            }
          }

          // The scope may have changed meanwhile; build on the latest.
          const latest = get().connection ?? connection
          const next: SyncConnection = {
            ...latest,
            lastSyncAt: new Date().toISOString(),
          }

          // A conflict copy of a chosen workspace syncs like the original.
          if (next.scope?.mode === 'chosen' && copyIds.length > 0) {
            next.scope = {
              mode: 'chosen',
              workspaceIds: [...next.scope.workspaceIds, ...copyIds],
            }
          }

          await saveSyncConnection(next)
          set({
            connection: next,
            remoteWorkspaces,
            status: {
              kind: totals.conflicts > 0 ? 'warning' : 'success',
              message: describeResult(totals),
            },
          })

          // Keep a shown device list current (new devices, last seen).
          if (isServerConnection(next) && get().devices !== null) {
            void get().loadDevices()
          }
        } catch (error) {
          const removed =
            error instanceof SyncDeviceRemovedError ||
            (isServerConnection(connection) &&
              error instanceof SyncHttpError &&
              error.status === 403)

          if (removed) {
            await forgetLocally()
            set({ status: { kind: 'error', message: REMOVED_MESSAGE } })
            return
          }

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
    setScope: async (scope) => {
      const { connection } = get()

      if (!connection) {
        return
      }

      const next = { ...connection, scope }

      // Shown at once; stored and synced right after.
      set({ connection: next })
      await saveSyncConnection(next)
      await get().sync()
    },
    loadDevices: async () => {
      const { connection } = get()

      if (!isServerConnection(connection)) {
        return
      }

      try {
        set({
          devices: await listServerDevices(
            await getSession(connection),
            await getSyncFetch(),
          ),
        })
      } catch (error) {
        set({ status: { kind: 'error', message: describeError(error) } })
      }
    },
    removeDevice: async (deviceId) => {
      const { connection } = get()

      if (!isServerConnection(connection)) {
        return false
      }

      set({
        status: {
          kind: 'busy',
          message: 'Removing the device and re-encrypting your data…',
        },
      })

      try {
        const fetch = await getSyncFetch()
        const current = await getSession(connection)

        // Bring this device up to date first, so nothing is lost.
        await get().sync()
        current.keyring = await removeServerDevice(current, deviceId, fetch)
        await saveSyncKeyring(current.keyring)
        set({
          syncCode: syncCodeOf(current.vaultId, current.keyring),
          status: {
            kind: 'success',
            message:
              'Device removed. Your data is re-encrypted and the sync has a new code; the old code no longer works.',
          },
        })
        await get().loadDevices()

        return true
      } catch (error) {
        set({ status: { kind: 'error', message: describeError(error) } })
        return false
      }
    },
    disconnect: async (options = {}) => {
      const { connection } = get()

      if (isServerConnection(connection)) {
        try {
          const fetch = await getSyncFetch()
          const current = await getSession(connection).catch(() => null)

          if (options.deleteServerData && current) {
            await destroyServerSync(current, fetch)
          } else {
            await leaveServerSync(
              {
                serverUrl: connection.url,
                vaultId: connection.vaultId,
                deviceId: connection.deviceId,
                deviceToken: connection.deviceToken,
              },
              fetch,
            )
          }
        } catch (error) {
          if (options.deleteServerData) {
            set({ status: { kind: 'error', message: describeError(error) } })
            return
          }
        }
      }

      await forgetLocally()

      if (connection) {
        await releaseSyncServerAccess(connection.url)
      }

      set({
        status: {
          kind: 'idle',
          message: options.deleteServerData
            ? 'Disconnected and deleted the synced data from the server. Your data stays on this device.'
            : isServerConnection(connection)
              ? 'Disconnected. This device left the sync; your data stays here.'
              : 'Disconnected. Your data stays on this device and in the sync folder.',
        },
      })
    },
  }
})
