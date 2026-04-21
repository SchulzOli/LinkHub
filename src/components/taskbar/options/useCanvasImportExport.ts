import { useCallback, useState } from 'react'

import type { Workspace } from '../../../contracts/workspace'
import {
  createCanvasBundle,
  createCanvasBundleDownloadName,
  parseCanvasBundle,
  reconcileImportedCanvasBundle,
} from '../../../features/importExport/canvasBundle'
import {
  getStoredImageAssetRecord,
  listStoredImageAssetRecords,
  putStoredImageAssetRecord,
} from '../../../storage/imageRepository'
import {
  getTemplateImageRecords,
  listTemplates,
  putTemplate,
} from '../../../storage/templateRepository'
import { listThemes, putTheme } from '../../../storage/themeRepository'
import type { DataStatus, OpenPromptDialog } from './optionsMenuShared'
import { triggerBlobDownload } from './optionsMenuShared'

type UseCanvasImportExportInput = {
  hydrateWorkspace: (workspace: Workspace) => void
  importWorkspace: (workspace: Workspace) => Promise<void> | void
  openPromptDialog: OpenPromptDialog
  referencedImageIds: string[]
  refreshTemplateCount: () => Promise<void> | void
  refreshThemeCount: () => Promise<void> | void
  workspace: Workspace
}

/**
 * Encapsulates the canvas bundle export and import flow for the Options Menu
 * Data tab, including the replace/import-as-new prompt dialog.
 *
 * Owns its own `dataStatus` state so the Options Menu shell only has to
 * forward the handlers into the Data section.
 */
export function useCanvasImportExport({
  hydrateWorkspace,
  importWorkspace,
  openPromptDialog,
  referencedImageIds,
  refreshTemplateCount,
  refreshThemeCount,
  workspace,
}: UseCanvasImportExportInput) {
  const [dataStatus, setDataStatus] = useState<DataStatus>({
    kind: 'idle',
    message: '',
  })

  const handleExportCanvas = useCallback(async () => {
    setDataStatus({
      kind: 'busy',
      message: 'Preparing canvas export…',
    })

    try {
      const storedImageRecords = await listStoredImageAssetRecords()
      const storedTemplates = await listTemplates()
      const storedThemes = await listThemes()
      const templateBundles = await Promise.all(
        storedTemplates.map(async (template) => ({
          template,
          images: await getTemplateImageRecords(template.id),
        })),
      )
      const referencedImageRecords = await Promise.all(
        referencedImageIds.map((imageId) => getStoredImageAssetRecord(imageId)),
      )
      const missingReferencedImageCount = referencedImageIds.filter(
        (_, index) => !referencedImageRecords[index],
      ).length

      if (missingReferencedImageCount > 0) {
        throw new Error(
          'The current canvas references missing image data and cannot be exported safely.',
        )
      }

      const bundleBlob = await createCanvasBundle(
        workspace,
        storedImageRecords,
        {
          imageScope: 'gallery',
          themes: storedThemes,
          templates: templateBundles,
        },
      )

      triggerBlobDownload(
        bundleBlob,
        createCanvasBundleDownloadName(workspace.name),
      )
      setDataStatus({
        kind: 'success',
        message: `Exported ${workspace.cards.length} cards, ${workspace.groups.length} groups, ${workspace.pictures.length} pictures, ${storedImageRecords.length} gallery image${storedImageRecords.length === 1 ? '' : 's'}, ${storedTemplates.length} template${storedTemplates.length === 1 ? '' : 's'}, and ${storedThemes.length} theme${storedThemes.length === 1 ? '' : 's'}.`,
      })
    } catch (error) {
      setDataStatus({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Canvas export failed.',
      })
    }
  }, [referencedImageIds, workspace])

  const reconcileAndStoreImportedBundle = useCallback(
    async (file: File) => {
      const parsedBundle = await parseCanvasBundle(file)
      const reconciledBundle = await reconcileImportedCanvasBundle({
        bundle: parsedBundle,
        resolveExistingImage: (imageId) => getStoredImageAssetRecord(imageId),
      })

      await Promise.all(
        reconciledBundle.imagesToStore.map((imageRecord) =>
          putStoredImageAssetRecord(imageRecord),
        ),
      )
      await Promise.all(
        reconciledBundle.templatesToStore.map((templateBundle) =>
          putTemplate({
            records: templateBundle.images,
            template: templateBundle.template,
          }),
        ),
      )
      await Promise.all(
        reconciledBundle.themesToStore.map((theme) => putTheme(theme)),
      )
      await Promise.all([refreshTemplateCount(), refreshThemeCount()])

      return {
        parsedBundle,
        reconciledBundle,
      }
    },
    [refreshTemplateCount, refreshThemeCount],
  )

  const handleImportCanvasFile = useCallback(
    async (file: File) => {
      setDataStatus({
        kind: 'busy',
        message: 'Importing canvas bundle…',
      })

      try {
        const parsedBundle = await parseCanvasBundle(file)

        openPromptDialog({
          description:
            'Choose whether the bundle should replace the current canvas or be imported into a brand-new workspace.',
          auxiliaryLabel: 'Import as new workspace',
          auxiliaryTone: 'default',
          eyebrow: 'Canvas Data',
          onAuxiliaryAction: () => {
            setDataStatus({
              kind: 'busy',
              message: 'Importing canvas bundle as a new workspace…',
            })

            void (async () => {
              try {
                const { reconciledBundle } =
                  await reconcileAndStoreImportedBundle(file)

                await importWorkspace(reconciledBundle.workspace)
                setDataStatus({
                  kind: 'success',
                  message: `Imported ${reconciledBundle.workspace.cards.length} cards, ${reconciledBundle.workspace.groups.length} groups, ${reconciledBundle.workspace.pictures.length} pictures, ${parsedBundle.images.length} bundled image${parsedBundle.images.length === 1 ? '' : 's'}, ${reconciledBundle.templatesToStore.length} template${reconciledBundle.templatesToStore.length === 1 ? '' : 's'}, and ${reconciledBundle.themesToStore.length} theme${reconciledBundle.themesToStore.length === 1 ? '' : 's'} into a new workspace.`,
                })
              } catch (error) {
                setDataStatus({
                  kind: 'error',
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Canvas import failed.',
                })
              }
            })()
          },
          onDismissAction: () => {
            setDataStatus({
              kind: 'idle',
              message: 'Import canceled.',
            })
          },
          onPrimaryAction: () => {
            setDataStatus({
              kind: 'busy',
              message: 'Importing canvas bundle…',
            })

            void (async () => {
              try {
                const { reconciledBundle } =
                  await reconcileAndStoreImportedBundle(file)

                hydrateWorkspace({
                  ...reconciledBundle.workspace,
                  id: workspace.id,
                  name: workspace.name,
                })
                setDataStatus({
                  kind: 'success',
                  message: `Imported ${reconciledBundle.workspace.cards.length} cards, ${reconciledBundle.workspace.groups.length} groups, ${reconciledBundle.workspace.pictures.length} pictures, ${parsedBundle.images.length} bundled image${parsedBundle.images.length === 1 ? '' : 's'}, ${reconciledBundle.templatesToStore.length} template${reconciledBundle.templatesToStore.length === 1 ? '' : 's'}, and ${reconciledBundle.themesToStore.length} theme${reconciledBundle.themesToStore.length === 1 ? '' : 's'}.`,
                })
              } catch (error) {
                setDataStatus({
                  kind: 'error',
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Canvas import failed.',
                })
              }
            })()
          },
          primaryLabel: 'Import bundle',
          role: 'alertdialog',
          secondaryLabel: 'Cancel',
          title: 'Replace current canvas?',
          tone: 'danger',
        })
      } catch (error) {
        setDataStatus({
          kind: 'error',
          message:
            error instanceof Error ? error.message : 'Canvas import failed.',
        })
      }
    },
    [
      hydrateWorkspace,
      importWorkspace,
      openPromptDialog,
      reconcileAndStoreImportedBundle,
      workspace.id,
      workspace.name,
    ],
  )

  return {
    dataStatus,
    handleExportCanvas,
    handleImportCanvasFile,
  }
}
