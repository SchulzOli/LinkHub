import { useCallback, useEffect, useState } from 'react'
import panelStyles from '../../ui/panel/Panel.module.css'

import styles from '../OptionsMenu.module.css'
import templateStyles from './TemplatesPanel.module.css'

import type { AppearanceProfile } from '../../../contracts/appearanceProfile'
import type { TemplateDocument } from '../../../contracts/template'
import type { Viewport, Workspace } from '../../../contracts/workspace'
import type { CanvasEntityBundle } from '../../../features/canvas/entityBundle'
import { placeCanvasEntityBundleNearPoint } from '../../../features/canvas/entityBundlePlacement'
import { screenPointToCanvas } from '../../../features/placement/canvasMath'
import {
  createTemplateDocument,
  createTemplatePreviewDataUrl,
  duplicateTemplateDocument,
  materializeTemplateDocument,
} from '../../../features/templates/templateLibrary'
import type { InteractionMode } from '../../../state/useWorkspaceStore'
import type { AddEntityBundleInput } from '../../../state/workspaceStoreTypes'
import {
  getStoredImageAssetRecord,
  putStoredImageAssetRecord,
} from '../../../storage/imageRepository'
import {
  deleteTemplate,
  getTemplateImageRecords,
  putTemplate,
} from '../../../storage/templateRepository'
import { DeleteIcon } from '../../ui/DeleteIcon'
import { EditIcon } from '../../ui/EditIcon'
import {
  IconButton,
  PanelSection,
  SettingRow,
  StatusMessage,
} from '../../ui/panel/Panel'
import {
  DownloadIcon,
  DuplicateIcon,
  InsertIcon,
  ReplaceIcon,
} from '../../ui/panel/PanelIcons'
import {
  DATE_TIME_FORMATTER,
  createTemplateDownloadName,
  readBlobAsDataUrl,
  triggerBlobDownload,
  type DataStatus,
  type OpenPromptDialog,
} from './optionsMenuShared'

const TEMPLATE_EXPORT_FORMAT = 'linkhub.template-export'
const TEMPLATE_EXPORT_VERSION = 1

type TemplateEditorState = {
  description: string
  mode: 'create' | 'edit'
  name: string
  templateId?: string
}

type AddEntityBundlePayload = AddEntityBundleInput

type TemplatesPanelProps = {
  addEntityBundle: (payload: AddEntityBundlePayload) => void
  appearance: AppearanceProfile
  hasTemplateSelection: boolean
  interactionMode: InteractionMode
  menuId: string
  onRefreshTemplates: () => Promise<void>
  openPromptDialog: OpenPromptDialog
  selectedBundleImageIds: string[]
  selectedEntitySelection: { bundle: CanvasEntityBundle }
  setViewport: (viewport: Viewport) => void
  tabListId: string
  templates: TemplateDocument[]
  toggleInteractionMode: (mode: InteractionMode) => void
  viewport: Viewport
  workspace: Workspace
}

/**
 * Full render + interaction surface for the Options Menu Templates tab.
 *
 * Owns its own editor state and status, and orchestrates all template CRUD
 * against the template and image repositories. Consumers provide the current
 * selection, appearance and workspace context through props.
 *
 * Extracted from the original `OptionsMenu.tsx` and designed to be
 * `React.lazy`-loaded by the Options Menu shell.
 */
export function TemplatesPanel({
  addEntityBundle,
  appearance,
  hasTemplateSelection,
  interactionMode,
  menuId,
  onRefreshTemplates,
  openPromptDialog,
  selectedBundleImageIds,
  selectedEntitySelection,
  setViewport,
  tabListId,
  templates,
  toggleInteractionMode,
  viewport,
  workspace,
}: TemplatesPanelProps) {
  const [templateEditor, setTemplateEditor] =
    useState<TemplateEditorState | null>(null)
  const [templateStatus, setTemplateStatus] = useState<DataStatus>({
    kind: 'idle',
    message: '',
  })

  useEffect(() => {
    void onRefreshTemplates().catch(() => {
      setTemplateStatus({
        kind: 'error',
        message: 'Templates could not be loaded.',
      })
    })
  }, [onRefreshTemplates])

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
        await onRefreshTemplates()
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
      await onRefreshTemplates()
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
    onRefreshTemplates,
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
              await onRefreshTemplates()
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
    [onRefreshTemplates, openPromptDialog],
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
        await onRefreshTemplates()
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
    [onRefreshTemplates],
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
              await onRefreshTemplates()
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
      onRefreshTemplates,
      openPromptDialog,
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

  const templateBusy = templateStatus.kind === 'busy'

  return (
    <div
      aria-labelledby={`${tabListId}-templates`}
      className={styles.panelBody}
      data-testid="templates-panel"
      id={`${menuId}-templates`}
      role="tabpanel"
    >
      <div className={panelStyles.stack}>
        <PanelSection
          meta={hasTemplateSelection ? 'Ready to save' : 'Nothing selected'}
          title="Selection"
        >
          <SettingRow
            hint={
              <>
                Save the selected cards, groups and pictures as a reusable local
                template.
                <span
                  className={`${panelStyles.chips} ${templateStyles.chips}`}
                >
                  <span className={panelStyles.chip}>
                    Cards: {selectedEntitySelection.bundle.cards.length}
                  </span>
                  <span className={panelStyles.chip}>
                    Groups: {selectedEntitySelection.bundle.groups.length}
                  </span>
                  <span className={panelStyles.chip}>
                    Pictures: {selectedEntitySelection.bundle.pictures.length}
                  </span>
                  <span className={panelStyles.chip}>
                    Images: {selectedBundleImageIds.length}
                  </span>
                </span>
              </>
            }
            label="Save selection as template"
          >
            <button
              className={`${panelStyles.button} ${panelStyles.buttonPrimary}`}
              data-testid="open-template-create"
              disabled={!hasTemplateSelection || templateBusy}
              onClick={openCreateTemplateEditor}
              type="button"
            >
              Save selection as template
            </button>
          </SettingRow>
          {templateEditor ? (
            <div className={templateStyles.editor}>
              <span className={panelStyles.rowLabel}>
                {templateEditor.mode === 'create'
                  ? 'Create template'
                  : 'Edit template'}
              </span>
              <label className={panelStyles.field}>
                <span className={panelStyles.fieldLabel}>Name</span>
                <input
                  aria-label="Template name"
                  value={templateEditor.name}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.value

                    setTemplateEditor((current) =>
                      current ? { ...current, name: nextValue } : current,
                    )
                  }}
                />
              </label>
              <label className={panelStyles.field}>
                <span className={panelStyles.fieldLabel}>Description</span>
                <textarea
                  aria-label="Template description"
                  className={panelStyles.textarea}
                  rows={3}
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
              <div className={panelStyles.actions}>
                <button
                  className={`${panelStyles.button} ${panelStyles.buttonPrimary}`}
                  disabled={templateBusy}
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
                  className={`${panelStyles.button} ${panelStyles.buttonQuiet}`}
                  disabled={templateBusy}
                  onClick={() => setTemplateEditor(null)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </PanelSection>

        {templateStatus.message ? (
          <StatusMessage kind={templateStatus.kind} testId="template-status">
            {templateStatus.message}
          </StatusMessage>
        ) : null}

        <PanelSection
          grouped={templates.length === 0}
          meta={`${templates.length} total`}
          title="Saved templates"
        >
          {templates.length === 0 ? (
            <p className={panelStyles.empty}>
              No templates yet. Select content on the canvas and save the first
              one.
            </p>
          ) : (
            <div className={templateStyles.grid}>
              {templates.map((template) => (
                <article className={templateStyles.card} key={template.id}>
                  <div className={templateStyles.preview}>
                    {template.previewDataUrl ? (
                      <img
                        alt={`Template preview for ${template.name}`}
                        loading="lazy"
                        src={template.previewDataUrl}
                      />
                    ) : (
                      <span className={templateStyles.previewFallback}>
                        No preview
                      </span>
                    )}
                    <IconButton
                      className={templateStyles.insertButton}
                      disabled={templateBusy}
                      label="Insert"
                      title="Insert template"
                      tone="accent"
                      onClick={() => {
                        void handleInsertTemplate(template)
                      }}
                    >
                      <InsertIcon className={panelStyles.icon} />
                    </IconButton>
                  </div>
                  <div className={templateStyles.body}>
                    <strong
                      className={templateStyles.title}
                      title={template.description ?? undefined}
                    >
                      {template.name}
                    </strong>
                    <span className={panelStyles.rowHint}>
                      {[
                        countLabel(template.content.cards.length, 'card'),
                        countLabel(template.content.groups.length, 'group'),
                        countLabel(template.content.pictures.length, 'picture'),
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Empty'}
                    </span>
                    <span className={templateStyles.meta}>
                      Updated{' '}
                      {DATE_TIME_FORMATTER.format(new Date(template.updatedAt))}
                    </span>
                  </div>
                  <div className={templateStyles.actions}>
                    <IconButton
                      disabled={templateBusy}
                      label="Download"
                      title="Download template"
                      onClick={() => {
                        void handleDownloadTemplate(template)
                      }}
                    >
                      <DownloadIcon className={panelStyles.icon} />
                    </IconButton>
                    <IconButton
                      disabled={templateBusy}
                      label="Edit"
                      title="Edit template details"
                      onClick={() => openEditTemplateEditor(template)}
                    >
                      <EditIcon className={panelStyles.icon} />
                    </IconButton>
                    <IconButton
                      disabled={!hasTemplateSelection || templateBusy}
                      label="Replace content"
                      title="Replace template content with current selection"
                      onClick={() => {
                        void handleOverwriteTemplate(template)
                      }}
                    >
                      <ReplaceIcon className={panelStyles.icon} />
                    </IconButton>
                    <IconButton
                      disabled={templateBusy}
                      label="Duplicate"
                      title="Duplicate template"
                      onClick={() => {
                        void handleDuplicateTemplate(template)
                      }}
                    >
                      <DuplicateIcon className={panelStyles.icon} />
                    </IconButton>
                    <IconButton
                      disabled={templateBusy}
                      label="Delete"
                      title="Delete template"
                      tone="danger"
                      onClick={() => {
                        void handleDeleteTemplate(template)
                      }}
                    >
                      <DeleteIcon className={panelStyles.icon} />
                    </IconButton>
                  </div>
                </article>
              ))}
            </div>
          )}
        </PanelSection>
      </div>
    </div>
  )
}

function countLabel(count: number, noun: string) {
  return count > 0 ? `${count} ${noun}${count === 1 ? '' : 's'}` : ''
}

export default TemplatesPanel
