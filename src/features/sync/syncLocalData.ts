import { ImageAssetSchema, type ImageAsset } from '../../contracts/imageAsset'
import { ThemeDocumentSchema } from '../../contracts/theme'
import {
  createDefaultWorkspace,
  type Workspace,
} from '../../contracts/workspace'
import { createWorkspaceSummary } from '../../contracts/workspaceDirectory'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'
import { getPersistedWorkspace } from '../../state/workspaceStoreHelpers'
import { loadAutoDashboardSettings } from '../../storage/autoDashboardRepository'
import {
  deleteImageAsset,
  getImageBlob,
  listImageAssets,
  putStoredImageAssetRecord,
} from '../../storage/imageRepository'
import { ensureLatestWorkspace } from '../../storage/storageMigrations'
import {
  deleteTheme,
  listThemes,
  putTheme,
} from '../../storage/themeRepository'
import {
  loadWorkspace,
  saveWorkspace,
  saveWorkspaceDirectory,
  saveWorkspaceSnapshot,
} from '../../storage/workspaceRepository'
import { createId } from '../../utils/id'
import {
  hashSyncContent,
  syncRecordKind,
  type SyncRecord,
  type SyncRecordMap,
} from './syncMerge'

/**
 * What is synced: workspaces (without the per-device viewport and usage
 * statistics), their order, custom themes and uploaded images. The Auto
 * dashboard's workspace stays on each device, because it is built from
 * that device's own browsing.
 */

export const DIRECTORY_KEY = 'directory'

type SyncedWorkspace = Omit<Workspace, 'viewport' | 'analytics' | 'updatedAt'>

function toSyncedWorkspace(workspace: Workspace): SyncedWorkspace {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { viewport, analytics, updatedAt, ...synced } = workspace

  return synced
}

async function createRecord(
  data: unknown,
  updatedAt: string,
  empty?: boolean,
): Promise<SyncRecord> {
  const record: SyncRecord = {
    hash: await hashSyncContent(data),
    updatedAt,
    data,
  }

  if (empty) {
    record.empty = true
  }

  return record
}

function isEmptyWorkspace(workspace: Workspace) {
  return (
    workspace.cards.length === 0 &&
    workspace.groups.length === 0 &&
    workspace.pictures.length === 0
  )
}

export function workspaceKey(id: string) {
  return `workspace:${id}`
}

function recordId(key: string) {
  return key.slice(key.indexOf(':') + 1)
}

async function excludedWorkspaceIds() {
  try {
    const settings = await loadAutoDashboardSettings()

    return new Set(settings.workspaceId ? [settings.workspaceId] : [])
  } catch {
    return new Set<string>()
  }
}

export async function collectLocalSyncRecords(): Promise<SyncRecordMap> {
  const state = useWorkspaceStore.getState()
  const excluded = await excludedWorkspaceIds()
  const records: SyncRecordMap = {}
  const order: string[] = []

  for (const summary of state.workspaceSummaries) {
    if (excluded.has(summary.id)) {
      continue
    }

    const workspace =
      summary.id === state.activeWorkspaceId
        ? getPersistedWorkspace(state)
        : await loadWorkspace(summary.id)

    if (!workspace) {
      continue
    }

    order.push(summary.id)
    records[workspaceKey(summary.id)] = await createRecord(
      toSyncedWorkspace(workspace),
      workspace.updatedAt,
      isEmptyWorkspace(workspace),
    )
  }

  records[DIRECTORY_KEY] = await createRecord({ order }, '')

  for (const theme of await listThemes()) {
    records[`theme:${theme.id}`] = await createRecord(theme, theme.updatedAt)
  }

  for (const asset of await listImageAssets()) {
    // The thumbnail is rebuilt on each device from the image itself.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { thumbnail, ...synced } = asset

    records[`image:${asset.id}`] = await createRecord(synced, asset.updatedAt)
  }

  return records
}

/** The hash of the open workspace right now, to spot edits mid-sync. */
export async function hashActiveWorkspace() {
  const state = useWorkspaceStore.getState()

  return {
    id: state.activeWorkspaceId,
    hash: await hashSyncContent(
      toSyncedWorkspace(getPersistedWorkspace(state)),
    ),
  }
}

export function imageBlobPath(imageId: string) {
  return `images/${encodeURIComponent(imageId)}.bin`
}

export async function readLocalImageBlob(key: string) {
  return getImageBlob(recordId(key))
}

export type ApplyRemoteInput = {
  plan: {
    applyLocal: string[]
    deleteLocal: string[]
    conflictCopies: Array<{ key: string; from: 'local' | 'remote' }>
  }
  local: SyncRecordMap
  /** The remote records after the merge. */
  remote: SyncRecordMap
  /** The remote records as they were read, for conflict copies. */
  remoteBefore: SyncRecordMap
  /** Loads an image's file from the server. */
  loadImageBlob: (key: string, asset: ImageAsset) => Promise<Blob>
  /** Hash the open workspace had when the sync started. */
  activeHashAtStart: { id: string; hash: string }
}

/**
 * Writes the merge result into this device's storage and the open app.
 * Returns the keys it skipped (the open workspace was edited meanwhile),
 * so their base stays unchanged and the next sync looks at them again,
 * and the ids of the conflict copies it made.
 */
export async function applyRemoteSyncRecords(
  input: ApplyRemoteInput,
): Promise<{ skipped: string[]; copies: string[] }> {
  const skipped: string[] = []
  const copies: string[] = []
  const { plan, remote, local } = input
  const now = new Date().toISOString()
  const activeNow = await hashActiveWorkspace()
  const activeEdited =
    activeNow.id !== input.activeHashAtStart.id ||
    activeNow.hash !== input.activeHashAtStart.hash
  const touchesActive = (key: string) =>
    key === workspaceKey(useWorkspaceStore.getState().activeWorkspaceId)

  // Conflict copies first: they keep the losing version as its own
  // workspace, which the next round uploads.
  for (const { key, from } of plan.conflictCopies) {
    const record = from === 'local' ? local[key] : input.remoteBefore[key]

    if (!record || (from === 'local' && touchesActive(key) && activeEdited)) {
      continue
    }

    const data = record.data as SyncedWorkspace
    const copy = ensureLatestWorkspace({
      ...createDefaultWorkspace(),
      ...data,
      id: createId(),
      name: `${data.name} (conflict)`,
      updatedAt: now,
    })

    await saveWorkspace(copy)
    copies.push(copy.id)
    useWorkspaceStore.setState((state) => ({
      workspaceSummaries: [
        ...state.workspaceSummaries,
        createWorkspaceSummary(copy),
      ],
    }))
  }

  for (const key of plan.applyLocal) {
    const record = remote[key]
    const kind = syncRecordKind(key)

    if (!record || kind === DIRECTORY_KEY) {
      continue
    }

    if (kind === 'workspace') {
      if (touchesActive(key) && activeEdited) {
        skipped.push(key)
        continue
      }

      const id = recordId(key)
      const state = useWorkspaceStore.getState()
      const existing =
        id === state.activeWorkspaceId
          ? getPersistedWorkspace(state)
          : await loadWorkspace(id)
      const base = existing ?? createDefaultWorkspace()
      const next = ensureLatestWorkspace({
        ...(record.data as SyncedWorkspace),
        id,
        viewport: base.viewport,
        analytics: base.analytics,
        updatedAt: record.updatedAt || now,
      })

      await saveWorkspace(next)

      if (id === useWorkspaceStore.getState().activeWorkspaceId) {
        saveWorkspaceSnapshot(next)
        useWorkspaceStore.setState({
          workspace: next,
          viewport: next.viewport,
          undoStack: [],
          selectedCardIds: [],
          selectedGroupIds: [],
          selectedPictureIds: [],
        })
      }

      useWorkspaceStore.setState((current) => ({
        workspaceSummaries: current.workspaceSummaries.some(
          (summary) => summary.id === id,
        )
          ? current.workspaceSummaries.map((summary) =>
              summary.id === id ? createWorkspaceSummary(next) : summary,
            )
          : [...current.workspaceSummaries, createWorkspaceSummary(next)],
      }))
      continue
    }

    if (kind === 'theme') {
      const parsed = ThemeDocumentSchema.safeParse(record.data)

      if (parsed.success) {
        await putTheme(parsed.data)
      }
      continue
    }

    if (kind === 'image') {
      const parsed = ImageAssetSchema.safeParse(record.data)

      if (parsed.success) {
        const blob = await input.loadImageBlob(key, parsed.data)

        await putStoredImageAssetRecord({ asset: parsed.data, blob })
      }
    }
  }

  for (const key of plan.deleteLocal) {
    const kind = syncRecordKind(key)
    const id = recordId(key)

    if (kind === 'workspace') {
      const state = useWorkspaceStore.getState()

      if (touchesActive(key) && activeEdited) {
        skipped.push(key)
        continue
      }

      // The app always keeps at least one workspace.
      if (state.workspaceSummaries.length > 1) {
        await state.deleteWorkspace(id)
      } else {
        skipped.push(key)
      }
      continue
    }

    if (kind === 'theme') {
      await deleteTheme(id)
      continue
    }

    if (kind === 'image') {
      await deleteImageAsset(id)
    }
  }

  await applyWorkspaceOrder(remote[DIRECTORY_KEY]?.data)

  return { skipped, copies }
}

/** Puts the workspace list in the synced order; local-only ones go last. */
async function applyWorkspaceOrder(data: unknown) {
  const order =
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { order?: unknown }).order)
      ? ((data as { order: unknown[] }).order.filter(
          (id) => typeof id === 'string',
        ) as string[])
      : []
  const state = useWorkspaceStore.getState()
  const rank = new Map(order.map((id, index) => [id, index]))
  const summaries = [...state.workspaceSummaries].sort(
    (left, right) =>
      (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  )

  useWorkspaceStore.setState({ workspaceSummaries: summaries })
  // Also stores workspaces the sync added above.
  await saveWorkspaceDirectory({
    activeWorkspaceId: state.activeWorkspaceId,
    interactionMode: state.interactionMode,
    workspaceRailPinned: state.workspaceRailPinned,
    workspaces: summaries,
  })
}
