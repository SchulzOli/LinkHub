import { openDB } from 'idb'

import {
  getLinkHubStorageBackend,
  registerLinkHubStorageBackend,
  STORAGE_STORES,
  type LinkHubStorageBackend,
} from './storageBackend'

const DB_NAME = 'linkhub'
const DB_VERSION = 6

export async function openLinkHubDb() {
  return getLinkHubStorageBackend().openDatabase()
}

function createIndexedDbStorageBackend(): LinkHubStorageBackend {
  return {
    kind: 'indexeddb',
    openDatabase: () =>
      openDB(DB_NAME, DB_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(STORAGE_STORES.workspace)) {
            database.createObjectStore(STORAGE_STORES.workspace)
          }

          if (
            !database.objectStoreNames.contains(
              STORAGE_STORES.workspaceMetadata,
            )
          ) {
            database.createObjectStore(STORAGE_STORES.workspaceMetadata)
          }

          if (!database.objectStoreNames.contains(STORAGE_STORES.imageAsset)) {
            database.createObjectStore(STORAGE_STORES.imageAsset)
          }

          if (!database.objectStoreNames.contains(STORAGE_STORES.imageBlob)) {
            database.createObjectStore(STORAGE_STORES.imageBlob)
          }

          if (
            !database.objectStoreNames.contains(
              STORAGE_STORES.imageThumbnailBlob,
            )
          ) {
            database.createObjectStore(STORAGE_STORES.imageThumbnailBlob)
          }

          if (!database.objectStoreNames.contains(STORAGE_STORES.template)) {
            database.createObjectStore(STORAGE_STORES.template)
          }

          if (
            !database.objectStoreNames.contains(
              STORAGE_STORES.templateImageAsset,
            )
          ) {
            database.createObjectStore(STORAGE_STORES.templateImageAsset)
          }

          if (
            !database.objectStoreNames.contains(
              STORAGE_STORES.templateImageBlob,
            )
          ) {
            database.createObjectStore(STORAGE_STORES.templateImageBlob)
          }

          if (!database.objectStoreNames.contains(STORAGE_STORES.theme)) {
            database.createObjectStore(STORAGE_STORES.theme)
          }
        },
      }),
  }
}

registerLinkHubStorageBackend(createIndexedDbStorageBackend())

export { STORAGE_STORES }
