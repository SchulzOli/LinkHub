import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

import styles from './OptionsMenu.module.css'

import { getWorkspaceStatisticsSnapshot } from '../../features/analytics/workspaceAnalytics'
import { getActiveThemeCardColorSettings } from '../../features/appearance/cardColorPalette'
import {
  getSelectedCanvasEntityBundle,
  isCanvasEntityBundleEmpty,
} from '../../features/canvas/entityBundle'
import { collectReferencedImageIds } from '../../features/importExport/canvasBundle'
import { collectBundleImageIds } from '../../features/templates/templateLibrary'
import { useAppearanceStore } from '../../state/useAppearanceStore'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'
import { PromptDialog } from '../ui/PromptDialog'
import { isSelectMenuPortalTarget } from '../ui/SelectMenu'
import { OptionsAppearanceSection } from './OptionsAppearanceSection'
import { OptionsMenuHeader } from './options/OptionsMenuHeader'
import type {
  PromptDialogConfig,
  PromptDialogOptions,
} from './options/optionsMenuShared'
import type { MenuTab } from './options/optionsMenuTabs'
import { useCanvasImportExport } from './options/useCanvasImportExport'
import { useOptionsMenuData } from './options/useOptionsMenuData'
import { useWorkspaceDirectoryEditor } from './options/useWorkspaceDirectoryEditor'

const OptionsDataSection = lazy(async () => {
  const module = await import('./OptionsDataSection')

  return { default: module.OptionsDataSection }
})

const StatisticsPanel = lazy(async () => {
  const module = await import('./StatisticsPanel')

  return { default: module.StatisticsPanel }
})

const ThemeGallery = lazy(async () => {
  const module = await import('./ThemeGallery')

  return { default: module.ThemeGallery }
})

const TemplatesPanel = lazy(async () => {
  const module = await import('./options/TemplatesPanel')

  return { default: module.TemplatesPanel }
})

type OptionsMenuProps = {
  cardCount: number
  open: boolean
  onToggle: () => void
  onRequestClose: () => void
}

type PromptDialogState = PromptDialogConfig & {
  onAuxiliaryAction?: () => void
  onDismissAction?: () => void
  onPrimaryAction: () => void
}

export function OptionsMenu({
  cardCount,
  open,
  onToggle,
  onRequestClose,
}: OptionsMenuProps) {
  const [activeTab, setActiveTab] = useState<MenuTab>('options')
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(
    null,
  )
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

  const {
    refreshTemplateCount,
    refreshThemeCount,
    refreshTemplates,
    savedTemplateCount,
    savedThemeCount,
    storageStatistics,
    templates,
  } = useOptionsMenuData({
    activeTab,
    appearance,
    open,
    workspace,
  })

  const { dataStatus, handleExportCanvas, handleImportCanvasFile } =
    useCanvasImportExport({
      hydrateWorkspace,
      importWorkspace,
      openPromptDialog,
      referencedImageIds,
      refreshTemplateCount,
      refreshThemeCount,
      workspace,
    })

  const {
    handleCancelWorkspaceEdit,
    handleDeleteWorkspace,
    handleMoveWorkspace,
    handleStartWorkspaceEdit,
    handleSubmitWorkspaceEditor,
    handleUpdateWorkspaceEditorName,
    resetEditor: resetWorkspaceEditor,
    workspaceEditor,
    workspaceStatus,
  } = useWorkspaceDirectoryEditor({
    activeWorkspaceId,
    deleteWorkspace,
    moveWorkspace,
    openPromptDialog,
    renameWorkspace,
  })

  const handleRequestClose = useCallback(() => {
    setActiveTab('options')
    resetWorkspaceEditor()
    onRequestClose()
  }, [onRequestClose, resetWorkspaceEditor])

  const handleToggle = useCallback(() => {
    if (open) {
      setActiveTab('options')
      resetWorkspaceEditor()
    }

    onToggle()
  }, [onToggle, open, resetWorkspaceEditor])

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
          <OptionsMenuHeader
            activeTab={activeTab}
            menuId={menuId}
            onRequestClose={handleRequestClose}
            onSelectTab={setActiveTab}
            tabListId={tabListId}
          />
          <Suspense fallback={null}>
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
              <TemplatesPanel
                addEntityBundle={addEntityBundle}
                appearance={appearance}
                hasTemplateSelection={hasTemplateSelection}
                interactionMode={interactionMode}
                menuId={menuId}
                onRefreshTemplates={refreshTemplates}
                openPromptDialog={openPromptDialog}
                selectedBundleImageIds={selectedBundleImageIds}
                selectedEntitySelection={selectedEntitySelection}
                setViewport={setViewport}
                tabListId={tabListId}
                templates={templates}
                toggleInteractionMode={toggleInteractionMode}
                viewport={viewport}
                workspace={workspace}
              />
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
                onUpdateWorkspaceEditorName={handleUpdateWorkspaceEditorName}
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
          </Suspense>
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
