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

// IndexedDB-Health: solange `null`, ist der Zustand unbekannt und
// localStorage wird als defensiver Fallback weiter beschrieben.
// Nach einem erfolgreichen IDB-Write → `true` → localStorage-Writes
// im Hot-Path entfallen. Nach einem IDB-Fehler → `false` → localStorage
// bleibt als last-known-good erhalten.
let indexedDbHealthy: boolean | null = null

function markIndexedDbHealthy() {
  indexedDbHealthy = true
}

function markIndexedDbUnhealthy() {
  indexedDbHealthy = false
}

// Einmaliger IDB-Probe beim Modul-Load, damit `saveWorkspaceSnapshot`
// möglichst schnell in den IDB-only-Modus schaltet.
void (async () => {
  try {
    await openLinkHubDb()
    if (indexedDbHealthy === null) {
      markIndexedDbHealthy()
    }
  } catch {
    if (indexedDbHealthy === null) {
      markIndexedDbUnhealthy()
    }
  }
})()

function getFallbackWorkspaceKey(workspaceId: string) {
  return `${FALLBACK_WORKSPACE_KEY_PREFIX}${workspaceId}`
}

function serializeWorkspaceSnapshot(workspace: Workspace) {
  return JSON.stringify(workspace)
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
  const serialized = serializeWorkspaceSnapshot(workspace)

  // localStorage hat ein hartes Quota (~5 MB in den meisten Browsern).
  // Bei Überschreitung würde `setItem` synchron einen Fehler werfen und
  // im Hot-Path den Main-Thread stören. Wir brechen vorher ab und
  // räumen einen eventuell veralteten Eintrag auf – IDB bleibt die
  // Source-of-Truth.
  if (
    estimateLocalStorageStringBytes(serialized) >
    LOCAL_STORAGE_PRACTICAL_LIMIT_BYTES
  ) {
    try {
      window.localStorage.removeItem(getFallbackWorkspaceKey(workspace.id))
    } catch {
      // ignore – Fallback war bereits best-effort.
    }
    return
  }

  try {
    window.localStorage.setItem(
      getFallbackWorkspaceKey(workspace.id),
      serialized,
    )
  } catch {
    // Quota oder Private-Mode: IDB bleibt zuständig.
  }
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

function writeActiveWorkspaceFallback(workspace: Workspace) {
  const serialized = serializeWorkspaceSnapshot(workspace)

  if (
    estimateLocalStorageStringBytes(serialized) >
    LOCAL_STORAGE_PRACTICAL_LIMIT_BYTES
  ) {
    try {
      window.localStorage.removeItem(FALLBACK_ACTIVE_WORKSPACE_KEY)
    } catch {
      // ignore – Fallback ist best-effort.
    }
    return
  }

  try {
    window.localStorage.setItem(FALLBACK_ACTIVE_WORKSPACE_KEY, serialized)
  } catch {
    // Quota oder Private-Mode: IDB bleibt zuständig.
  }
}

export function saveWorkspaceSnapshot(workspace: Workspace) {
  // IDB ist Primärpfad, aber `saveWorkspace` läuft asynchron und ist
  // auf `pagehide`/Reload nicht mehr garantiert flushbar. Deshalb
  // schreibt der Snapshot immer synchron nach localStorage als
  // last-known-good, damit ein Reload jede Mutation wieder sieht,
  // selbst wenn die IDB-Transaktion beim Unload abbricht.
  writeActiveWorkspaceFallback(workspace)
  writeWorkspaceFallbackRecord(workspace)
}

export function getWorkspaceSnapshotByteSize(workspace: Workspace) {
  return estimateLocalStorageStringBytes(serializeWorkspaceSnapshot(workspace))
}

export async function saveWorkspace(workspace: Workspace) {
  try {
    const db = await openLinkHubDb()
    await db.put(STORAGE_STORES.workspace, workspace, workspace.id)
    markIndexedDbHealthy()
  } catch {
    markIndexedDbUnhealthy()
    // Last-known-good in localStorage sichern, damit der nächste
    // App-Start auch ohne IDB einen Workspace wiederherstellen kann.
    writeWorkspaceFallbackRecord(workspace)
    writeActiveWorkspaceFallback(workspace)
  }
}

export async function saveWorkspaceDirectory(directory: WorkspaceDirectory) {
  try {
    const db = await openLinkHubDb()
    await db.put(
      STORAGE_STORES.workspaceMetadata,
      directory,
      WORKSPACE_DIRECTORY_KEY,
    )
    markIndexedDbHealthy()
  } catch {
    markIndexedDbUnhealthy()
    window.localStorage.setItem(
      FALLBACK_DIRECTORY_KEY,
      JSON.stringify(directory),
    )
  }
}

export async function deleteWorkspaceRecord(workspaceId: string) {
  try {
    const db = await openLinkHubDb()
    const transaction = db.transaction(STORAGE_STORES.workspace, 'readwrite')

    await transaction.objectStore(STORAGE_STORES.workspace).delete(workspaceId)
    await transaction.done
    markIndexedDbHealthy()
    // Altbestand im localStorage-Fallback aufräumen, falls ein
    // früherer Unhealthy-Lauf dort noch einen Eintrag hinterlassen hat.
    window.localStorage.removeItem(getFallbackWorkspaceKey(workspaceId))
  } catch {
    markIndexedDbUnhealthy()
    window.localStorage.removeItem(getFallbackWorkspaceKey(workspaceId))
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
