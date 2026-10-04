import type { RefObject } from 'react'
import panelStyles from '../ui/panel/Panel.module.css'

import type { WorkspaceSummary } from '../../contracts/workspaceDirectory'
import type { LinkCheckStatus } from './options/useLinkCheck'

import { DeleteIcon } from '../ui/DeleteIcon'
import { EditIcon } from '../ui/EditIcon'
import {
  IconButton,
  PanelSection,
  SettingRow,
  StatusMessage,
} from '../ui/panel/Panel'
import { ChevronLeftIcon, ChevronRightIcon } from '../ui/panel/PanelIcons'
import dataStyles from './OptionsDataSection.module.css'
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
  linkCheckStatus: LinkCheckStatus
  menuId: string
  onCheckLinks: () => void
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
  linkCheckStatus,
  menuId,
  onCancelWorkspaceEditor,
  onCheckLinks,
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
  const isBusy = dataStatus.kind === 'busy'
  const workspaceBusy = workspaceStatus.kind === 'busy'
  const linkCheckMeta =
    linkCheckStatus.kind === 'checking'
      ? 'Checking…'
      : linkCheckStatus.kind === 'done'
        ? `${linkCheckStatus.ok} ok, ${linkCheckStatus.broken} broken`
        : linkCheckStatus.kind === 'error'
          ? 'Error'
          : workspaceEntityCounts.cards === 0
            ? 'No cards'
            : `${workspaceEntityCounts.cards} card${workspaceEntityCounts.cards === 1 ? '' : 's'}`

  return (
    <div
      aria-labelledby={`${tabListId}-data`}
      className={styles.panelBody}
      id={`${menuId}-data`}
      role="tabpanel"
    >
      <div className={panelStyles.stack} data-testid="data-panel">
        <PanelSection
          meta={`${workspaceSummaries.length} workspace${workspaceSummaries.length === 1 ? '' : 's'}`}
          testId="workspace-management-panel"
          title="Manage workspaces"
        >
          {interactionMode === 'edit' ? (
            <div
              className={dataStyles.workspaceList}
              data-testid="workspace-management-list"
            >
              {workspaceSummaries.map((workspaceSummary, index) => {
                const isEditing =
                  workspaceEditor?.workspaceId === workspaceSummary.id
                const isCurrentWorkspace =
                  workspaceSummary.id === activeWorkspaceId

                return (
                  <article
                    className={dataStyles.workspaceRow}
                    data-current={isCurrentWorkspace}
                    data-testid={`workspace-management-row-${workspaceSummary.id}`}
                    key={workspaceSummary.id}
                  >
                    {isEditing ? (
                      <>
                        <input
                          aria-label="Workspace name"
                          autoFocus
                          className={dataStyles.workspaceNameInput}
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
                        <div className={panelStyles.actions}>
                          <button
                            className={`${panelStyles.button} ${panelStyles.buttonPrimary}`}
                            data-testid="workspace-editor-save"
                            disabled={workspaceBusy}
                            onClick={onSubmitWorkspaceEditor}
                            type="button"
                          >
                            Save workspace
                          </button>
                          <button
                            className={`${panelStyles.button} ${panelStyles.buttonQuiet}`}
                            data-testid="workspace-editor-cancel"
                            disabled={workspaceBusy}
                            onClick={onCancelWorkspaceEditor}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className={dataStyles.workspaceIndex}>
                          {index + 1}
                        </span>
                        <div className={panelStyles.rowText}>
                          <strong className={panelStyles.rowLabel}>
                            {workspaceSummary.name}
                          </strong>
                          <span className={panelStyles.rowHint}>
                            {isCurrentWorkspace
                              ? 'Current workspace'
                              : 'Workspace'}
                            {' • '}Position {index + 1} of{' '}
                            {workspaceSummaries.length}
                          </span>
                        </div>
                        <div className={panelStyles.iconActions}>
                          <IconButton
                            data-testid={`workspace-move-left-${workspaceSummary.id}`}
                            disabled={index === 0 || workspaceBusy}
                            label="Move left"
                            title="Move workspace earlier"
                            onClick={() =>
                              onMoveWorkspace(workspaceSummary.id, -1)
                            }
                          >
                            <ChevronLeftIcon className={panelStyles.icon} />
                          </IconButton>
                          <IconButton
                            data-testid={`workspace-move-right-${workspaceSummary.id}`}
                            disabled={
                              index === workspaceSummaries.length - 1 ||
                              workspaceBusy
                            }
                            label="Move right"
                            title="Move workspace later"
                            onClick={() =>
                              onMoveWorkspace(workspaceSummary.id, 1)
                            }
                          >
                            <ChevronRightIcon className={panelStyles.icon} />
                          </IconButton>
                          <IconButton
                            data-testid={`workspace-edit-${workspaceSummary.id}`}
                            disabled={workspaceBusy}
                            label="Edit"
                            title="Edit workspace name"
                            onClick={() =>
                              onStartWorkspaceEdit(workspaceSummary)
                            }
                          >
                            <EditIcon className={panelStyles.icon} />
                          </IconButton>
                          <IconButton
                            data-testid={`workspace-delete-${workspaceSummary.id}`}
                            disabled={
                              workspaceSummaries.length === 1 || workspaceBusy
                            }
                            label="Delete"
                            title="Delete workspace"
                            tone="danger"
                            onClick={() => onDeleteWorkspace(workspaceSummary)}
                          >
                            <DeleteIcon className={panelStyles.icon} />
                          </IconButton>
                        </div>
                      </>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            <SettingRow
              hint="Renaming, ordering and deleting workspaces needs edit mode."
              label="Workspace management is available in edit mode only."
            >
              <button
                className={`${panelStyles.button} ${panelStyles.buttonPrimary}`}
                data-testid="workspace-enable-edit-mode"
                onClick={onRequestEditMode}
                type="button"
              >
                Switch to edit mode
              </button>
            </SettingRow>
          )}
        </PanelSection>
        {workspaceStatus.message ? (
          <StatusMessage kind={workspaceStatus.kind} testId="workspace-status">
            {workspaceStatus.message}
          </StatusMessage>
        ) : null}

        <PanelSection title="Backup">
          <SettingRow
            hint={
              <>
                ZIP with this workspace, the image gallery, all templates and
                custom themes.
                <span className={`${panelStyles.chips} ${dataStyles.chips}`}>
                  <span className={panelStyles.chip}>
                    Cards: {workspaceEntityCounts.cards}
                  </span>
                  <span className={panelStyles.chip}>
                    Groups: {workspaceEntityCounts.groups}
                  </span>
                  <span className={panelStyles.chip}>
                    Pictures: {workspaceEntityCounts.pictures}
                  </span>
                  <span className={panelStyles.chip}>
                    Referenced images: {referencedImageCount}
                  </span>
                  <span className={panelStyles.chip}>
                    Saved templates: {savedTemplateCount}
                  </span>
                  <span className={panelStyles.chip}>
                    Saved themes: {savedThemeCount}
                  </span>
                </span>
              </>
            }
            label="Export current canvas"
          >
            <button
              className={`${panelStyles.button} ${panelStyles.buttonPrimary}`}
              data-testid="export-canvas-bundle"
              disabled={isBusy}
              onClick={() => {
                void handleExportCanvas()
              }}
              type="button"
            >
              Export canvas bundle
            </button>
          </SettingRow>
          <SettingRow
            hint="Create a new workspace from a bundle or replace the current one. Images, templates and themes are merged; nothing else in the libraries is removed."
            label="Import canvas bundle"
          >
            <input
              ref={importFileInputRef}
              accept=".zip,.linkhub.zip,application/zip"
              className={panelStyles.hiddenInput}
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
            <button
              className={panelStyles.button}
              data-testid="import-canvas-bundle"
              disabled={isBusy}
              onClick={() => importFileInputRef.current?.click()}
              type="button"
            >
              Import canvas bundle
            </button>
          </SettingRow>
        </PanelSection>

        <PanelSection meta={linkCheckMeta} title="Maintenance">
          <SettingRow
            hint="Sends a HEAD request to every link card. Cards that don't answer within 5 seconds get a yellow badge until the tab is closed."
            label="Check Links"
          >
            <button
              className={panelStyles.button}
              data-testid="check-links"
              disabled={
                linkCheckStatus.kind === 'checking' ||
                workspaceEntityCounts.cards === 0
              }
              onClick={onCheckLinks}
              type="button"
            >
              {linkCheckStatus.kind === 'checking'
                ? `Checking ${linkCheckStatus.current}/${linkCheckStatus.total}…`
                : 'Check Links'}
            </button>
          </SettingRow>
        </PanelSection>

        {dataStatus.message ? (
          <StatusMessage kind={dataStatus.kind} testId="data-status">
            {dataStatus.message}
          </StatusMessage>
        ) : null}
      </div>
    </div>
  )
}
