import { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getImageUsageSummary } from '../../features/images/imageUsage'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'
import { saveImageAsset } from '../../storage/imageRepository'
import { EmptyCanvasGuide } from '../onboarding/EmptyCanvasGuide'
import { BottomTaskbar } from '../taskbar/BottomTaskbar'
import { WorkspaceHelpDock } from '../taskbar/WorkspaceHelpDock'
import { PromptDialog } from '../ui/PromptDialog'
import {
  CanvasActionsProvider,
  type CanvasDragPreview,
} from './CanvasActionsContext'
import { CanvasPasteLayer } from './CanvasPasteLayer'
import { useCanvasActions } from './hooks/useCanvasActions'
import { useCanvasClipboard } from './hooks/useCanvasClipboard'
import { useImageGalleryManager } from './hooks/useImageGalleryManager'
import { usePromptDialogManager } from './hooks/usePromptDialogManager'
import { InfiniteCanvas } from './InfiniteCanvas'

const ImageGalleryDialog = lazy(async () => {
  const module = await import('../images/ImageGalleryDialog')

  return {
    default: module.ImageGalleryDialog,
  }
})

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function WorkspaceScreen() {
  const [dragPreview, setDragPreview] = useState<CanvasDragPreview | null>(null)
  const {
    dismissPromptDialog,
    openPromptDialog,
    promptDialog,
    showPromptNotice,
  } = usePromptDialogManager()
  const {
    activeWorkspaceId,
    autoEditTarget,
    interactionMode,
    optionsMenuOpen,
    quickAddOpen,
    selectedCardIds,
    selectedGroupIds,
    selectedPictureIds,
    status,
    workspace,
    workspaceRailOpen,
    workspaceRailPinned,
    workspaceSummaries,
  } = useWorkspaceStore(
    useShallow((state) => ({
      activeWorkspaceId: state.activeWorkspaceId,
      autoEditTarget: state.autoEditTarget,
      interactionMode: state.interactionMode,
      optionsMenuOpen: state.optionsMenuOpen,
      quickAddOpen: state.quickAddOpen,
      selectedCardIds: state.selectedCardIds,
      selectedGroupIds: state.selectedGroupIds,
      selectedPictureIds: state.selectedPictureIds,
      status: state.status,
      workspace: state.workspace,
      workspaceRailOpen: state.workspaceRailOpen,
      workspaceRailPinned: state.workspaceRailPinned,
      workspaceSummaries: state.workspaceSummaries,
    })),
  )
  const { workspaceCards, workspaceGroups, workspacePictures } =
    useWorkspaceStore(
      useShallow((state) => ({
        workspaceCards: state.workspace.cards,
        workspaceGroups: state.workspace.groups,
        workspacePictures: state.workspace.pictures,
      })),
    )
  const {
    addCard,
    addGroup,
    addGroupsAndCards,
    addPicture,
    clearAutoEditTarget,
    clearSelection,
    moveCard,
    moveGroup,
    movePicture,
    removeCard,
    removeGroup,
    removePicture,
    removePictures,
    recordLinkOpen,
    removeSelection,
    createWorkspace,
    selectCardExclusive,
    selectGroupExclusive,
    selectPictureExclusive,
    setSelection,
    setAutoEditTarget,
    setViewport,
    switchWorkspace,
    toggleCardSelection,
    toggleGroupSelection,
    toggleInteractionMode,
    toggleOptionsMenu,
    togglePictureSelection,
    toggleQuickAdd,
    toggleWorkspaceRail,
    toggleWorkspaceRailPinned,
    undoWorkspace,
    updateCard,
    updateCards,
    updateGroup,
    updatePicture,
    updatePictures,
  } = useWorkspaceStore(
    useShallow((state) => ({
      addCard: state.addCard,
      addGroup: state.addGroup,
      addGroupsAndCards: state.addGroupsAndCards,
      addPicture: state.addPicture,
      clearAutoEditTarget: state.clearAutoEditTarget,
      clearSelection: state.clearSelection,
      createWorkspace: state.createWorkspace,
      moveCard: state.moveCard,
      moveGroup: state.moveGroup,
      movePicture: state.movePicture,
      removeCard: state.removeCard,
      removeGroup: state.removeGroup,
      removePicture: state.removePicture,
      removePictures: state.removePictures,
      recordLinkOpen: state.recordLinkOpen,
      removeSelection: state.removeSelection,
      selectCardExclusive: state.selectCardExclusive,
      selectGroupExclusive: state.selectGroupExclusive,
      selectPictureExclusive: state.selectPictureExclusive,
      setSelection: state.setSelection,
      setAutoEditTarget: state.setAutoEditTarget,
      setViewport: state.setViewport,
      switchWorkspace: state.switchWorkspace,
      toggleCardSelection: state.toggleCardSelection,
      toggleGroupSelection: state.toggleGroupSelection,
      toggleInteractionMode: state.toggleInteractionMode,
      toggleOptionsMenu: state.toggleOptionsMenu,
      togglePictureSelection: state.togglePictureSelection,
      toggleQuickAdd: state.toggleQuickAdd,
      toggleWorkspaceRail: state.toggleWorkspaceRail,
      toggleWorkspaceRailPinned: state.toggleWorkspaceRailPinned,
      undoWorkspace: state.undoWorkspace,
      updateCard: state.updateCard,
      updateCards: state.updateCards,
      updateGroup: state.updateGroup,
      updatePicture: state.updatePicture,
      updatePictures: state.updatePictures,
    })),
  )
  const showImageNotice = useCallback(
    (title: string, description: string) => {
      showPromptNotice({
        description,
        eyebrow: 'Image Library',
        title,
      })
    },
    [showPromptNotice],
  )

  const {
    canPlaceCardFrames,
    canPlaceGroupFrames,
    createAtViewportCenter,
    createGroupAtViewportCenter,
    handleMoveCard,
    handleMoveGroup,
    handleMovePicture,
    handleUpdateCard,
    handleUpdateGroup,
    handleUpdatePicture,
    placePictureAssetAtViewportCenter,
    placePictureAssetsAtCanvasPoint,
  } = useCanvasActions({
    addCard,
    addGroup,
    addPicture,
    interactionMode,
    moveCard,
    moveGroup,
    movePicture,
    selectedCardIds,
    selectedPictureIds,
    setAutoEditTarget,
    toggleInteractionMode,
    toggleQuickAdd,
    updateCard,
    updateCards,
    updateGroup,
    updatePicture,
    updatePictures,
    workspace,
    workspaceCards,
    workspaceGroups,
    workspacePictures,
  })

  const clearCardImageOverrides = useCallback(
    (cardIds: string[]) => {
      updateCards(
        cardIds.map((cardId) => ({
          cardId,
          updates: {
            faviconOverrideImageId: undefined,
          },
        })),
      )
    },
    [updateCards],
  )

  const getLatestImageUsageSummary = useCallback((imageId: string) => {
    return getImageUsageSummary(useWorkspaceStore.getState().workspace, imageId)
  }, [])

  const setCardImageOverride = useCallback(
    (cardId: string, imageId: string) => {
      updateCard(cardId, {
        faviconOverrideImageId: imageId,
      })
    },
    [updateCard],
  )

  const setPictureImage = useCallback(
    (pictureId: string, imageId: string) => {
      updatePicture(pictureId, {
        imageId,
      })
    },
    [updatePicture],
  )

  const {
    activeCardOverrideImageId,
    closeImageGallery,
    handleDeleteImageAsset,
    handleImportImageAsset,
    handleRenameImageAsset,
    handleSelectGalleryAsset,
    imageAssets,
    imageGalleryState,
    imageUsageById,
    openCardImageOverridePicker,
    openImageGallery,
    openPictureImagePicker,
    refreshImageAssets,
  } = useImageGalleryManager({
    cards: workspaceCards,
    getLatestUsageSummary: getLatestImageUsageSummary,
    onClearCardImageOverrides: clearCardImageOverrides,
    onPlaceAssetAtViewportCenter: placePictureAssetAtViewportCenter,
    onRemovePictures: removePictures,
    onSetCardImageOverride: setCardImageOverride,
    onSetPictureImage: setPictureImage,
    openPromptDialog,
    pictures: workspacePictures,
    showNotice: showImageNotice,
    status,
  })

  const { getFallbackText, handlePastedText } = useCanvasClipboard({
    addGroupsAndCards,
    canPlaceCardFrames,
    canPlaceGroupFrames,
    createAtViewportCenter,
    interactionMode,
    moveGroup,
    removeSelection,
    selectedCardIds,
    selectedGroupIds,
    selectedPictureIds,
    undoWorkspace,
    updateCards,
    updatePictures,
    workspace,
  })

  const createPicturesAtCanvasPoint = useCallback(
    async (files: File[], canvasPoint: { x: number; y: number }) => {
      if (files.length === 0) {
        return
      }

      const assets = await Promise.all(
        files.map((file) => saveImageAsset({ file })),
      )
      await refreshImageAssets()
      placePictureAssetsAtCanvasPoint(assets, canvasPoint)
      toggleQuickAdd(false)
    },
    [placePictureAssetsAtCanvasPoint, refreshImageAssets, toggleQuickAdd],
  )

  const createPictureAtViewportCenter = useCallback(
    async (file: File) => {
      const asset = await saveImageAsset({ file })
      await refreshImageAssets()
      placePictureAssetAtViewportCenter(asset)
      toggleQuickAdd(false)
    },
    [placePictureAssetAtViewportCenter, refreshImageAssets, toggleQuickAdd],
  )

  const handleCanvasDropImageFiles = useCallback(
    (files: File[], canvasPosition: { x: number; y: number }) => {
      void createPicturesAtCanvasPoint(files, canvasPosition).catch((error) => {
        showImageNotice(
          'Image drop failed',
          getErrorMessage(error, 'Image drop failed.'),
        )
      })
    },
    [createPicturesAtCanvasPoint, showImageNotice],
  )

  const handleInvalidImageDrop = useCallback(() => {
    showImageNotice(
      'Unsupported file drop',
      'Only supported image files can be dropped here.',
    )
  }, [showImageNotice])

  const handleDragPreviewChange = useCallback(
    (preview: CanvasDragPreview | null) => {
      if (interactionMode !== 'edit') {
        return
      }

      setDragPreview(preview)
    },
    [interactionMode],
  )

  const handleSelectCard = useCallback(
    (cardId: string, additive: boolean) => {
      if (additive) {
        toggleCardSelection(cardId)
        return
      }

      selectCardExclusive(cardId)
    },
    [selectCardExclusive, toggleCardSelection],
  )

  const handleSelectGroup = useCallback(
    (groupId: string, additive: boolean) => {
      if (additive) {
        toggleGroupSelection(groupId)
        return
      }

      selectGroupExclusive(groupId)
    },
    [selectGroupExclusive, toggleGroupSelection],
  )

  const handleSelectPicture = useCallback(
    (pictureId: string, additive: boolean) => {
      if (additive) {
        togglePictureSelection(pictureId)
        return
      }

      selectPictureExclusive(pictureId)
    },
    [selectPictureExclusive, togglePictureSelection],
  )

  const canvasActionsContextValue = useMemo(
    () => ({
      autoEditTarget,
      onClearAutoEditTarget: clearAutoEditTarget,
      onRecordLinkOpen: recordLinkOpen,
      onMoveCard: handleMoveCard,
      onMoveGroup: handleMoveGroup,
      onMovePicture: handleMovePicture,
      onPreviewChange: handleDragPreviewChange,
      onRemoveCard: removeCard,
      onRemoveGroup: removeGroup,
      onRemovePicture: removePicture,
      onRequestCardImageOverridePicker: openCardImageOverridePicker,
      onRequestPictureImagePicker: openPictureImagePicker,
      onSelectCard: handleSelectCard,
      onSelectGroup: handleSelectGroup,
      onSelectPicture: handleSelectPicture,
      onUpdateCard: handleUpdateCard,
      onUpdateGroup: handleUpdateGroup,
      onUpdatePicture: handleUpdatePicture,
    }),
    [
      autoEditTarget,
      clearAutoEditTarget,
      handleDragPreviewChange,
      handleMoveCard,
      handleMoveGroup,
      handleMovePicture,
      handleSelectCard,
      handleSelectGroup,
      handleSelectPicture,
      handleUpdateCard,
      handleUpdateGroup,
      handleUpdatePicture,
      openCardImageOverridePicker,
      openPictureImagePicker,
      recordLinkOpen,
      removeCard,
      removeGroup,
      removePicture,
    ],
  )

  const handleUploadImage = useCallback(
    (file: File) => {
      void createPictureAtViewportCenter(file).catch((error) => {
        showImageNotice(
          'Image upload failed',
          getErrorMessage(error, 'Image upload failed.'),
        )
      })
    },
    [createPictureAtViewportCenter, showImageNotice],
  )

  if (status === 'loading') {
    return <div className="statusScreen">Loading workspace…</div>
  }

  return (
    <div className="workspaceShell" data-mode={interactionMode}>
      <CanvasPasteLayer
        getFallbackText={getFallbackText}
        onText={handlePastedText}
      />
      <CanvasActionsProvider value={canvasActionsContextValue}>
        <InfiniteCanvas
          workspace={workspace}
          interactionMode={interactionMode}
          selectedCardIds={selectedCardIds}
          selectedGroupIds={selectedGroupIds}
          selectedPictureIds={selectedPictureIds}
          onClearSelection={clearSelection}
          onSelectSelection={setSelection}
          onDropImageFiles={handleCanvasDropImageFiles}
          onInvalidImageDrop={handleInvalidImageDrop}
          onPanViewport={setViewport}
          dragPreview={interactionMode === 'edit' ? dragPreview : null}
        />
      </CanvasActionsProvider>
      <EmptyCanvasGuide
        visible={
          workspace.cards.length === 0 &&
          workspace.groups.length === 0 &&
          workspace.pictures.length === 0
        }
        onToggleQuickAdd={() => toggleQuickAdd()}
      />
      <BottomTaskbar
        activeWorkspaceId={activeWorkspaceId}
        cardCount={workspace.cards.length}
        interactionMode={interactionMode}
        quickAddOpen={quickAddOpen}
        optionsMenuOpen={optionsMenuOpen}
        workspaceRailOpen={workspaceRailOpen}
        workspaceRailPinned={workspaceRailPinned}
        workspaceSummaries={workspaceSummaries}
        onCreateGroup={createGroupAtViewportCenter}
        onCreateWorkspace={() => {
          void createWorkspace()
        }}
        onCloseOptionsMenu={() => toggleOptionsMenu(false)}
        onSelectWorkspace={(workspaceId) => {
          void switchWorkspace(workspaceId)
        }}
        onToggleInteractionMode={() => toggleInteractionMode()}
        onToggleQuickAdd={() => toggleQuickAdd()}
        onToggleOptionsMenu={() => toggleOptionsMenu()}
        onToggleWorkspaceRail={() => toggleWorkspaceRail()}
        onToggleWorkspaceRailPinned={() => toggleWorkspaceRailPinned()}
        onSubmitQuickAdd={createAtViewportCenter}
        onOpenImageGallery={openImageGallery}
        onUploadImage={handleUploadImage}
      />
      <WorkspaceHelpDock interactionMode={interactionMode} />
      {imageGalleryState ? (
        <Suspense fallback={null}>
          <ImageGalleryDialog
            activeImageId={activeCardOverrideImageId}
            assets={imageAssets}
            mode={imageGalleryState.mode}
            open
            usageByImageId={imageUsageById}
            onDeleteAsset={handleDeleteImageAsset}
            onImportAsset={handleImportImageAsset}
            onRequestClose={closeImageGallery}
            onRenameAsset={handleRenameImageAsset}
            onSelectAsset={handleSelectGalleryAsset}
          />
        </Suspense>
      ) : null}
      {promptDialog ? (
        <PromptDialog
          closeLabel={
            promptDialog.secondaryLabel ? 'Cancel prompt' : 'Close prompt'
          }
          description={promptDialog.description}
          eyebrow={promptDialog.eyebrow}
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
