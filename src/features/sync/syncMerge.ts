/**
 * Three-way merge of sync records. Every record (a workspace, a theme, an
 * image, the workspace order) has a content hash; `base` holds the hashes
 * both sides agreed on at the last sync. Comparing local and remote with
 * that base tells who changed what, so deletions need no tombstones:
 *
 * - only one side changed → that side wins (an edit or a deletion)
 * - both changed → an edit beats a deletion; content beats an empty
 *   workspace (a fresh install's Home); otherwise the newer edit wins and
 *   the losing workspace is kept as a conflict copy, whichever side lost
 */

export type SyncRecord = {
  hash: string
  /** ISO time of the last edit, used to pick a winner on conflicts. */
  updatedAt: string
  data: unknown
  /** An empty workspace; it never wins a conflict against content. */
  empty?: boolean
}

export type SyncRecordMap = Record<string, SyncRecord>
export type SyncBase = Record<string, string>

export type SyncMergePlan = {
  /** Records to write locally (new or changed on another device). */
  applyLocal: string[]
  /** Records to remove locally (deleted on another device). */
  deleteLocal: string[]
  /** Records to upload (new or changed here). */
  pushRemote: string[]
  /** Records to remove from the remote state (deleted here). */
  deleteRemote: string[]
  /** Workspace versions that lost a conflict; keep them as copies. */
  conflictCopies: Array<{ key: string; from: 'local' | 'remote' }>
  /** The remote record map after the merge. */
  remote: SyncRecordMap
  /** Hashes both sides agree on after the merge. */
  base: SyncBase
}

export function syncRecordKind(key: string) {
  return key.split(':', 1)[0]
}

function newerWins(local: SyncRecord, remote: SyncRecord) {
  if (local.updatedAt !== remote.updatedAt) {
    return local.updatedAt > remote.updatedAt ? 'local' : 'remote'
  }

  // Same time: both devices must agree, so compare something both see.
  return local.hash > remote.hash ? 'local' : 'remote'
}

export function mergeSyncRecords(
  local: SyncRecordMap,
  remote: SyncRecordMap,
  base: SyncBase,
): SyncMergePlan {
  const plan: SyncMergePlan = {
    applyLocal: [],
    deleteLocal: [],
    pushRemote: [],
    deleteRemote: [],
    conflictCopies: [],
    remote: { ...remote },
    base: {},
  }
  const keys = new Set([
    ...Object.keys(local),
    ...Object.keys(remote),
    ...Object.keys(base),
  ])

  const takeRemote = (key: string) => {
    const record = remote[key]

    if (record) {
      plan.applyLocal.push(key)
      plan.base[key] = record.hash
    } else if (local[key]) {
      plan.deleteLocal.push(key)
    }
  }

  const takeLocal = (key: string) => {
    const record = local[key]

    if (record) {
      plan.pushRemote.push(key)
      plan.remote[key] = record
      plan.base[key] = record.hash
    } else if (remote[key]) {
      plan.deleteRemote.push(key)
      delete plan.remote[key]
    }
  }

  for (const key of [...keys].sort()) {
    const localHash = local[key]?.hash
    const remoteHash = remote[key]?.hash
    const baseHash = base[key]

    if (localHash === remoteHash) {
      if (localHash !== undefined) {
        plan.base[key] = localHash
      }
      continue
    }

    if (localHash === baseHash) {
      takeRemote(key)
      continue
    }

    if (remoteHash === baseHash) {
      takeLocal(key)
      continue
    }

    // Both sides changed it since the last sync.
    if (localHash === undefined) {
      takeRemote(key)
      continue
    }

    if (remoteHash === undefined) {
      takeLocal(key)
      continue
    }

    const localRecord = local[key]
    const remoteRecord = remote[key]
    const winner =
      localRecord.empty && !remoteRecord.empty
        ? 'remote'
        : remoteRecord.empty && !localRecord.empty
          ? 'local'
          : newerWins(localRecord, remoteRecord)
    const loser = winner === 'local' ? remoteRecord : localRecord

    if (winner === 'local') {
      takeLocal(key)
    } else {
      takeRemote(key)
    }

    if (syncRecordKind(key) === 'workspace' && !loser.empty) {
      plan.conflictCopies.push({
        key,
        from: winner === 'local' ? 'remote' : 'local',
      })
    }
  }

  return plan
}

/** Key-sorted JSON, so equal content always hashes the same. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item ?? null)).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))

    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`
  }

  return JSON.stringify(value) ?? 'null'
}

export async function hashSyncContent(value: unknown) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(stableStringify(value)),
  )

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
