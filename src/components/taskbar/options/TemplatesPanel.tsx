import { useCallback, useEffect, useState } from 'react'

import styles from '../OptionsMenu.module.css'

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
import { EditIcon } from '../../ui/EditIcon'
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

  return (
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
              {hasTemplateSelection ? 'Ready to save' : 'Nothing selected'}
            </span>
          </div>
          <p className={`${styles.fieldHint} ${styles.templateSelectionHint}`}>
            Save the current card, group and picture selection as a reusable
            local template.
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
              disabled={!hasTemplateSelection || templateStatus.kind === 'busy'}
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
            <span className={styles.sectionMeta}>{templates.length} total</span>
          </div>
          {templates.length === 0 ? (
            <p className={styles.emptyState}>
              No templates yet. Select content on the canvas and save the first
              one.
            </p>
          ) : (
            <div className={styles.templateList}>
              {templates.map((template) => (
                <article className={styles.templateListItem} key={template.id}>
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
                        <span className={styles.templatePreviewFallbackLabel}>
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
                          <EditIcon className={styles.templateActionSvg} />
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
  )
}

export default TemplatesPanel
