import type { TemplateDocument } from '../../contracts/template'
import type { ThemeDocument } from '../../contracts/theme'
import type { Workspace } from '../../contracts/workspace'
import {
  listStoredImageAssetRecords,
  type StoredImageAssetRecord,
} from '../../storage/imageRepository'
import {
  getTemplateImageRecords,
  listTemplates,
} from '../../storage/templateRepository'
import { listThemes } from '../../storage/themeRepository'
import {
  getWorkspaceSnapshotByteSize,
  LOCAL_STORAGE_PRACTICAL_LIMIT_BYTES,
} from '../../storage/workspaceRepository'
import { collectReferencedImageIds } from '../importExport/canvasBundle'

export type WorkspaceStorageBucketKey =
  | 'cards'
  | 'gallery'
  | 'groups'
  | 'pictures'
  | 'themes'
  | 'templates'

export type WorkspaceStorageBucket = {
  bytes: number
  itemCount: number
  linkedAssetCount?: number
}

export type WorkspaceStorageSnapshot = {
  buckets: Record<WorkspaceStorageBucketKey, WorkspaceStorageBucket>
  currentBoardBytes: number
  localStoragePracticalLimitBytes: number
  localStorageSnapshotBytes: number
  originQuotaBytes: number | null
  originUsageBytes: number | null
}

export type TemplateStorageRecord = {
  imageRecords: StoredImageAssetRecord[]
  template: TemplateDocument
}

export type ThemeStorageRecord = ThemeDocument

type StorageEstimateSnapshot = {
  quota: number | null
  usage: number | null
}

function normalizeByteCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : null
}

function dedupeStoredImageAssetRecords(records: StoredImageAssetRecord[]) {
  return [
    ...new Map(records.map((record) => [record.asset.id, record])).values(),
  ]
}

function estimateSerializedCollectionByteSize(items: unknown[]) {
  return items.length === 0 ? 0 : estimateSerializedByteSize(items)
}

function estimateStoredImageRecordBytes(records: StoredImageAssetRecord[]) {
  return sumByteCounts(
    records.flatMap((record) => [
      estimateSerializedByteSize(record.asset),
      record.blob.size,
    ]),
  )
}

function sumByteCounts(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

async function readLiveStorageEstimate(): Promise<StorageEstimateSnapshot> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== 'function'
  ) {
    return {
      quota: null,
      usage: null,
    }
  }

  try {
    const estimate = await navigator.storage.estimate()

    return {
      quota: normalizeByteCount(estimate.quota),
      usage: normalizeByteCount(estimate.usage),
    }
  } catch {
    return {
      quota: null,
      usage: null,
    }
  }
}

function splitStoredImageRecords(input: {
  storedImageRecords: StoredImageAssetRecord[]
  workspace: Pick<Workspace, 'cards' | 'pictures'>
}) {
  const referencedImageIds = new Set(collectReferencedImageIds(input.workspace))
  const uniqueStoredImageRecords = dedupeStoredImageAssetRecords(
    input.storedImageRecords,
  )

  return {
    galleryImageRecords: uniqueStoredImageRecords.filter(
      (record) => !referencedImageIds.has(record.asset.id),
    ),
    workspaceImageRecords: uniqueStoredImageRecords.filter((record) =>
      referencedImageIds.has(record.asset.id),
    ),
  }
}

export function estimateSerializedByteSize(value: unknown) {
  const serialized = JSON.stringify(value)

  return serialized ? new Blob([serialized]).size : 0
}

export function createWorkspaceStorageSnapshot(input: {
  galleryImageRecords: StoredImageAssetRecord[]
  localStorageSnapshotBytes: number
  storageEstimate?: StorageEstimateSnapshot | null
  templates: TemplateStorageRecord[]
  themes: ThemeStorageRecord[]
  workspace: Pick<Workspace, 'cards' | 'groups' | 'pictures'>
  workspaceImageRecords: StoredImageAssetRecord[]
}): WorkspaceStorageSnapshot {
  const galleryImageRecords = dedupeStoredImageAssetRecords(
    input.galleryImageRecords,
  )
  const workspaceImageRecords = dedupeStoredImageAssetRecords(
    input.workspaceImageRecords,
  )
  const groupsBytes = estimateSerializedCollectionByteSize(
    input.workspace.groups,
  )
  const cardsBytes = estimateSerializedCollectionByteSize(input.workspace.cards)
  const picturesBytes =
    estimateSerializedCollectionByteSize(input.workspace.pictures) +
    estimateStoredImageRecordBytes(workspaceImageRecords)
  const galleryBytes = estimateStoredImageRecordBytes(galleryImageRecords)
  const templatesBytes = sumByteCounts(
    input.templates.flatMap(({ imageRecords, template }) => {
      const uniqueImageRecords = dedupeStoredImageAssetRecords(imageRecords)

      return [
        estimateSerializedByteSize(template),
        ...template.content.images.map((image) =>
          estimateSerializedByteSize(image),
        ),
        ...uniqueImageRecords.map((record) => record.blob.size),
      ]
    }),
  )
  const themesBytes = estimateSerializedCollectionByteSize(input.themes)
  const storageEstimate = input.storageEstimate ?? null

  return {
    buckets: {
      cards: {
        bytes: cardsBytes,
        itemCount: input.workspace.cards.length,
      },
      gallery: {
        bytes: galleryBytes,
        itemCount: galleryImageRecords.length,
      },
      groups: {
        bytes: groupsBytes,
        itemCount: input.workspace.groups.length,
      },
      pictures: {
        bytes: picturesBytes,
        itemCount: input.workspace.pictures.length,
        linkedAssetCount: workspaceImageRecords.length,
      },
      templates: {
        bytes: templatesBytes,
        itemCount: input.templates.length,
        linkedAssetCount: input.templates.reduce(
          (total, { template }) => total + template.content.images.length,
          0,
        ),
      },
      themes: {
        bytes: themesBytes,
        itemCount: input.themes.length,
      },
    },
    currentBoardBytes: groupsBytes + cardsBytes + picturesBytes,
    localStoragePracticalLimitBytes: LOCAL_STORAGE_PRACTICAL_LIMIT_BYTES,
    localStorageSnapshotBytes: input.localStorageSnapshotBytes,
    originQuotaBytes: storageEstimate?.quota ?? null,
    originUsageBytes: storageEstimate?.usage ?? null,
  }
}

export async function loadWorkspaceStorageSnapshot(workspace: Workspace) {
  const [storageEstimate, storedTemplates, storedThemes, storedImageRecords] =
    await Promise.all([
      readLiveStorageEstimate(),
      listTemplates(),
      listThemes(),
      listStoredImageAssetRecords(),
    ])
  const { galleryImageRecords, workspaceImageRecords } =
    splitStoredImageRecords({
      storedImageRecords,
      workspace,
    })
  const templateRecords = await Promise.all(
    storedTemplates.map(async (template) => ({
      imageRecords: await getTemplateImageRecords(template.id),
      template,
    })),
  )

  return createWorkspaceStorageSnapshot({
    galleryImageRecords,
    localStorageSnapshotBytes: getWorkspaceSnapshotByteSize(workspace),
    storageEstimate,
    templates: templateRecords,
    themes: storedThemes,
    workspace,
    workspaceImageRecords,
  })
}
