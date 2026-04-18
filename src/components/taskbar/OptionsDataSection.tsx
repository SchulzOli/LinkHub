import type { WorkspaceSummary } from '../../contracts/workspaceDirectory'

import type { RefObject } from 'react'

import styles from './OptionsMenu.module.css'

type DataStatus = {
  kind: 'busy' | 'error' | 'idle' | 'success'
  message: string
}

type OptionsDataSectionProps = {
  dataStatus: DataStatus
  handleExportCanvas: () => Promise<void>
  handleImportCanvasFile: (file: File) => Promise<void>
  importFileInputRef: RefObject<HTMLInputElement | null>
  interactionMode: 'edit' | 'view'
  menuId: string
  onDeleteWorkspace: (workspace: WorkspaceSummary) => void
  onMoveWorkspace: (workspaceId: string, direction: -1 | 1) => void
  onRequestEditMode: () => void
  onStartWorkspaceEdit: (workspace: WorkspaceSummary) => void
  onSubmitWorkspaceEditor: () => void
  onUpdateWorkspaceEditorName: (name: string) => void
  onCancelWorkspaceEditor: () => void
  referencedImageCount: number
  savedThemeCount: number
  savedTemplateCount: number
  tabListId: string
  activeWorkspaceId: string
  workspaceEditor: {
    name: string
    workspaceId: string
  } | null
  workspaceEntityCounts: {
    cards: number
    groups: number
    pictures: number
  }
  workspaceStatus: DataStatus
  workspaceSummaries: WorkspaceSummary[]
}

export function OptionsDataSection({
  activeWorkspaceId,
  dataStatus,
  handleExportCanvas,
  handleImportCanvasFile,
  importFileInputRef,
  interactionMode,
  menuId,
  onCancelWorkspaceEditor,
  onDeleteWorkspace,
  onMoveWorkspace,
  onRequestEditMode,
  onStartWorkspaceEdit,
  onSubmitWorkspaceEditor,
  onUpdateWorkspaceEditorName,
  referencedImageCount,
  savedThemeCount,
  savedTemplateCount,
  tabListId,
  workspaceEditor,
  workspaceEntityCounts,
  workspaceStatus,
  workspaceSummaries,
}: OptionsDataSectionProps) {
  return (
    <div
      aria-labelledby={`${tabListId}-data`}
      className={styles.panelBody}
      id={`${menuId}-data`}
      role="tabpanel"
    >
      <div className={styles.dataGrid} data-testid="data-panel">
        <section className={`${styles.dataCard} ${styles.dataTransportCard}`}>
          <div
            className={`${styles.sectionHeader} ${styles.dataTransportHeader}`}
          >
            <h4 className={styles.sectionTitle}>Export current canvas</h4>
            <span className={styles.sectionMeta}>
              {referencedImageCount} referenced image
              {referencedImageCount === 1 ? '' : 's'}
            </span>
          </div>
          <p className={`${styles.fieldHint} ${styles.dataTransportHint}`}>
            Creates a ZIP bundle with the current workspace JSON, the whole
            local image gallery, and all saved templates with their copied image
            files, plus every saved custom theme.
          </p>
          <div
            className={`${styles.dataMetrics} ${styles.dataTransportMetrics}`}
          >
            <div className={styles.dataMetricRow}>
              <span className={styles.dataMetric}>
                Cards: {workspaceEntityCounts.cards}
              </span>
              <span className={styles.dataMetric}>
                Groups: {workspaceEntityCounts.groups}
              </span>
              <span className={styles.dataMetric}>
                Pictures: {workspaceEntityCounts.pictures}
              </span>
            </div>
            <div className={styles.dataMetricRow}>
              <span className={styles.dataMetric}>
                Referenced images: {referencedImageCount}
              </span>
              <span className={styles.dataMetric}>
                Saved templates: {savedTemplateCount}
              </span>
              <span className={styles.dataMetric}>
                Saved themes: {savedThemeCount}
              </span>
            </div>
          </div>
          <div
            className={`${styles.dataActions} ${styles.dataTransportActions}`}
          >
            <button
              className={`${styles.dataPrimaryButton} ${styles.dataTransportPrimaryButton}`}
              data-testid="export-canvas-bundle"
              disabled={dataStatus.kind === 'busy'}
              onClick={() => {
                void handleExportCanvas()
              }}
              type="button"
            >
              Export canvas bundle
            </button>
          </div>
        </section>

        <section className={`${styles.dataCard} ${styles.dataTransportCard}`}>
          <div
            className={`${styles.sectionHeader} ${styles.dataTransportHeader}`}
          >
            <h4 className={styles.sectionTitle}>Import canvas bundle</h4>
            <span className={styles.sectionMeta}>New or replace</span>
          </div>
          <p className={`${styles.fieldHint} ${styles.dataTransportHint}`}>
            Imports a previously exported ZIP bundle and lets you either create
            a new workspace from it or replace the current canvas while
            restoring bundled images into the local image library and merging
            bundled templates and custom themes back into the local libraries.
          </p>
          <input
            ref={importFileInputRef}
            accept=".zip,.linkhub.zip,application/zip"
            className={styles.hiddenInput}
            data-testid="canvas-import-input"
            type="file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]

              event.currentTarget.value = ''

              if (!file) {
                return
              }

              void handleImportCanvasFile(file)
            }}
          />
          <div
            className={`${styles.dataActions} ${styles.dataTransportActions}`}
          >
            <button
              className={`${styles.dataPrimaryButton} ${styles.dataTransportPrimaryButton}`}
              data-testid="import-canvas-bundle"
              disabled={dataStatus.kind === 'busy'}
              onClick={() => importFileInputRef.current?.click()}
              type="button"
            >
              Import canvas bundle
            </button>
          </div>
          <p className={`${styles.dataWarning} ${styles.dataTransportWarning}`}>
            Replacing overwrites only the current workspace. Importing as a new
            workspace keeps the current workspace unchanged. Existing app-wide
            gallery images, templates, and themes that are not part of the
            imported bundle are kept in both modes.
          </p>
        </section>

        <section
          className={styles.dataCard}
          data-testid="workspace-management-panel"
        >
          <div className={styles.sectionHeader}>
            <h4 className={styles.sectionTitle}>Manage workspaces</h4>
            <span className={styles.sectionMeta}>
              {workspaceSummaries.length} workspace
              {workspaceSummaries.length === 1 ? '' : 's'}
            </span>
          </div>
          {interactionMode === 'edit' ? (
            <>
              <p className={styles.fieldHint}>
                Rename workspaces, remove unused ones, or move them earlier and
                later in the rail.
              </p>
              <div
                className={styles.templateList}
                data-testid="workspace-management-list"
              >
                {workspaceSummaries.map((workspaceSummary, index) => {
                  const isEditing =
                    workspaceEditor?.workspaceId === workspaceSummary.id
                  const isCurrentWorkspace =
                    workspaceSummary.id === activeWorkspaceId

                  return (
                    <article
                      key={workspaceSummary.id}
                      className={styles.templateListItem}
                      data-testid={`workspace-management-row-${workspaceSummary.id}`}
                    >
                      <div className={styles.templateContent}>
                        {isEditing ? (
                          <>
                            <div className={styles.templateHeader}>
                              <div className={styles.field}>
                                <span className={styles.fieldLabel}>
                                  Workspace name
                                </span>
                                <input
                                  autoFocus
                                  data-testid="workspace-editor-name"
                                  type="text"
                                  value={workspaceEditor.name}
                                  onChange={(event) => {
                                    onUpdateWorkspaceEditorName(
                                      event.currentTarget.value,
                                    )
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault()
                                      onSubmitWorkspaceEditor()
                                    }

                                    if (event.key === 'Escape') {
                                      event.preventDefault()
                                      onCancelWorkspaceEditor()
                                    }
                                  }}
                                />
                              </div>
                            </div>
                            <div className={styles.dataActions}>
                              <button
                                className={styles.dataPrimaryButton}
                                data-testid="workspace-editor-save"
                                disabled={workspaceStatus.kind === 'busy'}
                                onClick={onSubmitWorkspaceEditor}
                                type="button"
                              >
                                Save workspace
                              </button>
                              <button
                                data-testid="workspace-editor-cancel"
                                disabled={workspaceStatus.kind === 'busy'}
                                onClick={onCancelWorkspaceEditor}
                                type="button"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={styles.templateHeader}>
                              <div className={styles.templateText}>
                                <strong className={styles.sectionTitle}>
                                  {workspaceSummary.name}
                                </strong>
                                <p className={styles.templateMeta}>
                                  {isCurrentWorkspace
                                    ? 'Current workspace'
                                    : 'Workspace'}
                                  {' • '}Position {index + 1} of{' '}
                                  {workspaceSummaries.length}
                                </p>
                              </div>
                            </div>
                            <div className={styles.templateActions}>
                              <button
                                aria-label="Move left"
                                className={styles.templateActionButton}
                                data-testid={`workspace-move-left-${workspaceSummary.id}`}
                                disabled={
                                  index === 0 || workspaceStatus.kind === 'busy'
                                }
                                onClick={() =>
                                  onMoveWorkspace(workspaceSummary.id, -1)
                                }
                                title="Move workspace earlier"
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
                                      d="M14.28 6.47a.75.75 0 0 1 .06 1.06L10.47 12l3.87 4.47a.75.75 0 0 1-1.14.98l-4.29-4.96a.75.75 0 0 1 0-.98l4.31-4.98a.75.75 0 0 1 1.06-.06Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </span>
                              </button>
                              <button
                                aria-label="Move right"
                                className={styles.templateActionButton}
                                data-testid={`workspace-move-right-${workspaceSummary.id}`}
                                disabled={
                                  index === workspaceSummaries.length - 1 ||
                                  workspaceStatus.kind === 'busy'
                                }
                                onClick={() =>
                                  onMoveWorkspace(workspaceSummary.id, 1)
                                }
                                title="Move workspace later"
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
                                      d="M9.72 6.47a.75.75 0 0 0-.06 1.06L13.53 12l-3.87 4.47a.75.75 0 1 0 1.14.98l4.29-4.96a.75.75 0 0 0 0-.98L10.78 6.53a.75.75 0 0 0-1.06-.06Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </span>
                              </button>
                              <button
                                aria-label="Edit"
                                className={styles.templateActionButton}
                                data-testid={`workspace-edit-${workspaceSummary.id}`}
                                disabled={workspaceStatus.kind === 'busy'}
                                onClick={() =>
                                  onStartWorkspaceEdit(workspaceSummary)
                                }
                                title="Edit workspace name"
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
                                      d="M4 17.25V20h2.75L16.1 10.65l-2.75-2.75L4 17.25Zm10.98-10.92 1.94 1.94 1.06-1.06a1.5 1.5 0 0 0 0-2.12l-.82-.82a1.5 1.5 0 0 0-2.12 0l-1.06 1.06Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </span>
                              </button>
                              <button
                                aria-label="Delete"
                                className={`${styles.templateActionButton} ${styles.templateActionButtonDanger}`}
                                data-testid={`workspace-delete-${workspaceSummary.id}`}
                                disabled={
                                  workspaceSummaries.length === 1 ||
                                  workspaceStatus.kind === 'busy'
                                }
                                onClick={() =>
                                  onDeleteWorkspace(workspaceSummary)
                                }
                                title="Delete workspace"
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
                          </>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
              {workspaceStatus.message ? (
                <section
                  className={`${styles.dataStatus} ${
                    workspaceStatus.kind === 'error'
                      ? styles.dataStatusError
                      : workspaceStatus.kind === 'success'
                        ? styles.dataStatusSuccess
                        : workspaceStatus.kind === 'busy'
                          ? styles.dataStatusBusy
                          : ''
                  }`}
                  data-testid="workspace-status"
                >
                  {workspaceStatus.message}
                </section>
              ) : null}
            </>
          ) : (
            <>
              <p className={styles.fieldHint}>
                Workspace management is available in edit mode only.
              </p>
              <div className={styles.dataActions}>
                <button
                  className={styles.dataPrimaryButton}
                  data-testid="workspace-enable-edit-mode"
                  onClick={onRequestEditMode}
                  type="button"
                >
                  Switch to edit mode
                </button>
              </div>
            </>
          )}
        </section>

        {dataStatus.message ? (
          <section
            className={`${styles.dataStatus} ${
              dataStatus.kind === 'error'
                ? styles.dataStatusError
                : dataStatus.kind === 'success'
                  ? styles.dataStatusSuccess
                  : dataStatus.kind === 'busy'
                    ? styles.dataStatusBusy
                    : ''
            }`}
            data-testid="data-status"
          >
            {dataStatus.message}
          </section>
        ) : null}
      </div>
    </div>
  )
}
