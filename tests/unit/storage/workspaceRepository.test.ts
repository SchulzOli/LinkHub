import { beforeEach, describe, expect, it } from 'vitest'

import { createDefaultWorkspace } from '../../../src/contracts/workspace'
import { createWorkspaceSummary } from '../../../src/contracts/workspaceDirectory'
import { openLinkHubDb, STORAGE_STORES } from '../../../src/storage/db'
import {
  createWorkspaceRecord,
  loadWorkspace,
  loadWorkspaceSession,
  saveWorkspace,
  saveWorkspaceDirectory,
} from '../../../src/storage/workspaceRepository'

const itWithIndexedDb = typeof indexedDB === 'undefined' ? it.skip : it

async function clearAllStores() {
  const db = await openLinkHubDb()
  const names = Object.values(STORAGE_STORES)
  const transaction = db.transaction(names, 'readwrite')

  await Promise.all(
    names.map(async (name) => {
      const store = transaction.objectStore(name)
      const keys = (await store.getAllKeys()) as string[]

      await Promise.all(keys.map((key) => store.delete(key)))
    }),
  )

  await transaction.done
}

describe('workspace repository', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await clearAllStores()
  })

  itWithIndexedDb(
    'creates a workspace directory from the legacy default workspace',
    async () => {
      const workspace = createDefaultWorkspace({ name: 'Home' })

      await saveWorkspace(workspace)

      const session = await loadWorkspaceSession()

      expect(session.activeWorkspaceId).toBe(workspace.id)
      expect(session.workspace.id).toBe(workspace.id)
      expect(session.workspaceSummaries).toEqual([
        {
          id: workspace.id,
          name: 'Home',
        },
      ])
      expect(session.interactionMode).toBe('edit')
      expect(session.workspaceRailPinned).toBe(false)
    },
  )

  itWithIndexedDb(
    'loads the selected active workspace from a saved directory',
    async () => {
      const homeWorkspace = createDefaultWorkspace({ name: 'Home' })
      const secondWorkspace = createWorkspaceRecord([
        createWorkspaceSummary(homeWorkspace),
      ])

      await saveWorkspace(homeWorkspace)
      await saveWorkspace(secondWorkspace)
      await saveWorkspaceDirectory({
        activeWorkspaceId: secondWorkspace.id,
        interactionMode: 'view',
        workspaceRailPinned: true,
        workspaces: [
          createWorkspaceSummary(homeWorkspace),
          createWorkspaceSummary(secondWorkspace),
        ],
      })

      const session = await loadWorkspaceSession()
      const loadedHomeWorkspace = await loadWorkspace(homeWorkspace.id)

      expect(session.activeWorkspaceId).toBe(secondWorkspace.id)
      expect(session.interactionMode).toBe('view')
      expect(session.workspace.id).toBe(secondWorkspace.id)
      expect(session.workspace.name).toBe(secondWorkspace.name)
      expect(session.workspaceRailPinned).toBe(true)
      expect(session.workspaceSummaries).toHaveLength(2)
      expect(loadedHomeWorkspace?.name).toBe('Home')
    },
  )

  itWithIndexedDb(
    'defaults interaction mode to edit for legacy workspace directories',
    async () => {
      const homeWorkspace = createDefaultWorkspace({ name: 'Home' })

      await saveWorkspace(homeWorkspace)

      // Seed a legacy directory (missing `interactionMode`) directly into IDB,
      // simulating a pre-2026 persisted directory.
      const db = await openLinkHubDb()
      await db.put(
        STORAGE_STORES.workspaceMetadata,
        {
          activeWorkspaceId: homeWorkspace.id,
          workspaceRailPinned: true,
          workspaces: [createWorkspaceSummary(homeWorkspace)],
        },
        'app',
      )

      const session = await loadWorkspaceSession()

      expect(session.interactionMode).toBe('edit')
      expect(session.workspaceRailPinned).toBe(true)
    },
  )
})
