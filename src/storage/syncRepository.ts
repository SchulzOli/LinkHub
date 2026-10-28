import { openDB } from 'idb'

import {
  parseKeyring,
  serializeKeyring,
  type SyncKeyring,
} from '../features/sync/syncKeys'
import type { SyncBase } from '../features/sync/syncMerge'

/**
 * Device sync keeps its own small database, apart from the workspace data:
 * the connection, the derived encryption key (a non-extractable CryptoKey,
 * so a WebDAV passphrase is never stored) and the hashes of the last sync.
 * For a Linkhaven server: the device's own token, private key and keyring
 * (which holds the current sync code, to add more devices).
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

/**
 * A Linkhaven server. The device's own token is here; its private key and
 * keyring are stored separately (see below).
 */
export type ServerSyncConnection = SyncConnectionBase & {
  provider: 'server'
  /** The server's base address. */
  url: string
  vaultId: string
  deviceToken: string
}

export type SyncConnection = WebDavSyncConnection | ServerSyncConnection

type SyncDbValue = SyncConnection | CryptoKey | SyncBase | Uint8Array

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
/** The device's private ECDH key (server sync); it can't be exported. */
export const loadDeviceKey = () => read<CryptoKey>('deviceKey')
export const saveDeviceKey = (value: CryptoKey) => write('deviceKey', value)

/** The device's keyring (server sync): data keys and the current code. */
export async function loadSyncKeyring() {
  const raw = await read<Uint8Array>('keyring')

  try {
    return raw ? parseKeyring(raw) : null
  } catch {
    return null
  }
}

export const saveSyncKeyring = (value: SyncKeyring) =>
  write('keyring', serializeKeyring(value))

export const loadSyncBase = async () => (await read<SyncBase>('base')) ?? {}
export const saveSyncBase = (value: SyncBase) => write('base', value)

/** Forgets the connection here; workspace data and the server stay. */
export async function clearSyncConnection() {
  const db = await openSyncDb()

  await db.clear(STORE)
}
