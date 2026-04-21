import styles from './BottomTaskbar.module.css'

import { useEffect, useId, useRef } from 'react'

import type { WorkspaceSummary } from '../../contracts/workspaceDirectory'
import type { InteractionMode } from '../../state/useWorkspaceStore'
import { EditIcon } from '../ui/EditIcon'
import type { MenuTab } from './options/optionsMenuTabs'
import { OptionsMenu } from './OptionsMenu'
import { QuickAddAction } from './QuickAddAction'

type BottomTaskbarProps = {
  activeWorkspaceId: string
  cardCount: number
  interactionMode: InteractionMode
  quickAddOpen: boolean
  optionsMenuOpen: boolean
  optionsMenuInitialTab?: MenuTab
  onCreateGroup: () => void
  onCreateWorkspace: () => void
  onSelectWorkspace: (workspaceId: string) => void
  onToggleInteractionMode: () => void
  onToggleQuickAdd: () => void
  onToggleOptionsMenu: () => void
  onToggleWorkspaceRail: (value?: boolean) => void
  onToggleWorkspaceRailPinned: () => void
  onCloseOptionsMenu: () => void
  onSubmitQuickAdd: (url: string, title: string) => void
  onOpenImageGallery: () => void
  onUploadImage: (file: File) => void
  workspaceRailOpen: boolean
  workspaceRailPinned: boolean
  workspaceSummaries: WorkspaceSummary[]
}

export function BottomTaskbar({
  activeWorkspaceId,
  cardCount,
  interactionMode,
  quickAddOpen,
  optionsMenuOpen,
  optionsMenuInitialTab,
  onCreateGroup,
  onCreateWorkspace,
  onToggleInteractionMode,
  onToggleQuickAdd,
  onToggleOptionsMenu,
  onToggleWorkspaceRail,
  onToggleWorkspaceRailPinned,
  onCloseOptionsMenu,
  onSelectWorkspace,
  onSubmitQuickAdd,
  onOpenImageGallery,
  onUploadImage,
  workspaceRailOpen,
  workspaceRailPinned,
  workspaceSummaries,
}: BottomTaskbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const workspaceRailRef = useRef<HTMLDivElement | null>(null)
  const workspaceRailToggleRef = useRef<HTMLButtonElement | null>(null)
  const workspaceRailId = useId()

  useEffect(() => {
    if (!workspaceRailOpen || workspaceRailPinned) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null

      if (
        workspaceRailRef.current?.contains(target) ||
        workspaceRailToggleRef.current?.contains(target)
      ) {
        return
      }

      onToggleWorkspaceRail(false)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [onToggleWorkspaceRail, workspaceRailOpen, workspaceRailPinned])

  const showQuickAddCompanionActions = !quickAddOpen

  return (
    <div className={styles.taskbarStack}>
      <div
        className={`${styles.workspaceRail} ${
          workspaceRailOpen
            ? styles.workspaceRailOpen
            : styles.workspaceRailClosed
        }`}
        data-open={workspaceRailOpen}
        data-pinned={workspaceRailPinned}
        data-testid="workspace-rail"
        id={workspaceRailId}
        ref={workspaceRailRef}
      >
        <button
          aria-label="New workspace"
          className={styles.workspaceRailAction}
          data-testid="create-workspace"
          onClick={onCreateWorkspace}
          title="New workspace"
          type="button"
        >
          <span aria-hidden="true" className={styles.modeIcon}>
            <svg
              viewBox="0 0 24 24"
              focusable="false"
              className={styles.modeSvg}
            >
              <path
                d="M12 4.25a.75.75 0 0 1 .75.75v6.25H19a.75.75 0 0 1 0 1.5h-6.25V19a.75.75 0 0 1-1.5 0v-6.25H5a.75.75 0 0 1 0-1.5h6.25V5a.75.75 0 0 1 .75-.75Z"
                fill="currentColor"
              />
            </svg>
          </span>
        </button>
        <div
          aria-label="Workspaces"
          className={styles.workspaceTabs}
          role="tablist"
        >
          {workspaceSummaries.map((workspaceSummary) => (
            <button
              key={workspaceSummary.id}
              aria-selected={workspaceSummary.id === activeWorkspaceId}
              className={`${styles.workspaceTab} ${
                workspaceSummary.id === activeWorkspaceId
                  ? styles.workspaceTabActive
                  : ''
              }`}
              data-testid={`workspace-tab-${workspaceSummary.id}`}
              onClick={() => onSelectWorkspace(workspaceSummary.id)}
              role="tab"
              title={workspaceSummary.name}
              type="button"
            >
              {workspaceSummary.name}
            </button>
          ))}
        </div>
        <button
          aria-label={
            workspaceRailPinned
              ? 'Workspace rail stays open'
              : 'Workspace rail closes automatically'
          }
          aria-pressed={workspaceRailPinned}
          className={`${styles.workspaceRailAction} ${styles.workspaceRailPin} ${
            workspaceRailPinned
              ? styles.workspaceRailPinActive
              : styles.workspaceRailPinInactive
          }`}
          data-state={workspaceRailPinned ? 'pinned' : 'auto-hide'}
          data-testid="workspace-rail-pin"
          onClick={onToggleWorkspaceRailPinned}
          title={workspaceRailPinned ? 'Stays open' : 'Closes on outside click'}
          type="button"
        >
          <span aria-hidden="true" className={styles.modeIcon}>
            <svg
              viewBox="0 0 24 24"
              focusable="false"
              className={styles.modeSvg}
            >
              <path
                d="M9.15 5.25h5.7c.78 0 1.19.91.68 1.5l-1.67 1.94v2.1l1.9 1.1c.5.29.3 1.06-.28 1.06H8.52c-.58 0-.78-.77-.28-1.06l1.9-1.1v-2.1L8.47 6.75c-.51-.59-.1-1.5.68-1.5Z"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.65"
              />
              <path
                d="M12 12.95v5.12"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.65"
              />
              <path
                d="M11.25 18.65 12 20.7l.75-2.05"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.65"
              />
            </svg>
          </span>
        </button>
      </div>
      <footer className={styles.taskbar} data-testid="bottom-taskbar">
        <button
          aria-controls={workspaceRailId}
          aria-expanded={workspaceRailOpen}
          aria-label={
            workspaceRailOpen
              ? 'Collapse workspace rail'
              : 'Expand workspace rail'
          }
          className={`${styles.workspaceRailToggle} ${
            workspaceRailOpen ? styles.workspaceRailToggleOpen : ''
          }`}
          data-testid="workspace-rail-toggle"
          onClick={() => onToggleWorkspaceRail()}
          ref={workspaceRailToggleRef}
          type="button"
        >
          <svg viewBox="0 0 24 24" focusable="false" className={styles.modeSvg}>
            <path
              d="M6.47 14.28a.75.75 0 0 1 1.06-.06L12 18.09l4.47-3.87a.75.75 0 0 1 .98 1.14l-4.96 4.29a.75.75 0 0 1-.98 0l-4.98-4.31a.75.75 0 0 1-.06-1.06Z"
              fill="currentColor"
            />
          </svg>
        </button>
        <div className={`${styles.cluster} ${styles.mainCluster}`}>
          <QuickAddAction
            open={quickAddOpen}
            onToggle={onToggleQuickAdd}
            onSubmit={onSubmitQuickAdd}
          />
          <input
            ref={fileInputRef}
            accept="image/*"
            className={styles.hiddenInput}
            type="file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]

              event.currentTarget.value = ''

              if (!file) {
                return
              }

              onUploadImage(file)
            }}
          />
          {showQuickAddCompanionActions ? (
            <>
              <button
                aria-label="Add group"
                className={styles.modeButton}
                onClick={onCreateGroup}
                title="Add group"
                type="button"
              >
                <span aria-hidden="true" className={styles.modeIcon}>
                  <svg
                    viewBox="0 0 24 24"
                    focusable="false"
                    className={`${styles.modeSvg} ${styles.modeSvgLarge}`}
                  >
                    <path
                      d="M6.1 3.35a.85.85 0 0 1 .85.85V6.2h2a.85.85 0 1 1 0 1.7h-2v2a.85.85 0 1 1-1.7 0v-2h-2a.85.85 0 1 1 0-1.7h2V4.2a.85.85 0 0 1 .85-.85Z"
                      fill="currentColor"
                    />
                    <rect
                      x="10.25"
                      y="7.1"
                      width="8"
                      height="6.2"
                      rx="1.35"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <rect
                      x="7.75"
                      y="10.7"
                      width="8"
                      height="6.2"
                      rx="1.35"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                </span>
              </button>
              <button
                aria-label="Upload image"
                className={styles.modeButton}
                onClick={() => fileInputRef.current?.click()}
                title="Upload image"
                type="button"
              >
                <span aria-hidden="true" className={styles.modeIcon}>
                  <svg
                    viewBox="0 0 24 24"
                    focusable="false"
                    className={`${styles.modeSvg} ${styles.modeSvgLarge}`}
                  >
                    <rect
                      x="6.9"
                      y="8.1"
                      width="10.2"
                      height="8.3"
                      rx="1.45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <circle cx="10.15" cy="10.7" r=".95" fill="currentColor" />
                    <path
                      d="M8.9 14.25 11.35 11.8l1.85 1.85 1.65-1.65 1.35 1.35"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M12 3.9v4.7"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.6"
                    />
                    <path
                      d="m9.95 6.1 2.05-2.05 2.05 2.05"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.6"
                    />
                  </svg>
                </span>
              </button>
              <button
                aria-label="Open image gallery"
                className={styles.modeButton}
                onClick={onOpenImageGallery}
                title="Open image gallery"
                type="button"
              >
                <span aria-hidden="true" className={styles.modeIcon}>
                  <svg
                    viewBox="0 0 24 24"
                    focusable="false"
                    className={styles.modeSvg}
                  >
                    <path
                      d="M4.75 5.5A1.75 1.75 0 0 1 6.5 3.75h11A1.75 1.75 0 0 1 19.25 5.5v13A1.75 1.75 0 0 1 17.5 20.25h-11A1.75 1.75 0 0 1 4.75 18.5v-13Zm1.5 0v13c0 .14.11.25.25.25h11a.25.25 0 0 0 .25-.25v-13a.25.25 0 0 0-.25-.25h-11a.25.25 0 0 0-.25.25Zm2 2a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Zm0 3.5A.75.75 0 0 1 9 10.25h6a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Zm0 3.5A.75.75 0 0 1 9 13.75h3a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
              </button>
            </>
          ) : null}
        </div>
        <div className={`${styles.cluster} ${styles.rightCluster}`}>
          <button
            aria-label="Toggle interaction mode"
            aria-pressed={interactionMode === 'edit'}
            title={interactionMode === 'edit' ? 'Bearbeiten' : 'Ansehen'}
            className={
              interactionMode === 'edit'
                ? `${styles.modeButton} ${styles.modeButtonEdit}`
                : `${styles.modeButton} ${styles.modeButtonView}`
            }
            onClick={onToggleInteractionMode}
            type="button"
          >
            <span aria-hidden="true" className={styles.modeIcon}>
              {interactionMode === 'edit' ? (
                <EditIcon className={styles.modeSvg} />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  focusable="false"
                  className={styles.modeSvg}
                >
                  <path
                    d="M12 5c-5.5 0-9.5 5.19-10.63 6.83a.8.8 0 0 0 0 .9C2.5 14.37 6.5 19.56 12 19.56s9.5-5.19 10.63-6.83a.8.8 0 0 0 0-.9C21.5 10.19 17.5 5 12 5Zm0 12.56c-4.27 0-7.58-3.88-8.97-5.28C4.42 10.88 7.73 7 12 7s7.58 3.88 8.97 5.28C19.58 13.68 16.27 17.56 12 17.56Zm0-8.81A3.53 3.53 0 1 0 15.53 12 3.54 3.54 0 0 0 12 8.75Zm0 5.06A1.53 1.53 0 1 1 13.53 12 1.53 1.53 0 0 1 12 13.81Z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </span>
          </button>
          <OptionsMenu
            cardCount={cardCount}
            open={optionsMenuOpen}
            initialTab={optionsMenuInitialTab}
            onRequestClose={onCloseOptionsMenu}
            onToggle={onToggleOptionsMenu}
          />
        </div>
      </footer>
    </div>
  )
}
