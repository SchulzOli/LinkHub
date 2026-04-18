import type JSZip from 'jszip'
import { z } from 'zod'

import {
  getImageFileExtensionForMimeType,
  type ImageAsset,
  ImageAssetSchema,
  resolveSupportedImageUploadMimeType,
} from '../../contracts/imageAsset'
import {
  type TemplateDocument,
  TemplateDocumentSchema,
} from '../../contracts/template'
import { type ThemeDocument, ThemeDocumentSchema } from '../../contracts/theme'
import {
  DEFAULT_WORKSPACE_ID,
  type Workspace,
  WorkspaceSchema,
} from '../../contracts/workspace'
import { createDefaultWorkspaceAnalytics } from '../../contracts/workspaceAnalytics'
import type { StoredImageAssetRecord } from '../../storage/imageRepository'
import { ensureLatestWorkspace } from '../../storage/storageMigrations'
import {
  reconcileStoredImageRecords,
  rewriteWorkspaceImageReferences,
} from '../images/storedImageRecords'

const CANVAS_BUNDLE_FORMAT = 'linkhub.canvas-bundle'
const CANVAS_BUNDLE_VERSION = 1
const MANIFEST_FILE_PATH = 'manifest.json'
const WORKSPACE_FILE_PATH = 'workspace.json'
const TEMPLATES_FILE_PATH = 'templates.json'
const THEMES_FILE_PATH = 'themes.json'
const IMAGES_DIRECTORY_PATH = 'images'
const TEMPLATE_IMAGES_DIRECTORY_PATH = 'template-images'
const CANVAS_BUNDLE_FILE_EXTENSION = 'linkhub.zip'

const CanvasBundleImageScopeSchema = z.enum(['workspace-referenced', 'gallery'])

const CanvasBundleTemplateSummarySchema = z.object({
  count: z.number().int().nonnegative(),
  imageCount: z.number().int().nonnegative(),
})

const CanvasBundleThemeSummarySchema = z.object({
  count: z.number().int().nonnegative(),
})

const CanvasBundleImageEntrySchema = ImageAssetSchema.extend({
  fileName: z.string().min(1),
})

const CanvasBundleManifestSchema = z.object({
  format: z.literal(CANVAS_BUNDLE_FORMAT),
  version: z.literal(CANVAS_BUNDLE_VERSION),
  exportedAt: z.string(),
  imageScope: CanvasBundleImageScopeSchema.default('workspace-referenced'),
  workspace: z.object({
    cardCount: z.number().int().nonnegative(),
    groupCount: z.number().int().nonnegative(),
    id: z.string().min(1),
    name: z.string().min(1),
    pictureCount: z.number().int().nonnegative(),
  }),
  images: z.array(CanvasBundleImageEntrySchema),
  templates: CanvasBundleTemplateSummarySchema.optional(),
  themes: CanvasBundleThemeSummarySchema.optional(),
})

export type CanvasBundleManifest = z.infer<typeof CanvasBundleManifestSchema>
export type CanvasBundleImageScope = z.infer<
  typeof CanvasBundleImageScopeSchema
>
export type CanvasBundleTemplate = {
  images: StoredImageAssetRecord[]
  template: TemplateDocument
}
export type ImportedCanvasBundle = {
  images: StoredImageAssetRecord[]
  manifest: CanvasBundleManifest
  themes: ThemeDocument[]
  templates: CanvasBundleTemplate[]
  workspace: Workspace
}

type JSZipConstructor = {
  new (): JSZip
  loadAsync(data: Blob): Promise<JSZip>
}

let jsZipModulePromise: Promise<{ default: JSZipConstructor }> | null = null

async function loadJSZip() {
  const modulePromise = (jsZipModulePromise ??= import('jszip') as Promise<{
    default: JSZipConstructor
  }>)

  return (await modulePromise).default
}

function sanitizeWorkspaceForTransport(workspace: Workspace): Workspace {
  return WorkspaceSchema.parse({
    ...workspace,
    analytics: createDefaultWorkspaceAnalytics(),
  })
}

function createImageBundleFilePath(asset: ImageAsset) {
  const extension = getImageFileExtensionForMimeType(asset.mimeType)

  if (!extension) {
    throw new Error(`Unsupported image mime type: ${asset.mimeType}`)
  }

  return `${IMAGES_DIRECTORY_PATH}/${asset.id}.${extension}`
}

function createTemplateImageBundleFilePath(
  templateId: string,
  asset: ImageAsset,
) {
  const extension = getImageFileExtensionForMimeType(asset.mimeType)

  if (!extension) {
    throw new Error(`Unsupported image mime type: ${asset.mimeType}`)
  }

  return `${TEMPLATE_IMAGES_DIRECTORY_PATH}/${templateId}/${asset.id}.${extension}`
}

function countTemplateImages(templates: CanvasBundleTemplate[]) {
  return templates.reduce(
    (count, templateBundle) =>
      count + templateBundle.template.content.images.length,
    0,
  )
}

function createBundleManifest(
  workspace: Workspace,
  images: StoredImageAssetRecord[],
  imageScope: CanvasBundleImageScope,
  templates: CanvasBundleTemplate[],
  themes: ThemeDocument[],
): CanvasBundleManifest {
  const exportedWorkspace = sanitizeWorkspaceForTransport(workspace)

  return {
    format: CANVAS_BUNDLE_FORMAT,
    version: CANVAS_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    imageScope,
    workspace: {
      id: exportedWorkspace.id,
      name: exportedWorkspace.name,
      cardCount: exportedWorkspace.cards.length,
      groupCount: exportedWorkspace.groups.length,
      pictureCount: exportedWorkspace.pictures.length,
    },
    images: images.map(({ asset }) => ({
      ...asset,
      fileName: createImageBundleFilePath(asset),
    })),
    templates: {
      count: templates.length,
      imageCount: countTemplateImages(templates),
    },
    themes: {
      count: themes.length,
    },
  }
}

function createTransportFileName(baseName: string, exportedAt: string) {
  const normalizedBaseName =
    baseName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'canvas'

  return `${normalizedBaseName}-${exportedAt.slice(0, 10)}.${CANVAS_BUNDLE_FILE_EXTENSION}`
}

async function readBundleRequiredTextFile(zip: JSZip, filePath: string) {
  const zipFile = zip.file(filePath)

  if (!zipFile) {
    throw new Error(`Bundle is missing ${filePath}.`)
  }

  return zipFile.async('text')
}

async function readBundleOptionalTextFile(zip: JSZip, filePath: string) {
  const zipFile = zip.file(filePath)

  if (!zipFile) {
    return null
  }

  return zipFile.async('text')
}

async function readBundleImageRecord(
  zip: JSZip,
  imageEntry: z.infer<typeof CanvasBundleImageEntrySchema>,
): Promise<StoredImageAssetRecord> {
  const zipFile = zip.file(imageEntry.fileName)

  if (!zipFile) {
    throw new Error(`Bundle is missing ${imageEntry.fileName}.`)
  }

  const resolvedMimeType = resolveSupportedImageUploadMimeType({
    filename: imageEntry.originalFilename,
    mimeType: imageEntry.mimeType,
  })

  if (!resolvedMimeType) {
    throw new Error(`Unsupported bundled image type: ${imageEntry.mimeType}`)
  }

  const blob = await zipFile.async('blob')

  return {
    asset: {
      ...imageEntry,
      mimeType: resolvedMimeType,
    },
    blob: new File([blob], imageEntry.originalFilename, {
      type: resolvedMimeType,
    }),
  }
}

export function collectReferencedImageIds(
  workspace: Pick<Workspace, 'cards' | 'pictures'>,
) {
  return [
    ...new Set([
      ...workspace.pictures.map((picture) => picture.imageId),
      ...workspace.cards.flatMap((card) =>
        card.faviconOverrideImageId ? [card.faviconOverrideImageId] : [],
      ),
    ]),
  ]
}

export function createCanvasBundleDownloadName(workspaceName: string) {
  return createTransportFileName(workspaceName, new Date().toISOString())
}

export async function createCanvasBundle(
  workspace: Workspace,
  images: StoredImageAssetRecord[],
  options?: {
    imageScope?: CanvasBundleImageScope
    themes?: ThemeDocument[]
    templates?: CanvasBundleTemplate[]
  },
) {
  const JSZipConstructor = await loadJSZip()
  const zip = new JSZipConstructor()
  const exportedWorkspace = sanitizeWorkspaceForTransport(workspace)
  const exportedTemplates = options?.templates ?? []
  const exportedThemes = options?.themes ?? []
  const manifest = createBundleManifest(
    workspace,
    images,
    options?.imageScope ?? 'workspace-referenced',
    exportedTemplates,
    exportedThemes,
  )

  for (const templateBundle of exportedTemplates) {
    const bundledImageIds = new Set(
      templateBundle.images.map((record) => record.asset.id),
    )
    const missingImageCount = templateBundle.template.content.images.filter(
      (image) => !bundledImageIds.has(image.asset.id),
    ).length

    if (missingImageCount > 0) {
      throw new Error(
        `Template “${templateBundle.template.name}” is missing ${missingImageCount} stored image file${missingImageCount === 1 ? '' : 's'}.`,
      )
    }
  }

  zip.file(MANIFEST_FILE_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  zip.file(
    WORKSPACE_FILE_PATH,
    `${JSON.stringify(exportedWorkspace, null, 2)}\n`,
  )
  zip.file(
    TEMPLATES_FILE_PATH,
    `${JSON.stringify(
      exportedTemplates.map((entry) => entry.template),
      null,
      2,
    )}\n`,
  )
  zip.file(THEMES_FILE_PATH, `${JSON.stringify(exportedThemes, null, 2)}\n`)

  images.forEach(({ asset, blob }) => {
    zip.file(createImageBundleFilePath(asset), blob)
  })

  exportedTemplates.forEach(({ template, images: templateImages }) => {
    templateImages.forEach(({ asset, blob }) => {
      zip.file(createTemplateImageBundleFilePath(template.id, asset), blob)
    })
  })

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

export async function parseCanvasBundle(
  bundleFile: Blob,
): Promise<ImportedCanvasBundle> {
  const JSZipConstructor = await loadJSZip()
  const zip = await JSZipConstructor.loadAsync(bundleFile)
  const manifest = CanvasBundleManifestSchema.parse(
    JSON.parse(await readBundleRequiredTextFile(zip, MANIFEST_FILE_PATH)),
  )
  const workspace = ensureLatestWorkspace(
    JSON.parse(await readBundleRequiredTextFile(zip, WORKSPACE_FILE_PATH)),
  )
  const templatesFileContent = await readBundleOptionalTextFile(
    zip,
    TEMPLATES_FILE_PATH,
  )
  const themesFileContent = await readBundleOptionalTextFile(
    zip,
    THEMES_FILE_PATH,
  )
  const templates = await Promise.all(
    (templatesFileContent
      ? z.array(TemplateDocumentSchema).parse(JSON.parse(templatesFileContent))
      : []
    ).map(async (template) => ({
      template,
      images: await Promise.all(
        template.content.images.map(async (image) => {
          const fileName = createTemplateImageBundleFilePath(
            template.id,
            image.asset,
          )
          const zipFile = zip.file(fileName)

          if (!zipFile) {
            throw new Error(`Bundle is missing ${fileName}.`)
          }

          const resolvedMimeType = resolveSupportedImageUploadMimeType({
            filename: image.asset.originalFilename,
            mimeType: image.asset.mimeType,
          })

          if (!resolvedMimeType) {
            throw new Error(
              `Unsupported bundled template image type: ${image.asset.mimeType}`,
            )
          }

          const blob = await zipFile.async('blob')

          return {
            asset: {
              ...image.asset,
              mimeType: resolvedMimeType,
            },
            blob: new File([blob], image.asset.originalFilename, {
              type: resolvedMimeType,
            }),
          } satisfies StoredImageAssetRecord
        }),
      ),
    })),
  )
  const themes = themesFileContent
    ? z.array(ThemeDocumentSchema).parse(JSON.parse(themesFileContent))
    : []
  const images = await Promise.all(
    manifest.images.map((imageEntry) => readBundleImageRecord(zip, imageEntry)),
  )
  const availableImageIds = new Set(images.map(({ asset }) => asset.id))
  const missingImageIds = collectReferencedImageIds(workspace).filter(
    (imageId) => !availableImageIds.has(imageId),
  )

  if (missingImageIds.length > 0) {
    throw new Error(
      `Bundle is missing ${missingImageIds.length} referenced image file${missingImageIds.length === 1 ? '' : 's'}.`,
    )
  }

  return {
    manifest,
    themes,
    templates,
    workspace: {
      ...workspace,
      id: DEFAULT_WORKSPACE_ID,
      analytics: createDefaultWorkspaceAnalytics(),
    },
    images,
  }
}

export async function reconcileImportedCanvasBundle(input: {
  bundle: ImportedCanvasBundle
  resolveExistingImage: (
    imageId: string,
  ) => Promise<StoredImageAssetRecord | null>
}) {
  const { imageIdMap, recordsToStore } = await reconcileStoredImageRecords({
    records: input.bundle.images,
    resolveExistingImage: input.resolveExistingImage,
  })

  return {
    imagesToStore: recordsToStore,
    themesToStore: input.bundle.themes,
    templatesToStore: input.bundle.templates,
    workspace: rewriteWorkspaceImageReferences(
      input.bundle.workspace,
      imageIdMap,
    ),
  }
}
