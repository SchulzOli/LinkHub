import { openDB } from 'idb'

import {
  getLinkhavenStorageBackend,
  registerLinkhavenStorageBackend,
  STORAGE_STORES,
  type LinkhavenStorageBackend,
} from './storageBackend'

// The app's former name. Storage keys, document formats and the Firefox
// add-on id keep it, so data and installs carry over to Linkhaven.
const DB_NAME = 'linkhub'
const DB_VERSION = 6

export async function openLinkhavenDb() {
  return getLinkhavenStorageBackend().openDatabase()
}

function createIndexedDbStorageBackend(): LinkhavenStorageBackend {
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

registerLinkhavenStorageBackend(createIndexedDbStorageBackend())

export { STORAGE_STORES }
