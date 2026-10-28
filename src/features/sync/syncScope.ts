import { syncRecordKind, type SyncBase, type SyncRecordMap } from './syncMerge'

/**
 * Which workspaces a device syncs. "all" is the default. With "chosen",
 * only the listed workspaces (and the images they use) are exchanged:
 * everything else is left alone on both sides, so a work computer can
 * share one workspace without ever receiving the others, and its own
 * other workspaces stay on it.
 */
export type SyncScope =
  | { mode: 'all' }
  | { mode: 'chosen'; workspaceIds: string[] }

export const SYNC_ALL_WORKSPACES: SyncScope = { mode: 'all' }

const WORKSPACE_PREFIX = 'workspace:'

/** The images a synced workspace uses: card icons and picture nodes. */
export function workspaceImageIds(data: unknown): string[] {
  if (!data || typeof data !== 'object') {
    return []
  }

  const { cards, pictures } = data as { cards?: unknown; pictures?: unknown }
  const ids: string[] = []

  for (const card of Array.isArray(cards) ? cards : []) {
    const id = (card as { faviconOverrideImageId?: unknown })
      ?.faviconOverrideImageId

    if (typeof id === 'string') {
      ids.push(id)
    }
  }

  for (const picture of Array.isArray(pictures) ? pictures : []) {
    const { type, imageId } = (picture ?? {}) as {
      type?: unknown
      imageId?: unknown
    }

    if (type === 'picture' && typeof imageId === 'string') {
      ids.push(imageId)
    }
  }

  return ids
}

export type ScopedRecords = {
  local: SyncRecordMap
  remote: SyncRecordMap
  base: SyncBase
  /** Remote records outside the scope; written back untouched. */
  outside: SyncRecordMap
}

/**
 * Narrows both sides and the base to what this device syncs. The base
 * forgets records outside the scope, so choosing a workspace later starts
 * from "never synced": a remote-only one is pulled, a local-only one sent.
 */
export function scopeSyncRecords(
  scope: SyncScope | undefined,
  local: SyncRecordMap,
  remote: SyncRecordMap,
  base: SyncBase,
): ScopedRecords {
  if (!scope || scope.mode === 'all') {
    return { local, remote, base, outside: {} }
  }

  const chosen = new Set(
    scope.workspaceIds.map((id) => `${WORKSPACE_PREFIX}${id}`),
  )
  const images = new Set<string>()

  for (const records of [local, remote]) {
    for (const [key, record] of Object.entries(records)) {
      if (chosen.has(key)) {
        for (const id of workspaceImageIds(record.data)) {
          images.add(`image:${id}`)
        }
      }
    }
  }

  const inScope = (key: string) => {
    switch (syncRecordKind(key)) {
      case 'workspace':
        return chosen.has(key)
      case 'image':
        return images.has(key)
      // The order of all workspaces belongs to the devices that sync all.
      case 'directory':
        return false
      default:
        return true
    }
  }
  const pick = <T>(records: Record<string, T>, keep: boolean) =>
    Object.fromEntries(
      Object.entries(records).filter(([key]) => inScope(key) === keep),
    ) as Record<string, T>

  return {
    local: pick(local, true),
    remote: pick(remote, true),
    base: pick(base, true),
    outside: pick(remote, false),
  }
}

/** The workspaces in a remote record map, for choosing what to sync. */
export function listRemoteWorkspaces(records: SyncRecordMap) {
  return Object.entries(records)
    .filter(([key]) => key.startsWith(WORKSPACE_PREFIX))
    .map(([key, record]) => {
      const name = (record.data as { name?: unknown } | null)?.name

      return {
        id: key.slice(WORKSPACE_PREFIX.length),
        name: typeof name === 'string' && name.trim() ? name : 'Workspace',
      }
    })
}
