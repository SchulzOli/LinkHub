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

export type LinkHubStoreName =
  (typeof STORAGE_STORES)[keyof typeof STORAGE_STORES]

export type LinkHubDb = Pick<
  IDBPDatabase<unknown>,
  'get' | 'getAll' | 'put' | 'transaction'
>

export type LinkHubTransaction = Pick<
  IDBPTransaction<unknown, string[], 'readwrite'>,
  'done' | 'objectStore'
>

export type LinkHubObjectStore = Pick<
  IDBPObjectStore<unknown, string[], string, 'readwrite'>,
  'delete' | 'getAllKeys' | 'put'
>

export type LinkHubStorageBackend = {
  kind: string
  openDatabase: () => Promise<LinkHubDb>
}

let activeStorageBackend: LinkHubStorageBackend | null = null

export function registerLinkHubStorageBackend(
  storageBackend: LinkHubStorageBackend,
) {
  activeStorageBackend = storageBackend
}

export function getLinkHubStorageBackend() {
  if (!activeStorageBackend) {
    throw new Error('No LinkHub storage backend has been registered.')
  }

  return activeStorageBackend
}
