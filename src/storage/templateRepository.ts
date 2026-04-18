import {
  TemplateDocumentSchema,
  type TemplateDocument,
} from '../contracts/template'
import {
  openLinkHubDb,
  STORAGE_STORES,
} from './db'
import type { StoredImageAssetRecord } from './imageRepository'

function createTemplateImageStoreKey(templateId: string, imageId: string) {
  return `${templateId}:${imageId}`
}

function toSerializableTemplate(template: TemplateDocument) {
  return JSON.parse(JSON.stringify(template))
}

async function getTemplateImageBlob(templateId: string, imageId: string) {
  const db = await openLinkHubDb()

  return (
    ((await db.get(
      STORAGE_STORES.templateImageBlob,
      createTemplateImageStoreKey(templateId, imageId),
    )) as Blob | undefined) ?? null
  )
}

export async function listTemplates() {
  const db = await openLinkHubDb()
  const rawTemplates = (await db.getAll(STORAGE_STORES.template)) as unknown[]

  return rawTemplates
    .flatMap((rawTemplate) => {
      const parsed = TemplateDocumentSchema.safeParse(rawTemplate)

      return parsed.success ? [parsed.data] : []
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function getTemplate(templateId: string) {
  const db = await openLinkHubDb()
  const rawTemplate = await db.get(STORAGE_STORES.template, templateId)

  if (!rawTemplate) {
    return null
  }

  const parsed = TemplateDocumentSchema.safeParse(rawTemplate)

  return parsed.success ? parsed.data : null
}

export async function getTemplateImageRecords(templateId: string) {
  const template = await getTemplate(templateId)

  if (!template) {
    return []
  }

  const blobs = await Promise.all(
    template.content.images.map((image) =>
      getTemplateImageBlob(template.id, image.asset.id),
    ),
  )

  return template.content.images.flatMap((image, index) => {
    const blob = blobs[index]

    return blob
      ? [
          {
            asset: image.asset,
            blob,
          } satisfies StoredImageAssetRecord,
        ]
      : []
  })
}

export async function putTemplate(input: {
  records: StoredImageAssetRecord[]
  template: TemplateDocument
}) {
  const serializableTemplate = toSerializableTemplate(input.template)
  const db = await openLinkHubDb()
  const transaction = db.transaction(
    [
      STORAGE_STORES.template,
      STORAGE_STORES.templateImageAsset,
      STORAGE_STORES.templateImageBlob,
    ],
    'readwrite',
  )

  await transaction
    .objectStore(STORAGE_STORES.template)
    .put(serializableTemplate, serializableTemplate.id)

  const knownKeys = new Set<string>()

  for (const image of input.template.content.images) {
    const key = createTemplateImageStoreKey(input.template.id, image.asset.id)

    knownKeys.add(key)
    await transaction.objectStore(STORAGE_STORES.templateImageAsset).put(image, key)
  }

  for (const record of input.records) {
    const key = createTemplateImageStoreKey(input.template.id, record.asset.id)

    knownKeys.add(key)
    await transaction
      .objectStore(STORAGE_STORES.templateImageBlob)
      .put(record.blob, key)
  }

  const existingAssetKeys = (await transaction
    .objectStore(STORAGE_STORES.templateImageAsset)
    .getAllKeys()) as string[]

  await Promise.all(
    existingAssetKeys
      .filter(
        (key) =>
          key.startsWith(`${input.template.id}:`) &&
          !knownKeys.has(String(key)),
      )
      .flatMap((key) => [
        transaction.objectStore(STORAGE_STORES.templateImageAsset).delete(key),
        transaction.objectStore(STORAGE_STORES.templateImageBlob).delete(key),
      ]),
  )

  await transaction.done

  return input.template
}

export async function deleteTemplate(templateId: string) {
  const db = await openLinkHubDb()
  const transaction = db.transaction(
    [
      STORAGE_STORES.template,
      STORAGE_STORES.templateImageAsset,
      STORAGE_STORES.templateImageBlob,
    ],
    'readwrite',
  )

  await transaction.objectStore(STORAGE_STORES.template).delete(templateId)

  const imageKeys = (await transaction
    .objectStore(STORAGE_STORES.templateImageAsset)
    .getAllKeys()) as string[]

  await Promise.all(
    imageKeys
      .filter((key) => String(key).startsWith(`${templateId}:`))
      .flatMap((key) => [
        transaction.objectStore(STORAGE_STORES.templateImageAsset).delete(key),
        transaction.objectStore(STORAGE_STORES.templateImageBlob).delete(key),
      ]),
  )

  await transaction.done
}
