import { beforeEach, describe, expect, it } from 'vitest'

import {
  createDefaultWorkspace,
  DEFAULT_WORKSPACE_ID,
} from '../../../src/contracts/workspace'
import { createWorkspaceSummary } from '../../../src/contracts/workspaceDirectory'
import {
  registerLinkHubStorageBackend,
  STORAGE_STORES,
  type LinkHubStorageBackend,
} from '../../../src/storage/storageBackend'
import {
  createNextWorkspaceName,
  createWorkspaceRecord,
  deleteWorkspaceRecord,
  getWorkspaceSnapshotByteSize,
  loadWorkspace,
  loadWorkspaceDirectory,
  loadWorkspaceSession,
  saveWorkspace,
  saveWorkspaceDirectory,
} from '../../../src/storage/workspaceRepository'

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
      transaction(storeNames: string | string[]) {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames]

        return {
          done: Promise.resolve(),
          objectStore(name: string) {
            if (!names.includes(name)) {
              throw new Error(`store ${name} not in transaction`)
            }

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

function createThrowingBackend(): LinkHubStorageBackend {
  return {
    kind: 'throwing',
    async openDatabase() {
      throw new Error('no database')
    },
  }
}

describe('createNextWorkspaceName', () => {
  it('starts numbering after the existing summaries', () => {
    const w1 = createWorkspaceSummary(
      createDefaultWorkspace({ id: 'a', name: 'Board 1' }),
    )
    const w2 = createWorkspaceSummary(
      createDefaultWorkspace({ id: 'b', name: 'Board 2' }),
    )

    expect(createNextWorkspaceName([w1, w2])).toBe('Board 3')
  })

  it('skips numbers already used (case-insensitive)', () => {
    const summaries = [
      createWorkspaceSummary(
        createDefaultWorkspace({ id: 'a', name: 'board 2' }),
      ),
    ]

    // With 1 summary, numbering starts at 2 - which is taken - so it bumps to 3.
    expect(createNextWorkspaceName(summaries)).toBe('Board 3')
  })

  it('returns Board 1 when there are no summaries', () => {
    expect(createNextWorkspaceName([])).toBe('Board 1')
  })
})

describe('createWorkspaceRecord', () => {
  it('creates a workspace with a unique id and generated name', () => {
    const record = createWorkspaceRecord([])

    expect(record.id).toMatch(/.+/)
    expect(record.name).toBe('Board 1')
  })
})

describe('getWorkspaceSnapshotByteSize', () => {
  it('returns a positive byte size for a default workspace', () => {
    const size = getWorkspaceSnapshotByteSize(createDefaultWorkspace())

    expect(size).toBeGreaterThan(0)
  })
})

describe('workspace persistence (in-memory backend)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    registerLinkHubStorageBackend(createInMemoryBackend())
  })

  it('saves and reloads a workspace through IDB', async () => {
    const workspace = createDefaultWorkspace({
      id: 'ws-1',
      name: 'Saved',
    })

    await saveWorkspace(workspace)

    const loaded = await loadWorkspace('ws-1')
    expect(loaded?.name).toBe('Saved')
  })

  it('creates, lists, and persists the directory via loadWorkspaceSession', async () => {
    const session = await loadWorkspaceSession()

    expect(session.activeWorkspaceId).toBe(DEFAULT_WORKSPACE_ID)
    expect(session.workspaceSummaries.length).toBeGreaterThan(0)

    // Directory should have been auto-persisted, so a second load sees it.
    const directory = await loadWorkspaceDirectory()
    expect(
      directory.workspaces.some(
        (workspace) => workspace.id === DEFAULT_WORKSPACE_ID,
      ),
    ).toBe(true)
  })

  it('stores and retrieves a custom directory state', async () => {
    const workspace = createDefaultWorkspace({ id: 'ws-2', name: 'Two' })
    await saveWorkspace(workspace)

    await saveWorkspaceDirectory({
      activeWorkspaceId: workspace.id,
      interactionMode: 'view',
      workspaceRailPinned: true,
      workspaces: [createWorkspaceSummary(workspace)],
    })

    const reloaded = await loadWorkspaceDirectory()
    expect(reloaded.activeWorkspaceId).toBe('ws-2')
    expect(reloaded.interactionMode).toBe('view')
    expect(reloaded.workspaceRailPinned).toBe(true)
  })

  it('removes a workspace via deleteWorkspaceRecord', async () => {
    const workspace = createDefaultWorkspace({ id: 'ws-3', name: 'Three' })
    await saveWorkspace(workspace)

    await deleteWorkspaceRecord('ws-3')

    expect(await loadWorkspace('ws-3')).toBeNull()
  })
})

describe('workspace persistence (unavailable IDB)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    registerLinkHubStorageBackend(createThrowingBackend())
  })

  it('falls back to localStorage when IDB is unavailable', async () => {
    const workspace = createDefaultWorkspace({
      id: 'ws-fallback',
      name: 'Fallback',
    })

    await saveWorkspace(workspace)

    // The workspace should have been written as a fallback record.
    const rawFallback = window.localStorage.getItem(
      `linkhub.workspace.${workspace.id}`,
    )
    expect(rawFallback).not.toBeNull()

    // loadWorkspace should read from the fallback.
    const reloaded = await loadWorkspace('ws-fallback')
    expect(reloaded?.name).toBe('Fallback')
  })

  it('returns a normalized directory from the localStorage fallback', async () => {
    const directory = await loadWorkspaceDirectory()

    expect(directory.workspaces.length).toBeGreaterThan(0)
  })
})
