import { openDB } from 'idb'

import type { SyncBase } from '../features/sync/syncMerge'

/**
 * Device sync keeps its own small database, apart from the workspace data:
 * the connection, the derived encryption key (a non-extractable CryptoKey,
 * so the passphrase itself is never stored) and the hashes of the last
 * sync. None of it is ever exported or synced.
 */

const DB_NAME = 'linkhaven-sync'
const STORE = 'kv'

export type SyncConnection = {
  url: string
  username: string
  password: string
  deviceId: string
  deviceName: string
  lastSyncAt?: string
}

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
