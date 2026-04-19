import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import styles from './OptionsMenu.module.css'

import type { TemplateDocument } from '../../contracts/template'
import type { WorkspaceSummary } from '../../contracts/workspaceDirectory'
import { getWorkspaceStatisticsSnapshot } from '../../features/analytics/workspaceAnalytics'
import {
  loadWorkspaceStorageSnapshot,
  type WorkspaceStorageSnapshot,
} from '../../features/analytics/workspaceStorage'
import { getActiveThemeCardColorSettings } from '../../features/appearance/cardColorPalette'
import {
  getSelectedCanvasEntityBundle,
  isCanvasEntityBundleEmpty,
} from '../../features/canvas/entityBundle'
import { placeCanvasEntityBundleNearPoint } from '../../features/canvas/entityBundlePlacement'
import {
  collectReferencedImageIds,
  createCanvasBundle,
  createCanvasBundleDownloadName,
  parseCanvasBundle,
  reconcileImportedCanvasBundle,
} from '../../features/importExport/canvasBundle'
import { screenPointToCanvas } from '../../features/placement/canvasMath'
import {
  collectBundleImageIds,
  createTemplateDocument,
  createTemplatePreviewDataUrl,
  duplicateTemplateDocument,
  materializeTemplateDocument,
} from '../../features/templates/templateLibrary'
import { useAppearanceStore } from '../../state/useAppearanceStore'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'
import {
  getStoredImageAssetRecord,
  listStoredImageAssetRecords,
  putStoredImageAssetRecord,
} from '../../storage/imageRepository'
import {
  deleteTemplate,
  getTemplateImageRecords,
  listTemplates,
  putTemplate,
} from '../../storage/templateRepository'
import { listThemes, putTheme } from '../../storage/themeRepository'
import { EditIcon } from '../ui/EditIcon'
import { LinkHubMark } from '../ui/LinkHubMark'
import { PromptDialog } from '../ui/PromptDialog'
import { isSelectMenuPortalTarget } from '../ui/SelectMenu'
import { OptionsAppearanceSection } from './OptionsAppearanceSection'
import { OptionsDataSection } from './OptionsDataSection'
import { StatisticsPanel } from './StatisticsPanel'
import { ThemeGallery } from './ThemeGallery'

type OptionsMenuProps = {
  cardCount: number
  open: boolean
  onToggle: () => void
  onRequestClose: () => void
}

type MenuTab = 'options' | 'themes' | 'templates' | 'statistics' | 'data'

type DataStatus = {
  kind: 'busy' | 'error' | 'idle' | 'success'
  message: string
}

type StorageStatisticsState = {
  kind: 'error' | 'idle' | 'loading' | 'ready'
  message: string
  snapshot: WorkspaceStorageSnapshot | null
}

type TemplateEditorState = {
  description: string
  mode: 'create' | 'edit'
  name: string
  templateId?: string
}

type WorkspaceEditorState = {
  name: string
  workspaceId: string
}

type PromptTone = 'default' | 'danger'

type PromptDialogConfig = {
  auxiliaryLabel?: string
  auxiliaryTone?: PromptTone
  description: string
  eyebrow: string
  primaryLabel: string
  role: 'alertdialog' | 'dialog'
  secondaryLabel?: string
  title: string
  tone: PromptTone
}

type PromptDialogOptions = PromptDialogConfig & {
  onAuxiliaryAction?: () => void
  onDismissAction?: () => void
  onPrimaryAction?: () => void
}

type PromptDialogState = PromptDialogConfig & {
  onAuxiliaryAction?: () => void
  onDismissAction?: () => void
  onPrimaryAction: () => void
}

const TABS: Array<{ id: MenuTab; label: string }> = [
  { id: 'options', label: 'Options' },
  { id: 'themes', label: 'Themes' },
  { id: 'templates', label: 'Templates' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'data', label: 'Data' },
]

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const TEMPLATE_EXPORT_FORMAT = 'linkhub.template-export'
const TEMPLATE_EXPORT_VERSION = 1

function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = objectUrl
  anchor.download = fileName
  anchor.click()

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 0)
}

function createTemplateDownloadName(templateName: string) {
  const normalizedBaseName =
    templateName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'template'

  return `${normalizedBaseName}-${new Date().toISOString().slice(0, 10)}.template.json`
}

async function readBlobAsDataUrl(blob: Blob) {
  if (typeof FileReader === 'undefined') {
    throw new Error('Template downloads are not supported in this environment.')
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Template download failed.'))
        return
      }

      resolve(reader.result)
    }

    reader.onerror = () => {
      reject(new Error('Template download failed.'))
    }

    reader.readAsDataURL(blob)
  })
}

export function OptionsMenu({
  cardCount,
  open,
  onToggle,
  onRequestClose,
}: OptionsMenuProps) {
  const [activeTab, setActiveTab] = useState<MenuTab>('options')
  const [dataStatus, setDataStatus] = useState<DataStatus>({
    kind: 'idle',
    message: '',
  })
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(
    null,
  )
  const [templateEditor, setTemplateEditor] =
    useState<TemplateEditorState | null>(null)
  const [workspaceEditor, setWorkspaceEditor] =
    useState<WorkspaceEditorState | null>(null)
  const [templateStatus, setTemplateStatus] = useState<DataStatus>({
    kind: 'idle',
    message: '',
  })
  const [workspaceStatus, setWorkspaceStatus] = useState<DataStatus>({
    kind: 'idle',
    message: '',
  })
  const [storageStatistics, setStorageStatistics] =
    useState<StorageStatisticsState>({
      kind: 'idle',
      message: '',
      snapshot: null,
    })
  const [savedTemplateCount, setSavedTemplateCount] = useState(0)
  const [savedThemeCount, setSavedThemeCount] = useState(0)
  const [templates, setTemplates] = useState<TemplateDocument[]>([])
  const workspace = useWorkspaceStore((state) => state.workspace)
  const viewport = useWorkspaceStore((state) => state.viewport)
  const activeWorkspaceId = useWorkspaceStore(
    (state) => state.activeWorkspaceId,
  )
  const hydrateWorkspace = useWorkspaceStore((state) => state.hydrateWorkspace)
  const interactionMode = useWorkspaceStore((state) => state.interactionMode)
  const workspaceSummaries = useWorkspaceStore(
    (state) => state.workspaceSummaries,
  )
  const deleteWorkspace = useWorkspaceStore((state) => state.deleteWorkspace)
  const importWorkspace = useWorkspaceStore((state) => state.importWorkspace)
  const moveWorkspace = useWorkspaceStore((state) => state.moveWorkspace)
  const renameWorkspace = useWorkspaceStore((state) => state.renameWorkspace)
  const selectedCardIds = useWorkspaceStore((state) => state.selectedCardIds)
  const selectedGroupIds = useWorkspaceStore((state) => state.selectedGroupIds)
  const selectedPictureIds = useWorkspaceStore(
    (state) => state.selectedPictureIds,
  )
  const addEntityBundle = useWorkspaceStore((state) => state.addEntityBundle)
  const setViewport = useWorkspaceStore((state) => state.setViewport)
  const toggleInteractionMode = useWorkspaceStore(
    (state) => state.toggleInteractionMode,
  )
  const {
    appearance,
    setBorderPresets,
    setDefaultBorderPresetIndex,
    setDefaultCardCornerRadius,
    setDefaultCardSize,
    setDefaultCardShowTitle,
    setDefaultCardShowImage,
    setDefaultCardOpenInNewTab,
    setDefaultSurfaceTransparency,
    setDefaultSurfaceShadowStyle,
    setDefaultFillPresetIndex,
    setFillPresets,
    resetAppearanceOptions,
    setThemeMode,
    applyTheme,
    setStyleToken,
    resetStyleTokens,
  } = useAppearanceStore()
  const shellRef = useRef<HTMLDivElement | null>(null)
  const importFileInputRef = useRef<HTMLInputElement | null>(null)
  const menuId = useId()
  const tabListId = useId()
  const activeColorSettings = getActiveThemeCardColorSettings(appearance)
  const statistics = useMemo(
    () => getWorkspaceStatisticsSnapshot(workspace),
    [workspace],
  )
  const selectedEntitySelection = useMemo(
    () =>
      getSelectedCanvasEntityBundle({
        workspace,
        selectedCardIds,
        selectedGroupIds,
        selectedPictureIds,
      }),
    [selectedCardIds, selectedGroupIds, selectedPictureIds, workspace],
  )
  const selectedBundleImageIds = useMemo(
    () => collectBundleImageIds(selectedEntitySelection.bundle),
    [selectedEntitySelection.bundle],
  )
  const hasTemplateSelection = useMemo(
    () => !isCanvasEntityBundleEmpty(selectedEntitySelection.bundle),
    [selectedEntitySelection.bundle],
  )
  const referencedImageIds = useMemo(
    () => collectReferencedImageIds(workspace),
    [workspace],
  )

  const dismissPromptDialog = useCallback(() => {
    const onDismissAction = promptDialog?.onDismissAction

    setPromptDialog(null)
    onDismissAction?.()
  }, [promptDialog])

  const openPromptDialog = useCallback((dialog: PromptDialogOptions) => {
    setPromptDialog({
      ...dialog,
      onAuxiliaryAction: dialog.onAuxiliaryAction
        ? () => {
            setPromptDialog(null)
            dialog.onAuxiliaryAction?.()
          }
        : undefined,
      onDismissAction: dialog.onDismissAction,
      onPrimaryAction: () => {
        setPromptDialog(null)
        dialog.onPrimaryAction?.()
      },
    })
  }, [])

  const refreshTemplates = useCallback(async () => {
    const storedTemplates = await listTemplates()
    const templatesWithPreviews = await Promise.all(
      storedTemplates.map(async (template) => {
        try {
          const imageRecords = await getTemplateImageRecords(template.id)
          const previewDataUrl = await createTemplatePreviewDataUrl({
            appearance,
            bundle: {
              cards: template.content.cards,
              groups: template.content.groups,
              pictures: template.content.pictures,
            },
            imageRecords,
          })

          if (!previewDataUrl) {
            return template
          }

          if (previewDataUrl === template.previewDataUrl) {
            return template
          }

          const nextTemplate = {
            ...template,
            previewDataUrl,
          } satisfies TemplateDocument

          await putTemplate({ records: imageRecords, template: nextTemplate })

          return nextTemplate
        } catch {
          return template
        }
      }),
    )

    const sortedTemplates = templatesWithPreviews.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    )

    setTemplates(sortedTemplates)
    setSavedTemplateCount(sortedTemplates.length)
  }, [appearance])

  const refreshTemplateCount = useCallback(async () => {
    setSavedTemplateCount((await listTemplates()).length)
  }, [])

  const refreshThemeCount = useCallback(async () => {
    setSavedThemeCount((await listThemes()).length)
  }, [])

  const collectSelectionImageRecords = useCallback(async () => {
    const imageRecords = await Promise.all(
      selectedBundleImageIds.map((imageId) =>
        getStoredImageAssetRecord(imageId),
      ),
    )
    const missingImageCount = imageRecords.filter((record) => !record).length

    if (missingImageCount > 0) {
      throw new Error(
        `The selected content references ${missingImageCount} missing image file${missingImageCount === 1 ? '' : 's'}.`,
      )
    }

    return imageRecords.filter((record) => record !== null)
  }, [selectedBundleImageIds])

  const centerViewportOnBounds = useCallback(
    (bounds: { height: number; left: number; top: number; width: number }) => {
      const zoom = viewport.zoom

      setViewport({
        ...viewport,
        x: bounds.left + bounds.width / 2 - window.innerWidth / (2 * zoom),
        y: bounds.top + bounds.height / 2 - window.innerHeight / (2 * zoom),
      })
    },
    [setViewport, viewport],
  )

  const handleRequestClose = useCallback(() => {
    setActiveTab('options')
    setTemplateEditor(null)
    setWorkspaceEditor(null)
    onRequestClose()
  }, [onRequestClose])

  const handleToggle = useCallback(() => {
    if (open) {
      setActiveTab('options')
      setTemplateEditor(null)
      setWorkspaceEditor(null)
    }

    onToggle()
  }, [onToggle, open])

  const handleStartWorkspaceEdit = useCallback(
    (workspaceSummary: WorkspaceSummary) => {
      setWorkspaceEditor({
        name: workspaceSummary.name,
        workspaceId: workspaceSummary.id,
      })
      setWorkspaceStatus({ kind: 'idle', message: '' })
    },
    [],
  )

  const handleCancelWorkspaceEdit = useCallback(() => {
    setWorkspaceEditor(null)
    setWorkspaceStatus({ kind: 'idle', message: '' })
  }, [])

  const handleSubmitWorkspaceEditor = useCallback(() => {
    if (!workspaceEditor) {
      return
    }

    const trimmedName = workspaceEditor.name.trim()

    if (!trimmedName) {
      setWorkspaceStatus({
        kind: 'error',
        message: 'Workspace names cannot be empty.',
      })
      return
    }

    setWorkspaceStatus({
      kind: 'busy',
      message: `Updating “${trimmedName}”…`,
    })

    void (async () => {
      try {
        await renameWorkspace(workspaceEditor.workspaceId, trimmedName)
        setWorkspaceEditor(null)
        setWorkspaceStatus({
          kind: 'success',
          message: `Updated workspace “${trimmedName}”.`,
        })
      } catch (error) {
        setWorkspaceStatus({
          kind: 'error',
          message:
            error instanceof Error ? error.message : 'Workspace update failed.',
        })
      }
    })()
  }, [renameWorkspace, workspaceEditor])

  const handleMoveWorkspace = useCallback(
    (workspaceSummary: WorkspaceSummary, direction: -1 | 1) => {
      setWorkspaceStatus({
        kind: 'busy',
        message: `Moving “${workspaceSummary.name}”…`,
      })

      void (async () => {
        try {
          await moveWorkspace(workspaceSummary.id, direction)
          setWorkspaceStatus({
            kind: 'success',
            message: `Moved “${workspaceSummary.name}”.`,
          })
        } catch (error) {
          setWorkspaceStatus({
            kind: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Workspace reorder failed.',
          })
        }
      })()
    },
    [moveWorkspace],
  )

  const handleDeleteWorkspace = useCallback(
    (workspaceSummary: WorkspaceSummary) => {
      openPromptDialog({
        description:
          workspaceSummary.id === activeWorkspaceId
            ? `“${workspaceSummary.name}” will be removed and the next available workspace will be opened.`
            : `“${workspaceSummary.name}” will be removed from this device.`,
        eyebrow: 'Workspaces',
        onPrimaryAction: () => {
          setWorkspaceStatus({
            kind: 'busy',
            message: `Deleting “${workspaceSummary.name}”…`,
          })

          if (workspaceEditor?.workspaceId === workspaceSummary.id) {
            setWorkspaceEditor(null)
          }

          void (async () => {
            try {
              await deleteWorkspace(workspaceSummary.id)
              setWorkspaceStatus({
                kind: 'success',
                message: `Deleted workspace “${workspaceSummary.name}”.`,
              })
            } catch (error) {
              setWorkspaceStatus({
                kind: 'error',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Workspace delete failed.',
              })
            }
          })()
        },
        primaryLabel: 'Delete workspace',
        role: 'alertdialog',
        secondaryLabel: 'Cancel',
        title: 'Delete workspace?',
        tone: 'danger',
      })
    },
    [activeWorkspaceId, deleteWorkspace, openPromptDialog, workspaceEditor],
  )

  const handleTemplateEditorSubmit = useCallback(async () => {
    if (!templateEditor) {
      return
    }

    setTemplateStatus({
      kind: 'busy',
      message:
        templateEditor.mode === 'create'
          ? 'Saving template…'
          : 'Updating template details…',
    })

    try {
      if (templateEditor.mode === 'create') {
        if (!hasTemplateSelection) {
          throw new Error(
            'Select cards, groups or pictures before saving a template.',
          )
        }

        const imageRecords = await collectSelectionImageRecords()
        const previewDataUrl = await createTemplatePreviewDataUrl({
          appearance,
          bundle: selectedEntitySelection.bundle,
          imageRecords,
        })
        const template = createTemplateDocument({
          bundle: selectedEntitySelection.bundle,
          description: templateEditor.description,
          imageRecords,
          name: templateEditor.name,
          previewDataUrl,
        })

        await putTemplate({ records: imageRecords, template })
        await refreshTemplates()
        setTemplateEditor(null)
        setTemplateStatus({
          kind: 'success',
          message: `Saved template “${template.name}”.`,
        })
        return
      }

      const template = templates.find(
        (candidate) => candidate.id === templateEditor.templateId,
      )

      if (!template) {
        throw new Error('The selected template could not be found.')
      }

      const imageRecords = await getTemplateImageRecords(template.id)
      const nextTemplate = {
        ...template,
        description: templateEditor.description.trim() || undefined,
        name: templateEditor.name.trim(),
        previewDataUrl: template.previewDataUrl,
        updatedAt: new Date().toISOString(),
      } satisfies TemplateDocument

      await putTemplate({ records: imageRecords, template: nextTemplate })
      await refreshTemplates()
      setTemplateEditor(null)
      setTemplateStatus({
        kind: 'success',
        message: `Updated template “${nextTemplate.name}”.`,
      })
    } catch (error) {
      setTemplateStatus({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Template save failed.',
      })
    }
  }, [
    appearance,
    collectSelectionImageRecords,
    hasTemplateSelection,
    refreshTemplates,
    selectedEntitySelection.bundle,
    templateEditor,
    templates,
  ])

  const handleInsertTemplate = useCallback(
    async (template: TemplateDocument) => {
      setTemplateStatus({
        kind: 'busy',
        message: `Inserting “${template.name}”…`,
      })

      try {
        const imageRecords = await getTemplateImageRecords(template.id)

        if (imageRecords.length !== template.content.images.length) {
          throw new Error(
            'This template is missing one or more stored image files.',
          )
        }

        const materializedTemplate = await materializeTemplateDocument({
          imageRecords,
          resolveExistingImage: (imageId) => getStoredImageAssetRecord(imageId),
          template,
        })

        await Promise.all(
          materializedTemplate.imagesToStore.map((imageRecord) =>
            putStoredImageAssetRecord(imageRecord),
          ),
        )

        const placedTemplate = placeCanvasEntityBundleNearPoint({
          bundle: materializedTemplate.bundle,
          point: screenPointToCanvas(
            { x: window.innerWidth / 2, y: window.innerHeight / 2 },
            viewport,
          ),
          workspace,
        })

        if (!placedTemplate?.bounds) {
          throw new Error(
            'No free placement area was found near the current viewport.',
          )
        }

        if (interactionMode !== 'edit') {
          toggleInteractionMode('edit')
        }

        addEntityBundle({
          cards: placedTemplate.bundle.cards,
          groups: placedTemplate.bundle.groups,
          pictures: placedTemplate.bundle.pictures,
          selectedCardIds: placedTemplate.bundle.cards.map((card) => card.id),
          selectedGroupIds: placedTemplate.bundle.groups.map(
            (group) => group.id,
          ),
          selectedPictureIds: placedTemplate.bundle.pictures.map(
            (picture) => picture.id,
          ),
        })
        centerViewportOnBounds(placedTemplate.bounds)
        setTemplateStatus({
          kind: 'success',
          message: `Inserted “${template.name}”.`,
        })
      } catch (error) {
        setTemplateStatus({
          kind: 'error',
          message:
            error instanceof Error ? error.message : 'Template insert failed.',
        })
      }
    },
    [
      addEntityBundle,
      centerViewportOnBounds,
      interactionMode,
      toggleInteractionMode,
      viewport,
      workspace,
    ],
  )

  const handleDeleteTemplate = useCallback(
    (template: TemplateDocument) => {
      openPromptDialog({
        description: `“${template.name}” will be removed from your local template library.`,
        eyebrow: 'Templates',
        onPrimaryAction: () => {
          setTemplateStatus({
            kind: 'busy',
            message: `Deleting “${template.name}”…`,
          })

          void (async () => {
            try {
              await deleteTemplate(template.id)
              await refreshTemplates()
              setTemplateStatus({
                kind: 'success',
                message: `Deleted template “${template.name}”.`,
              })
            } catch (error) {
              setTemplateStatus({
                kind: 'error',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Template delete failed.',
              })
            }
          })()
        },
        primaryLabel: 'Delete template',
        role: 'alertdialog',
        secondaryLabel: 'Cancel',
        title: 'Delete template?',
        tone: 'danger',
      })
    },
    [openPromptDialog, refreshTemplates],
  )

  const handleDuplicateTemplate = useCallback(
    async (template: TemplateDocument) => {
      setTemplateStatus({
        kind: 'busy',
        message: `Duplicating “${template.name}”…`,
      })

      try {
        const imageRecords = await getTemplateImageRecords(template.id)
        const duplicatedTemplate = duplicateTemplateDocument({ template })

        await putTemplate({
          records: imageRecords,
          template: duplicatedTemplate,
        })
        await refreshTemplates()
        setTemplateStatus({
          kind: 'success',
          message: `Duplicated “${template.name}”.`,
        })
      } catch (error) {
        setTemplateStatus({
          kind: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Template duplicate failed.',
        })
      }
    },
    [refreshTemplates],
  )

  const handleOverwriteTemplate = useCallback(
    (template: TemplateDocument) => {
      if (!hasTemplateSelection) {
        setTemplateStatus({
          kind: 'error',
          message:
            'Select cards, groups or pictures before replacing a template.',
        })
        return
      }

      openPromptDialog({
        description: `Replace the saved content of “${template.name}” with the current selection?`,
        eyebrow: 'Templates',
        onPrimaryAction: () => {
          setTemplateStatus({
            kind: 'busy',
            message: `Replacing “${template.name}”…`,
          })

          void (async () => {
            try {
              const imageRecords = await collectSelectionImageRecords()
              const previewDataUrl = await createTemplatePreviewDataUrl({
                appearance,
                bundle: selectedEntitySelection.bundle,
                imageRecords,
              })
              const nextTemplate = createTemplateDocument({
                bundle: selectedEntitySelection.bundle,
                description: template.description ?? '',
                imageRecords,
                name: template.name,
                previewDataUrl,
                templateId: template.id,
                timestamps: {
                  createdAt: template.createdAt,
                  updatedAt: new Date().toISOString(),
                },
              })

              await putTemplate({
                records: imageRecords,
                template: nextTemplate,
              })
              await refreshTemplates()
              setTemplateStatus({
                kind: 'success',
                message: `Replaced the content of “${template.name}”.`,
              })
            } catch (error) {
              setTemplateStatus({
                kind: 'error',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Template replace failed.',
              })
            }
          })()
        },
        primaryLabel: 'Replace template',
        role: 'alertdialog',
        secondaryLabel: 'Cancel',
        title: 'Replace saved template?',
        tone: 'danger',
      })
    },
    [
      appearance,
      collectSelectionImageRecords,
      hasTemplateSelection,
      openPromptDialog,
      refreshTemplates,
      selectedEntitySelection.bundle,
    ],
  )

  const handleDownloadTemplate = useCallback(
    async (template: TemplateDocument) => {
      setTemplateStatus({
        kind: 'busy',
        message: `Preparing “${template.name}”…`,
      })

      try {
        const imageRecords = await getTemplateImageRecords(template.id)
        const contentImagesByAssetId = new Map(
          template.content.images.map((image) => [image.asset.id, image]),
        )
        const downloadedImages = await Promise.all(
          imageRecords.map(async (record) => ({
            asset: record.asset,
            dataUrl: await readBlobAsDataUrl(record.blob),
            sourceImageId:
              contentImagesByAssetId.get(record.asset.id)?.sourceImageId ??
              record.asset.id,
          })),
        )
        const exportPayload = {
          format: TEMPLATE_EXPORT_FORMAT,
          version: TEMPLATE_EXPORT_VERSION,
          exportedAt: new Date().toISOString(),
          images: downloadedImages,
          template,
        }
        const exportBlob = new Blob(
          [`${JSON.stringify(exportPayload, null, 2)}\n`],
          {
            type: 'application/json',
          },
        )

        triggerBlobDownload(
          exportBlob,
          createTemplateDownloadName(template.name),
        )
        setTemplateStatus({
          kind: 'success',
          message: `Downloaded “${template.name}”.`,
        })
      } catch (error) {
        setTemplateStatus({
          kind: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Template download failed.',
        })
      }
    },
    [],
  )

  const openCreateTemplateEditor = useCallback(() => {
    setTemplateEditor({
      description: '',
      mode: 'create',
      name: `Template ${templates.length + 1}`,
    })
    setTemplateStatus({ kind: 'idle', message: '' })
  }, [templates.length])

  const openEditTemplateEditor = useCallback((template: TemplateDocument) => {
    setTemplateEditor({
      description: template.description ?? '',
      mode: 'edit',
      name: template.name,
      templateId: template.id,
    })
    setTemplateStatus({ kind: 'idle', message: '' })
  }, [])

  useEffect(() => {
    if (!open || activeTab !== 'templates') {
      return
    }

    void refreshTemplates().catch(() => {
      setTemplateStatus({
        kind: 'error',
        message: 'Templates could not be loaded.',
      })
    })
  }, [activeTab, open, refreshTemplates])

  useEffect(() => {
    if (!open || activeTab !== 'data') {
      return
    }

    void Promise.all([refreshTemplateCount(), refreshThemeCount()]).catch(
      () => undefined,
    )
  }, [activeTab, open, refreshTemplateCount, refreshThemeCount])

  useEffect(() => {
    if (!open || activeTab !== 'statistics') {
      return
    }

    let cancelled = false

    setStorageStatistics((current) =>
      current.snapshot
        ? {
            kind: 'ready',
            message: '',
            snapshot: current.snapshot,
          }
        : {
            kind: 'loading',
            message: '',
            snapshot: null,
          },
    )

    void loadWorkspaceStorageSnapshot(workspace)
      .then((snapshot) => {
        if (cancelled) {
          return
        }

        setStorageStatistics({
          kind: 'ready',
          message: '',
          snapshot,
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setStorageStatistics((current) =>
          current.snapshot
            ? {
                kind: 'ready',
                message: '',
                snapshot: current.snapshot,
              }
            : {
                kind: 'error',
                message: 'Storage statistics could not be loaded.',
                snapshot: null,
              },
        )
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, open, workspace])

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

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: Event) => {
      if (promptDialog) {
        return
      }

      if (isSelectMenuPortalTarget(event.target)) {
        return
      }

      if (!shellRef.current?.contains(event.target as Node)) {
        handleRequestClose()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (promptDialog) {
          dismissPromptDialog()
          return
        }

        handleRequestClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('click', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('click', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dismissPromptDialog, handleRequestClose, open, promptDialog])

  return (
    <div className={styles.shell} ref={shellRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Open menu"
        className={styles.toggle}
        data-testid="options-menu-toggle"
        onClick={handleToggle}
        type="button"
      >
        <span aria-hidden="true" className={styles.toggleGlyph}>
          <span className={styles.toggleLine} />
          <span className={styles.toggleLine} />
          <span className={styles.toggleLine} />
        </span>
      </button>
      {open ? (
        <section
          aria-labelledby={tabListId}
          className={styles.panel}
          id={menuId}
          role="dialog"
        >
          <div className={styles.topSection}>
            <div className={styles.headerRow}>
              <div className={styles.headerIntro}>
                <span aria-hidden="true" className={styles.brandMark}>
                  <LinkHubMark
                    className={styles.brandGlyph}
                    color="var(--text-primary)"
                  />
                </span>
                <div className={styles.titleStack}>
                  <p className={styles.eyebrow}>Workspace menu</p>
                  <div className={styles.titleRow}>
                    <h2 className={styles.title}>LinkHub</h2>
                    <span className={styles.headerMeta}>Local</span>
                  </div>
                  <p className={styles.subtitle}>
                    Settings, templates, stats and canvas data in one place.
                  </p>
                </div>
              </div>
              <button
                aria-label="Close menu"
                className={styles.closeButton}
                onClick={handleRequestClose}
                type="button"
              >
                <span aria-hidden="true" className={styles.closeIcon}>
                  <svg
                    viewBox="0 0 24 24"
                    focusable="false"
                    className={styles.closeSvg}
                  >
                    <path
                      d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
              </button>
            </div>
            <div
              aria-label="Menu sections"
              className={styles.tabList}
              id={tabListId}
              role="tablist"
            >
              {TABS.map((tab) => {
                const selected = activeTab === tab.id

                return (
                  <button
                    aria-controls={`${menuId}-${tab.id}`}
                    aria-selected={selected}
                    className={selected ? styles.tabActive : styles.tab}
                    id={`${tabListId}-${tab.id}`}
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    role="tab"
                    type="button"
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
          {activeTab === 'options' ? (
            <OptionsAppearanceSection
              activeColorSettings={activeColorSettings}
              appearance={appearance}
              menuId={menuId}
              resetAppearanceOptions={resetAppearanceOptions}
              setBorderPresets={setBorderPresets}
              setDefaultBorderPresetIndex={setDefaultBorderPresetIndex}
              setDefaultCardCornerRadius={setDefaultCardCornerRadius}
              setDefaultCardShowImage={setDefaultCardShowImage}
              setDefaultCardOpenInNewTab={setDefaultCardOpenInNewTab}
              setDefaultCardShowTitle={setDefaultCardShowTitle}
              setDefaultCardSize={setDefaultCardSize}
              setDefaultFillPresetIndex={setDefaultFillPresetIndex}
              setDefaultSurfaceShadowStyle={setDefaultSurfaceShadowStyle}
              setDefaultSurfaceTransparency={setDefaultSurfaceTransparency}
              setFillPresets={setFillPresets}
              setThemeMode={setThemeMode}
              tabListId={tabListId}
            />
          ) : activeTab === 'themes' ? (
            <ThemeGallery
              appearance={appearance}
              applyTheme={applyTheme}
              menuId={menuId}
              tabListId={tabListId}
              setStyleToken={setStyleToken}
              resetStyleTokens={resetStyleTokens}
            />
          ) : activeTab === 'templates' ? (
            <div
              aria-labelledby={`${tabListId}-templates`}
              className={styles.panelBody}
              data-testid="templates-panel"
              id={`${menuId}-templates`}
              role="tabpanel"
            >
              <div className={styles.templatesGrid}>
                <section
                  className={`${styles.templateCard} ${styles.templateSelectionCard}`}
                >
                  <div
                    className={`${styles.sectionHeader} ${styles.templateSelectionHeader}`}
                  >
                    <h4 className={styles.sectionTitle}>Selection</h4>
                    <span className={styles.sectionMeta}>
                      {hasTemplateSelection
                        ? 'Ready to save'
                        : 'Nothing selected'}
                    </span>
                  </div>
                  <p
                    className={`${styles.fieldHint} ${styles.templateSelectionHint}`}
                  >
                    Save the current card, group and picture selection as a
                    reusable local template.
                  </p>
                  <div
                    className={`${styles.dataMetrics} ${styles.templateSelectionMetrics}`}
                  >
                    <span className={styles.dataMetric}>
                      Cards: {selectedEntitySelection.bundle.cards.length}
                    </span>
                    <span className={styles.dataMetric}>
                      Groups: {selectedEntitySelection.bundle.groups.length}
                    </span>
                    <span className={styles.dataMetric}>
                      Pictures: {selectedEntitySelection.bundle.pictures.length}
                    </span>
                    <span className={styles.dataMetric}>
                      Images: {selectedBundleImageIds.length}
                    </span>
                  </div>
                  <div
                    className={`${styles.dataActions} ${styles.templateSelectionActions}`}
                  >
                    <button
                      className={`${styles.dataPrimaryButton} ${styles.templateSelectionPrimaryButton}`}
                      data-testid="open-template-create"
                      disabled={
                        !hasTemplateSelection || templateStatus.kind === 'busy'
                      }
                      onClick={openCreateTemplateEditor}
                      type="button"
                    >
                      Save selection as template
                    </button>
                  </div>
                </section>

                {templateEditor ? (
                  <section className={styles.templateCard}>
                    <div className={styles.sectionHeader}>
                      <h4 className={styles.sectionTitle}>
                        {templateEditor.mode === 'create'
                          ? 'Create template'
                          : 'Edit template'}
                      </h4>
                    </div>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Name</span>
                      <input
                        aria-label="Template name"
                        className={styles.select}
                        value={templateEditor.name}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value

                          setTemplateEditor((current) =>
                            current ? { ...current, name: nextValue } : current,
                          )
                        }}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Description</span>
                      <textarea
                        aria-label="Template description"
                        className={styles.templateTextarea}
                        rows={4}
                        value={templateEditor.description}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value

                          setTemplateEditor((current) =>
                            current
                              ? {
                                  ...current,
                                  description: nextValue,
                                }
                              : current,
                          )
                        }}
                      />
                    </label>
                    <div className={styles.dataActions}>
                      <button
                        className={styles.dataPrimaryButton}
                        disabled={templateStatus.kind === 'busy'}
                        onClick={() => {
                          void handleTemplateEditorSubmit()
                        }}
                        type="button"
                      >
                        {templateEditor.mode === 'create'
                          ? 'Create template'
                          : 'Save details'}
                      </button>
                      <button
                        disabled={templateStatus.kind === 'busy'}
                        onClick={() => setTemplateEditor(null)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </section>
                ) : null}

                <section className={styles.templateCard}>
                  <div className={styles.sectionHeader}>
                    <h4 className={styles.sectionTitle}>Saved templates</h4>
                    <span className={styles.sectionMeta}>
                      {templates.length} total
                    </span>
                  </div>
                  {templates.length === 0 ? (
                    <p className={styles.emptyState}>
                      No templates yet. Select content on the canvas and save
                      the first one.
                    </p>
                  ) : (
                    <div className={styles.templateList}>
                      {templates.map((template) => (
                        <article
                          className={styles.templateListItem}
                          key={template.id}
                        >
                          <div className={styles.templatePreviewFrame}>
                            {template.previewDataUrl ? (
                              <img
                                alt={`Template preview for ${template.name}`}
                                className={styles.templatePreviewImage}
                                loading="lazy"
                                src={template.previewDataUrl}
                              />
                            ) : (
                              <div className={styles.templatePreviewFallback}>
                                <span
                                  className={
                                    styles.templatePreviewFallbackLabel
                                  }
                                >
                                  No preview
                                </span>
                              </div>
                            )}
                          </div>
                          <div className={styles.templateContent}>
                            <div className={styles.templateHeader}>
                              <div className={styles.templateText}>
                                <strong
                                  className={`${styles.templateTitle} ${template.description ? styles.templateTitleWithTooltip : ''}`}
                                  title={template.description ?? undefined}
                                >
                                  {template.name}
                                </strong>
                                <span className={styles.templateMeta}>
                                  Updated{' '}
                                  {DATE_TIME_FORMATTER.format(
                                    new Date(template.updatedAt),
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className={styles.dataMetrics}>
                              <span className={styles.dataMetric}>
                                Cards: {template.content.cards.length}
                              </span>
                              <span className={styles.dataMetric}>
                                Groups: {template.content.groups.length}
                              </span>
                              <span className={styles.dataMetric}>
                                Pictures: {template.content.pictures.length}
                              </span>
                              <span className={styles.dataMetric}>
                                Images: {template.content.images.length}
                              </span>
                            </div>
                            <div className={styles.templateActions}>
                              <button
                                aria-label="Insert"
                                className={`${styles.templateActionButton} ${styles.templateActionButtonPrimary}`}
                                disabled={templateStatus.kind === 'busy'}
                                onClick={() => {
                                  void handleInsertTemplate(template)
                                }}
                                title="Insert template"
                                type="button"
                              >
                                <span
                                  aria-hidden="true"
                                  className={styles.templateActionIcon}
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    focusable="false"
                                    className={styles.templateActionSvg}
                                  >
                                    <path
                                      d="M11 4a1 1 0 1 1 2 0v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4Z"
                                      fill="currentColor"
                                    />
                                    <path
                                      d="M5 18a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </span>
                              </button>
                              <button
                                aria-label="Download"
                                className={styles.templateActionButton}
                                disabled={templateStatus.kind === 'busy'}
                                onClick={() => {
                                  void handleDownloadTemplate(template)
                                }}
                                title="Download template"
                                type="button"
                              >
                                <span
                                  aria-hidden="true"
                                  className={styles.templateActionIcon}
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    focusable="false"
                                    className={styles.templateActionSvg}
                                  >
                                    <path
                                      d="M11 4a1 1 0 1 1 2 0v7.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4Z"
                                      fill="currentColor"
                                    />
                                    <path
                                      d="M5.75 16A1.75 1.75 0 0 0 4 17.75v.5C4 19.22 4.78 20 5.75 20h12.5c.97 0 1.75-.78 1.75-1.75v-.5A1.75 1.75 0 0 0 18.25 16h-1.5a1 1 0 1 0 0 2h1.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25H5.75a.25.25 0 0 1-.25-.25v-.5a.25.25 0 0 1 .25-.25h1.5a1 1 0 1 0 0-2h-1.5Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </span>
                              </button>
                              <button
                                aria-label="Edit"
                                className={styles.templateActionButton}
                                disabled={templateStatus.kind === 'busy'}
                                onClick={() => openEditTemplateEditor(template)}
                                title="Edit template details"
                                type="button"
                              >
                                <span
                                  aria-hidden="true"
                                  className={styles.templateActionIcon}
                                >
                                  <EditIcon
                                    className={styles.templateActionSvg}
                                  />
                                </span>
                              </button>
                              <button
                                aria-label="Replace content"
                                className={styles.templateActionButton}
                                disabled={
                                  !hasTemplateSelection ||
                                  templateStatus.kind === 'busy'
                                }
                                onClick={() => {
                                  void handleOverwriteTemplate(template)
                                }}
                                title="Replace template content with current selection"
                                type="button"
                              >
                                <span
                                  aria-hidden="true"
                                  className={styles.templateActionIcon}
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    focusable="false"
                                    className={styles.templateActionSvg}
                                  >
                                    <path
                                      d="M7.41 5.59a1 1 0 0 1 0 1.41L5.41 9H15a4 4 0 1 1 0 8h-1a1 1 0 1 1 0-2h1a2 2 0 1 0 0-4H5.41l2 2a1 1 0 1 1-1.42 1.41l-3.7-3.7a1 1 0 0 1 0-1.41l3.7-3.71a1 1 0 0 1 1.42 0Z"
                                      fill="currentColor"
                                    />
                                    <path
                                      d="M17 3a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V5h-3a1 1 0 1 1 0-2h4Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </span>
                              </button>
                              <button
                                aria-label="Duplicate"
                                className={styles.templateActionButton}
                                disabled={templateStatus.kind === 'busy'}
                                onClick={() => {
                                  void handleDuplicateTemplate(template)
                                }}
                                title="Duplicate template"
                                type="button"
                              >
                                <span
                                  aria-hidden="true"
                                  className={styles.templateActionIcon}
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    focusable="false"
                                    className={styles.templateActionSvg}
                                  >
                                    <path
                                      d="M8.75 4A1.75 1.75 0 0 0 7 5.75v8.5C7 15.22 7.78 16 8.75 16h8.5c.97 0 1.75-.78 1.75-1.75v-8.5C19 4.78 18.22 4 17.25 4h-8.5Zm0 1.5h8.5c.14 0 .25.11.25.25v8.5a.25.25 0 0 1-.25.25h-8.5a.25.25 0 0 1-.25-.25v-8.5c0-.14.11-.25.25-.25Z"
                                      fill="currentColor"
                                    />
                                    <path
                                      d="M5.75 8A1.75 1.75 0 0 0 4 9.75v8.5C4 19.22 4.78 20 5.75 20h8.5a1 1 0 1 0 0-2h-8.5a.25.25 0 0 1-.25-.25v-8.5A.25.25 0 0 1 5.75 9h.5a1 1 0 1 0 0-2h-.5Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </span>
                              </button>
                              <button
                                aria-label="Delete"
                                className={`${styles.templateActionButton} ${styles.templateActionButtonDanger}`}
                                disabled={templateStatus.kind === 'busy'}
                                onClick={() => {
                                  void handleDeleteTemplate(template)
                                }}
                                title="Delete template"
                                type="button"
                              >
                                <span
                                  aria-hidden="true"
                                  className={styles.templateActionIcon}
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    focusable="false"
                                    className={styles.templateActionSvg}
                                  >
                                    <path
                                      d="M6.7 5.3a1 1 0 0 1 1.4 0L12 9.17l3.9-3.88a1 1 0 1 1 1.4 1.42L13.4 10.6l3.88 3.9a1 1 0 0 1-1.42 1.4L12 12l-3.9 3.9a1 1 0 0 1-1.4-1.42l3.88-3.88-3.9-3.9a1 1 0 0 1 0-1.4Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </span>
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                {templateStatus.message ? (
                  <section
                    className={`${styles.dataStatus} ${
                      templateStatus.kind === 'error'
                        ? styles.dataStatusError
                        : templateStatus.kind === 'success'
                          ? styles.dataStatusSuccess
                          : templateStatus.kind === 'busy'
                            ? styles.dataStatusBusy
                            : ''
                    }`}
                    data-testid="template-status"
                  >
                    {templateStatus.message}
                  </section>
                ) : null}
              </div>
            </div>
          ) : activeTab === 'statistics' ? (
            <div
              aria-labelledby={`${tabListId}-statistics`}
              className={styles.panelBody}
              id={`${menuId}-statistics`}
              role="tabpanel"
            >
              <StatisticsPanel
                cardCount={cardCount}
                statistics={statistics}
                storageMessage={storageStatistics.message}
                storageSnapshot={storageStatistics.snapshot}
                storageStatus={storageStatistics.kind}
              />
            </div>
          ) : (
            <OptionsDataSection
              activeWorkspaceId={activeWorkspaceId}
              dataStatus={dataStatus}
              handleExportCanvas={handleExportCanvas}
              handleImportCanvasFile={handleImportCanvasFile}
              importFileInputRef={importFileInputRef}
              interactionMode={interactionMode}
              menuId={menuId}
              onCancelWorkspaceEditor={handleCancelWorkspaceEdit}
              onDeleteWorkspace={handleDeleteWorkspace}
              onMoveWorkspace={(workspaceId, direction) => {
                const workspaceSummary = workspaceSummaries.find(
                  (candidate) => candidate.id === workspaceId,
                )

                if (!workspaceSummary) {
                  return
                }

                handleMoveWorkspace(workspaceSummary, direction)
              }}
              onRequestEditMode={() => toggleInteractionMode('edit')}
              onStartWorkspaceEdit={handleStartWorkspaceEdit}
              onSubmitWorkspaceEditor={handleSubmitWorkspaceEditor}
              onUpdateWorkspaceEditorName={(name) => {
                setWorkspaceEditor((current) =>
                  current
                    ? {
                        ...current,
                        name,
                      }
                    : current,
                )
              }}
              referencedImageCount={referencedImageIds.length}
              savedThemeCount={savedThemeCount}
              savedTemplateCount={savedTemplateCount}
              tabListId={tabListId}
              workspaceEditor={workspaceEditor}
              workspaceEntityCounts={{
                cards: workspace.cards.length,
                groups: workspace.groups.length,
                pictures: workspace.pictures.length,
              }}
              workspaceStatus={workspaceStatus}
              workspaceSummaries={workspaceSummaries}
            />
          )}
        </section>
      ) : null}
      {promptDialog ? (
        <PromptDialog
          auxiliaryLabel={promptDialog.auxiliaryLabel}
          auxiliaryTone={promptDialog.auxiliaryTone}
          closeLabel={
            promptDialog.secondaryLabel ? 'Cancel prompt' : 'Close prompt'
          }
          description={promptDialog.description}
          eyebrow={promptDialog.eyebrow}
          onAuxiliaryAction={promptDialog.onAuxiliaryAction}
          onPrimaryAction={promptDialog.onPrimaryAction}
          onRequestClose={dismissPromptDialog}
          open
          primaryLabel={promptDialog.primaryLabel}
          role={promptDialog.role}
          secondaryLabel={promptDialog.secondaryLabel}
          title={promptDialog.title}
          tone={promptDialog.tone}
        />
      ) : null}
    </div>
  )
}
