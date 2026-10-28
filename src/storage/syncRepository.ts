import { openDB } from 'idb'

import type { SyncBase } from '../features/sync/syncMerge'

/**
 * Device sync keeps its own small database, apart from the workspace data:
 * the connection, the derived encryption key (a non-extractable CryptoKey,
 * so a WebDAV passphrase is never stored) and the hashes of the last sync.
 * For a Linkhaven server the sync code is kept too, to add more devices.
 * None of it is ever exported or synced.
 */

const DB_NAME = 'linkhaven-sync'
const STORE = 'kv'

type SyncConnectionBase = {
  deviceId: string
  deviceName: string
  lastSyncAt?: string
}

/** A WebDAV folder (stored before `provider` existed: no field). */
export type WebDavSyncConnection = SyncConnectionBase & {
  provider?: 'webdav'
  url: string
  username: string
  password: string
}

/** A Linkhaven server; everything comes from the sync code. */
export type ServerSyncConnection = SyncConnectionBase & {
  provider: 'server'
  /** The server's base address. */
  url: string
  vaultId: string
  token: string
  /** Kept so it can be shown again to add another device. */
  code: string
}

export type SyncConnection = WebDavSyncConnection | ServerSyncConnection

type SyncDbValue = SyncConnection | CryptoKey | SyncBase

function openSyncDb() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE)
    },
  })
}

async function read<T extends SyncDbValue>(key: string) {
  const db = await openSyncDb()

  return ((await db.get(STORE, key)) as T | undefined) ?? null
}

async function write(key: string, value: SyncDbValue) {
  const db = await openSyncDb()

  await db.put(STORE, value, key)
}

export const loadSyncConnection = () => read<SyncConnection>('connection')
export const saveSyncConnection = (value: SyncConnection) =>
  write('connection', value)
export const loadSyncKey = () => read<CryptoKey>('key')
export const saveSyncKey = (value: CryptoKey) => write('key', value)
export const loadSyncBase = async () => (await read<SyncBase>('base')) ?? {}
export const saveSyncBase = (value: SyncBase) => write('base', value)

/** Forgets the connection here; workspace data and the server stay. */
export async function clearSyncConnection() {
  const db = await openSyncDb()

  await db.clear(STORE)
}
