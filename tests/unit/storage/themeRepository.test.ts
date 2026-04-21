import { afterEach, describe, expect, it } from 'vitest'

import { defaultAppearanceProfile } from '../../../src/contracts/appearanceProfile'
import { createThemeFromAppearance } from '../../../src/features/themes/themeLibrary'
import {
  registerLinkHubStorageBackend,
  STORAGE_STORES,
  type LinkHubStorageBackend,
} from '../../../src/storage/storageBackend'
import {
  deleteTheme,
  getTheme,
  listThemes,
  putTheme,
} from '../../../src/storage/themeRepository'

type Store = Map<string, unknown>
type StoreBag = Record<string, Store>

function createInMemoryBackend(): LinkHubStorageBackend {
  const stores: StoreBag = {}

  for (const name of Object.values(STORAGE_STORES)) {
    stores[name] = new Map<string, unknown>()
  }

  async function openDatabase() {
    return {
      async get(storeName: string, key: string) {
        return stores[storeName]?.get(key)
      },
      async getAll(storeName: string) {
        return Array.from(stores[storeName]?.values() ?? [])
      },
      async put(storeName: string, value: unknown, key: string) {
        stores[storeName]?.set(key, value)
      },
      transaction(storeNames: string[]) {
        const objectStores: Record<string, unknown> = {}

        for (const name of storeNames) {
          objectStores[name] = {
            async delete(key: string) {
              stores[name]?.delete(key)
            },
            async getAllKeys() {
              return Array.from(stores[name]?.keys() ?? [])
            },
            async put(value: unknown, key: string) {
              stores[name]?.set(key, value)
            },
          }
        }

        return {
          done: Promise.resolve(),
          objectStore(name: string) {
            return objectStores[name]
          },
        }
      },
    } as never
  }

  return { kind: 'memory', openDatabase }
}

describe('themeRepository', () => {
  afterEach(() => {
    // Reset by registering a clean backend for each next test.
    registerLinkHubStorageBackend(createInMemoryBackend())
  })

  it('persists, retrieves, lists, and deletes themes via the storage backend', async () => {
    registerLinkHubStorageBackend(createInMemoryBackend())

    const olderTheme = createThemeFromAppearance(
      defaultAppearanceProfile,
      'Older',
    )
    olderTheme.updatedAt = '2026-01-01T00:00:00.000Z'

    const newerTheme = createThemeFromAppearance(
      defaultAppearanceProfile,
      'Newer',
    )
    newerTheme.updatedAt = '2026-04-01T00:00:00.000Z'

    await putTheme(olderTheme)
    await putTheme(newerTheme)

    const fetched = await getTheme(newerTheme.id)
    expect(fetched?.name).toBe('Newer')

    const themes = await listThemes()
    expect(themes.map((theme) => theme.id)).toEqual([
      newerTheme.id,
      olderTheme.id,
    ])

    await deleteTheme(olderTheme.id)

    const afterDelete = await listThemes()
    expect(afterDelete.map((theme) => theme.id)).toEqual([newerTheme.id])
  })

  it('returns null for missing themes and ignores invalid payloads', async () => {
    registerLinkHubStorageBackend(createInMemoryBackend())

    expect(await getTheme('missing')).toBeNull()

    // Write a garbage record directly via put to prove list/get filter it out.
    const theme = createThemeFromAppearance(defaultAppearanceProfile, 'Valid')
    await putTheme(theme)

    // Inject an invalid record by using the backend directly.
    registerLinkHubStorageBackend({
      kind: 'mixed',
      async openDatabase() {
        return {
          async get() {
            return { not: 'a theme' }
          },
          async getAll() {
            return [{ bogus: true }, { also: 'bogus' }]
          },
          async put() {},
          transaction() {
            return {
              done: Promise.resolve(),
              objectStore() {
                return {
                  async delete() {},
                  async getAllKeys() {
                    return []
                  },
                  async put() {},
                }
              },
            }
          },
        } as never
      },
    })

    expect(await getTheme('anything')).toBeNull()
    expect(await listThemes()).toEqual([])
  })
})
