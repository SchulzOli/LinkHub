import { describe, expect, it } from 'vitest'

import type { ImageAsset } from '../../../src/contracts/imageAsset'
import type { TemplateDocument } from '../../../src/contracts/template'
import type { StoredImageAssetRecord } from '../../../src/storage/imageRepository'
import {
  registerLinkHubStorageBackend,
  STORAGE_STORES,
  type LinkHubStorageBackend,
} from '../../../src/storage/storageBackend'
import {
  deleteTemplate,
  getTemplate,
  getTemplateImageRecords,
  listTemplates,
  putTemplate,
} from '../../../src/storage/templateRepository'

function createInMemoryBackend(): LinkHubStorageBackend {
  const stores = new Map<string, Map<string, unknown>>()

  for (const name of Object.values(STORAGE_STORES)) {
    stores.set(name, new Map<string, unknown>())
  }

  async function openDatabase() {
    return {
      async get(storeName: string, key: string) {
        return stores.get(storeName)?.get(key)
      },
      async getAll(storeName: string) {
        return Array.from(stores.get(storeName)?.values() ?? [])
      },
      async put(storeName: string, value: unknown, key: string) {
        stores.get(storeName)?.set(key, value)
      },
      transaction(storeNames: string[]) {
        return {
          done: Promise.resolve(),
          objectStore(name: string) {
            const store = stores.get(name)

            if (!store) {
              throw new Error(`unknown store ${name}`)
            }

            return {
              async delete(key: string) {
                store.delete(key)
              },
              async getAllKeys() {
                return Array.from(store.keys())
              },
              async put(value: unknown, key: string) {
                store.set(key, value)
              },
            }
          },
        }
      },
    } as never
  }

  return { kind: 'memory', openDatabase }
}

const TIMESTAMP = '2026-04-04T00:00:00.000Z'

function createAsset(id: string): ImageAsset {
  return {
    id,
    name: `Image ${id}`,
    originalFilename: `${id}.png`,
    mimeType: 'image/png',
    byteSize: 4,
    isAnimated: false,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  }
}

function createTemplate(
  id: string,
  updatedAt: string,
  imageIds: string[] = [],
): TemplateDocument {
  return {
    format: 'linkhub.template',
    version: 1,
    id,
    name: `Template ${id}`,
    createdAt: TIMESTAMP,
    updatedAt,
    content: {
      cards: [],
      groups: [],
      pictures: [],
      images: imageIds.map((imageId) => ({
        asset: createAsset(imageId),
        sourceImageId: imageId,
      })),
    },
  }
}

function createRecord(imageId: string): StoredImageAssetRecord {
  return {
    asset: createAsset(imageId),
    blob: new Blob([imageId], { type: 'image/png' }),
  }
}

describe('templateRepository (in-memory backend)', () => {
  it('persists a template with its image blobs and returns records on read', async () => {
    registerLinkHubStorageBackend(createInMemoryBackend())

    const template = createTemplate('t-1', '2026-04-02T00:00:00.000Z', [
      'img-1',
      'img-2',
    ])

    await putTemplate({
      template,
      records: [createRecord('img-1'), createRecord('img-2')],
    })

    expect((await getTemplate('t-1'))?.id).toBe('t-1')

    const records = await getTemplateImageRecords('t-1')
    expect(records.map((record) => record.asset.id).sort()).toEqual([
      'img-1',
      'img-2',
    ])
  })

  it('lists templates sorted by updatedAt descending', async () => {
    registerLinkHubStorageBackend(createInMemoryBackend())

    await putTemplate({
      template: createTemplate('older', '2026-01-01T00:00:00.000Z'),
      records: [],
    })
    await putTemplate({
      template: createTemplate('newer', '2026-04-01T00:00:00.000Z'),
      records: [],
    })

    const templates = await listTemplates()

    expect(templates.map((template) => template.id)).toEqual(['newer', 'older'])
  })

  it('returns null / empty for missing templates', async () => {
    registerLinkHubStorageBackend(createInMemoryBackend())

    expect(await getTemplate('missing')).toBeNull()
    expect(await getTemplateImageRecords('missing')).toEqual([])
  })

  it('prunes image assets/blobs on overwrite and deletes them on delete', async () => {
    registerLinkHubStorageBackend(createInMemoryBackend())

    await putTemplate({
      template: createTemplate('t-1', '2026-04-01T00:00:00.000Z', [
        'img-1',
        'img-2',
      ]),
      records: [createRecord('img-1'), createRecord('img-2')],
    })

    // Re-save with only one image -> the other should be pruned.
    await putTemplate({
      template: createTemplate('t-1', '2026-04-02T00:00:00.000Z', ['img-1']),
      records: [createRecord('img-1')],
    })

    const remaining = await getTemplateImageRecords('t-1')
    expect(remaining.map((record) => record.asset.id)).toEqual(['img-1'])

    await deleteTemplate('t-1')

    expect(await getTemplate('t-1')).toBeNull()
    expect(await getTemplateImageRecords('t-1')).toEqual([])
  })
})
