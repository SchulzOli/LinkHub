import {
  createDefaultWorkspace,
  DEFAULT_WORKSPACE_ID,
  type Workspace,
} from '../contracts/workspace'
import {
  createDefaultWorkspaceDirectory,
  createWorkspaceSummary,
  WorkspaceDirectorySchema,
  type WorkspaceDirectory,
  type WorkspaceSummary,
} from '../contracts/workspaceDirectory'
import { createId } from '../utils/id'
import { openLinkHubDb, STORAGE_STORES } from './db'
import { ensureLatestWorkspace } from './storageMigrations'

const FALLBACK_ACTIVE_WORKSPACE_KEY = 'linkhub.workspace'
const FALLBACK_DIRECTORY_KEY = 'linkhub.workspace-directory'
const FALLBACK_WORKSPACE_KEY_PREFIX = 'linkhub.workspace.'
const WORKSPACE_DIRECTORY_KEY = 'app'

export const LOCAL_STORAGE_PRACTICAL_LIMIT_BYTES = 5 * 1024 * 1024

export type WorkspaceSession = {
  activeWorkspaceId: string
  interactionMode: WorkspaceDirectory['interactionMode']
  workspace: Workspace
  workspaceRailPinned: boolean
  workspaceSummaries: WorkspaceSummary[]
}

function getFallbackWorkspaceKey(workspaceId: string) {
  return `${FALLBACK_WORKSPACE_KEY_PREFIX}${workspaceId}`
}

function toSerializableWorkspace(workspace: Workspace) {
  return JSON.parse(JSON.stringify(workspace))
}

function serializeWorkspaceSnapshot(workspace: Workspace) {
  return JSON.stringify(toSerializableWorkspace(workspace))
}

function estimateLocalStorageStringBytes(value: string) {
  return value.length * 2
}

function readJsonFromLocalStorage(key: string) {
  try {
    const raw = window.localStorage.getItem(key)

    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeWorkspaceFallbackRecord(workspace: Workspace) {
  window.localStorage.setItem(
    getFallbackWorkspaceKey(workspace.id),
    serializeWorkspaceSnapshot(workspace),
  )
}

function readFallbackWorkspaceSnapshot() {
  const raw = readJsonFromLocalStorage(FALLBACK_ACTIVE_WORKSPACE_KEY)

  return raw ? ensureLatestWorkspace(raw) : null
}

function readFallbackWorkspace(workspaceId: string) {
  const raw = readJsonFromLocalStorage(getFallbackWorkspaceKey(workspaceId))

  if (raw) {
    return ensureLatestWorkspace(raw)
  }

  if (workspaceId === DEFAULT_WORKSPACE_ID) {
    return readFallbackWorkspaceSnapshot()
  }

  return null
}

function normalizeWorkspaceDirectory(
  raw: unknown,
  fallbackWorkspace: Pick<Workspace, 'id' | 'name'>,
): WorkspaceDirectory {
  const parsed = WorkspaceDirectorySchema.safeParse(raw)

  if (!parsed.success) {
    return createDefaultWorkspaceDirectory(fallbackWorkspace)
  }

  const seenIds = new Set<string>()
  const workspaces = parsed.data.workspaces.filter((workspace) => {
    if (seenIds.has(workspace.id)) {
      return false
    }

    seenIds.add(workspace.id)
    return true
  })

  if (workspaces.length === 0) {
    return createDefaultWorkspaceDirectory(fallbackWorkspace)
  }

  const activeWorkspaceId = workspaces.some(
    (workspace) => workspace.id === parsed.data.activeWorkspaceId,
  )
    ? parsed.data.activeWorkspaceId
    : workspaces[0].id

  return {
    activeWorkspaceId,
    interactionMode: parsed.data.interactionMode,
    workspaceRailPinned: parsed.data.workspaceRailPinned,
    workspaces,
  }
}

async function loadStoredWorkspaceRecord(workspaceId: string) {
  try {
    const db = await openLinkHubDb()
    const raw = await db.get(STORAGE_STORES.workspace, workspaceId)

    return raw ? ensureLatestWorkspace(raw) : null
  } catch {
    return readFallbackWorkspace(workspaceId)
  }
}

async function loadSeedWorkspace() {
  return (
    (await loadStoredWorkspaceRecord(DEFAULT_WORKSPACE_ID)) ??
    readFallbackWorkspaceSnapshot() ??
    createDefaultWorkspace()
  )
}

export async function loadWorkspace(workspaceId: string) {
  return loadStoredWorkspaceRecord(workspaceId)
}

export async function loadWorkspaceDirectory() {
  const seedWorkspace = await loadSeedWorkspace()

  try {
    const db = await openLinkHubDb()
    const raw = await db.get(
      STORAGE_STORES.workspaceMetadata,
      WORKSPACE_DIRECTORY_KEY,
    )
    const directory = normalizeWorkspaceDirectory(raw, seedWorkspace)

    if (!raw) {
      await saveWorkspaceDirectory(directory)
    }

    return directory
  } catch {
    const fallbackDirectory = readJsonFromLocalStorage(FALLBACK_DIRECTORY_KEY)

    return normalizeWorkspaceDirectory(fallbackDirectory, seedWorkspace)
  }
}

export async function loadWorkspaceSession(): Promise<WorkspaceSession> {
  const seedWorkspace = await loadSeedWorkspace()
  const activeWorkspaceSnapshot = readFallbackWorkspaceSnapshot()
  let directory = await loadWorkspaceDirectory()
  const activeSummary =
    directory.workspaces.find(
      (workspace) => workspace.id === directory.activeWorkspaceId,
    ) ??
    directory.workspaces[0] ??
    createWorkspaceSummary(seedWorkspace)
  const loadedWorkspace = await loadWorkspace(activeSummary.id)
  const workspace =
    (activeWorkspaceSnapshot?.id === activeSummary.id
      ? activeWorkspaceSnapshot
      : null) ??
    loadedWorkspace ??
    createDefaultWorkspace({
      id: activeSummary.id,
      name: activeSummary.name,
    })
  const hasActiveSummary = directory.workspaces.some(
    (summary) => summary.id === workspace.id,
  )

  if (!hasActiveSummary) {
    directory = {
      ...directory,
      activeWorkspaceId: workspace.id,
      workspaces: [...directory.workspaces, createWorkspaceSummary(workspace)],
    }
    await saveWorkspaceDirectory(directory)
  }

  if (!loadedWorkspace) {
    await saveWorkspace(workspace)
  }

  return {
    activeWorkspaceId: workspace.id,
    interactionMode: directory.interactionMode,
    workspace,
    workspaceRailPinned: directory.workspaceRailPinned,
    workspaceSummaries: directory.workspaces,
  }
}

export function saveWorkspaceSnapshot(workspace: Workspace) {
  window.localStorage.setItem(
    FALLBACK_ACTIVE_WORKSPACE_KEY,
    serializeWorkspaceSnapshot(workspace),
  )
  writeWorkspaceFallbackRecord(workspace)
}

export function getWorkspaceSnapshotByteSize(workspace: Workspace) {
  return estimateLocalStorageStringBytes(serializeWorkspaceSnapshot(workspace))
}

export async function saveWorkspace(workspace: Workspace) {
  const serializable = toSerializableWorkspace(workspace)

  writeWorkspaceFallbackRecord(workspace)

  try {
    const db = await openLinkHubDb()
    await db.put(STORAGE_STORES.workspace, serializable, workspace.id)
  } catch {
    // localStorage fallback already written
  }
}

export async function saveWorkspaceDirectory(directory: WorkspaceDirectory) {
  window.localStorage.setItem(FALLBACK_DIRECTORY_KEY, JSON.stringify(directory))

  try {
    const db = await openLinkHubDb()
    await db.put(
      STORAGE_STORES.workspaceMetadata,
      directory,
      WORKSPACE_DIRECTORY_KEY,
    )
  } catch {
    // localStorage fallback already written
  }
}

export async function deleteWorkspaceRecord(workspaceId: string) {
  window.localStorage.removeItem(getFallbackWorkspaceKey(workspaceId))

  try {
    const db = await openLinkHubDb()
    const transaction = db.transaction(STORAGE_STORES.workspace, 'readwrite')

    await transaction.objectStore(STORAGE_STORES.workspace).delete(workspaceId)
    await transaction.done
  } catch {
    // localStorage fallback already updated
  }
}

export function createNextWorkspaceName(
  workspaceSummaries: WorkspaceSummary[],
) {
  const existingNames = new Set(
    workspaceSummaries.map((workspace) => workspace.name.trim().toLowerCase()),
  )
  let index = workspaceSummaries.length + 1

  while (existingNames.has(`board ${index}`)) {
    index += 1
  }

  return `Board ${index}`
}

export function createWorkspaceRecord(workspaceSummaries: WorkspaceSummary[]) {
  return createDefaultWorkspace({
    id: createId(),
    name: createNextWorkspaceName(workspaceSummaries),
  })
}
