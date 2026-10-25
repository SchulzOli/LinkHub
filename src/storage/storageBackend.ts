import type { IDBPDatabase, IDBPObjectStore, IDBPTransaction } from 'idb'

export const STORAGE_STORES = {
  imageAsset: 'image_assets',
  imageBlob: 'image_blobs',
  imageThumbnailBlob: 'image_thumbnail_blobs',
  template: 'templates',
  templateImageAsset: 'template_image_assets',
  templateImageBlob: 'template_image_blobs',
  theme: 'themes',
  workspaceMetadata: 'workspace_metadata',
  workspace: 'workspace',
} as const

export type LinkhavenStoreName =
  (typeof STORAGE_STORES)[keyof typeof STORAGE_STORES]

export type LinkhavenDb = Pick<
  IDBPDatabase<unknown>,
  'get' | 'getAll' | 'put' | 'transaction'
>

export type LinkhavenTransaction = Pick<
  IDBPTransaction<unknown, string[], 'readwrite'>,
  'done' | 'objectStore'
>

export type LinkhavenObjectStore = Pick<
  IDBPObjectStore<unknown, string[], string, 'readwrite'>,
  'delete' | 'getAllKeys' | 'put'
>

export type LinkhavenStorageBackend = {
  kind: string
  openDatabase: () => Promise<LinkhavenDb>
}

let activeStorageBackend: LinkhavenStorageBackend | null = null

export function registerLinkhavenStorageBackend(
  storageBackend: LinkhavenStorageBackend,
) {
  activeStorageBackend = storageBackend
}

export function getLinkhavenStorageBackend() {
  if (!activeStorageBackend) {
    throw new Error('No Linkhaven storage backend has been registered.')
  }

  return activeStorageBackend
}
