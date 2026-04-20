import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import {
  clampCardCornerRadius,
  parseCardSizeDraft,
  type LinkCard as LinkCardModel,
} from '../../contracts/linkCard'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'
import { clampSurfaceTransparency } from '../../contracts/surfaceEffects'
import type { Viewport } from '../../contracts/workspace'
import { createFormatPainterFromCard } from '../../features/appearance/formatPainter'
import { useSurfaceStyles } from '../../features/appearance/useSurfaceStyles'
import { isPlacementBlockedByOccupiedItem } from '../../features/groups/groupLayout'
import { useImageAssetUrl } from '../../features/images/useImageAssetUrl'
import {
  createFaviconUrl,
  normalizeUrl,
} from '../../features/links/urlValidation'
import { getAnchoredOverlayPosition } from '../../features/placement/overlayPlacement'
import { getPlaceableItemsSnapshot } from '../../features/placement/placeableItemsSnapshot'
import { useDragPlacement } from '../../features/placement/useDragPlacement'
import { useResizePlacement } from '../../features/placement/useResizePlacement'
import { useAppearanceStore } from '../../state/useAppearanceStore'
import {
  useWorkspaceStore,
  type InteractionMode,
} from '../../state/useWorkspaceStore'
import {
  useCanvasEditActions,
  useCanvasPlacementActions,
  useCanvasSelectionActions,
} from '../canvas/CanvasActionsContext'
import { isSelectMenuPortalTarget } from '../ui/SelectMenu'
import { LinkCardEditOverlay } from './LinkCardEditOverlay'
import { LinkCardUrlTooltip } from './LinkCardUrlTooltip'
import { LinkCardView } from './LinkCardView'
import { useLinkCardViewModel } from './useLinkCardViewModel'

export type LinkCardProps = {
  card: LinkCardModel
  guide: PlacementGuide
  isSelected: boolean
  interactionMode: InteractionMode
  viewport: Viewport
}

export const LinkCardContainer = memo(function LinkCardContainer({
  card,
  guide,
  isSelected,
  interactionMode,
  viewport,
}: LinkCardProps) {
  const {
    autoEditTarget,
    onClearAutoEditTarget: clearAutoEditTarget,
    onSelectCard: onSelect,
  } = useCanvasSelectionActions()
  const {
    onRecordLinkOpen: recordLinkOpen,
    onRemoveCard: onRemove,
    onRequestCardImageOverridePicker: onRequestImageOverridePicker,
    onUpdateCard: onUpdate,
  } = useCanvasEditActions()
  const { onMoveCard: onMove, onPreviewChange } = useCanvasPlacementActions()
  const { appearance, setBorderPresets, setFillPresets } = useAppearanceStore()
  const startFormatPainter = useWorkspaceStore(
    (state) => state.startFormatPainter,
  )
  const [isEditing, setIsEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(card.title)
  const [urlDraft, setUrlDraft] = useState(card.url)
  const [widthDraft, setWidthDraft] = useState(String(card.size.columns))
  const [heightDraft, setHeightDraft] = useState(String(card.size.rows))
  const [cornerRadiusDraft, setCornerRadiusDraft] = useState(
    card.cornerRadius ?? appearance.defaultCardCornerRadius,
  )
  const [showTitleDraft, setShowTitleDraft] = useState(
    card.showTitle ?? appearance.defaultCardShowTitle,
  )
  const [showImageDraft, setShowImageDraft] = useState(
    card.showImage ?? appearance.defaultCardShowImage,
  )
  const [fillPresetIndexDraft, setFillPresetIndexDraft] = useState<
    number | null
  >(card.fillPresetIndex ?? null)
  const [borderPresetIndexDraft, setBorderPresetIndexDraft] = useState<
    number | null
  >(card.borderPresetIndex ?? null)
  const [fillColorDraft, setFillColorDraft] = useState(card.fillColor ?? null)
  const [borderColorDraft, setBorderColorDraft] = useState(
    card.borderColor ?? null,
  )
  const [surfaceTransparencyDraft, setSurfaceTransparencyDraft] =
    useState<SurfaceTransparency>(
      card.surfaceTransparency ?? appearance.defaultSurfaceTransparency,
    )
  const [shadowStyleDraft, setShadowStyleDraft] = useState<SurfaceShadowStyle>(
    card.shadowStyle ?? appearance.defaultSurfaceShadowStyle,
  )
  const articleRef = useRef<HTMLElement | null>(null)
  const editPanelRef = useRef<HTMLDivElement | null>(null)
  const [editPanelStyle, setEditPanelStyle] = useState<CSSProperties | null>(
    null,
  )
  const tooltipTimeoutRef = useRef<number | null>(null)
  const [isUrlTooltipVisible, setIsUrlTooltipVisible] = useState(false)
  const [urlTooltipStyle, setUrlTooltipStyle] = useState<CSSProperties | null>(
    null,
  )
  const autoEditCardId =
    autoEditTarget?.kind === 'card' ? autoEditTarget.id : null
  const overrideImageUrl = useImageAssetUrl(card.faviconOverrideImageId)
  const {
    activeColorSettings,
    defaultColorPresets,
    resolvedColors: resolvedCardColors,
    resolvedShadowStyle,
    resolvedSurfaceTransparency,
    selectedBorderColor,
    selectedFillColor,
  } = useSurfaceStyles({
    appearance,
    drafts: {
      borderColorDraft,
      borderPresetIndexDraft,
      fillColorDraft,
      fillPresetIndexDraft,
    },
    entity: card,
  })

  const isEditMode = interactionMode === 'edit'

  const handleDragPointerDown = useDragPlacement({
    cardId: card.id,
    cardSize: card.size,
    position: { x: card.positionX, y: card.positionY },
    getCards: getPlaceableItemsSnapshot,
    enabled: isEditMode && !isEditing,
    guide,
    isOccupiedItemBlocking: (candidate, occupiedItem, currentGuide) =>
      isPlacementBlockedByOccupiedItem({
        candidate,
        gridSize: currentGuide.gridSize,
        occupiedItem,
      }),
    viewport,
    onMove,
    onPreviewChange,
  })

  const createResizePointerDown = useResizePlacement({
    card,
    getCards: getPlaceableItemsSnapshot,
    enabled: isEditMode && !isEditing,
    guide,
    isOccupiedItemBlocking: (candidate, occupiedItem, currentGuide) =>
      isPlacementBlockedByOccupiedItem({
        candidate,
        gridSize: currentGuide.gridSize,
        occupiedItem,
      }),
    viewport,
    onResize: (cardId, frame) => {
      onUpdate(cardId, {
        size: frame.size,
        positionX: frame.position.x,
        positionY: frame.position.y,
      })
    },
    onPreviewChange,
  })

  const normalizedUpdateUrl = useMemo(() => normalizeUrl(urlDraft), [urlDraft])
  const normalizedCardSize = useMemo(
    () => parseCardSizeDraft(widthDraft, heightDraft),
    [heightDraft, widthDraft],
  )
  const resolvedCardImageUrl = card.faviconOverrideImageId
    ? overrideImageUrl
    : card.faviconUrl
  const viewModel = useLinkCardViewModel({
    appearance,
    card,
    guide,
    resolvedCardColors,
    resolvedCardImageUrl,
    resolvedShadowStyle,
    resolvedSurfaceTransparency,
    viewport,
  })

  const clearUrlTooltipTimer = useCallback(() => {
    if (tooltipTimeoutRef.current !== null) {
      window.clearTimeout(tooltipTimeoutRef.current)
      tooltipTimeoutRef.current = null
    }
  }, [])

  const hideUrlTooltip = useCallback(() => {
    clearUrlTooltipTimer()
    setIsUrlTooltipVisible(false)
    setUrlTooltipStyle(null)
  }, [clearUrlTooltipTimer])

  const scheduleUrlTooltip = useCallback(() => {
    if (isEditMode) {
      return
    }

    clearUrlTooltipTimer()
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setIsUrlTooltipVisible(true)
      tooltipTimeoutRef.current = null
    }, 500)
  }, [clearUrlTooltipTimer, isEditMode])

  const commitUrlDraft = useCallback(
    (nextUrlDraft: string) => {
      setUrlDraft(nextUrlDraft)

      const normalizedUrl = normalizeUrl(nextUrlDraft)

      if (!normalizedUrl) {
        return
      }

      onUpdate(card.id, {
        url: normalizedUrl,
        faviconUrl: createFaviconUrl(normalizedUrl),
      })
    },
    [card.id, onUpdate],
  )

  const commitSizeDrafts = useCallback(
    (nextWidthDraft: string, nextHeightDraft: string) => {
      setWidthDraft(nextWidthDraft)
      setHeightDraft(nextHeightDraft)

      const nextSize = parseCardSizeDraft(nextWidthDraft, nextHeightDraft)

      if (!nextSize) {
        return
      }

      onUpdate(card.id, {
        size: nextSize,
      })
    },
    [card.id, onUpdate],
  )

  const commitFillSelection = useCallback(
    (nextFillPresetIndex: number | null, nextFillColor: string | null) => {
      setFillPresetIndexDraft(nextFillPresetIndex)
      setFillColorDraft(nextFillColor)

      onUpdate(card.id, {
        fillPresetIndex: nextFillPresetIndex ?? undefined,
        fillColor:
          nextFillPresetIndex === null
            ? (nextFillColor ?? undefined)
            : undefined,
      })
    },
    [card.id, onUpdate],
  )

  const commitBorderSelection = useCallback(
    (nextBorderPresetIndex: number | null, nextBorderColor: string | null) => {
      setBorderPresetIndexDraft(nextBorderPresetIndex)
      setBorderColorDraft(nextBorderColor)

      onUpdate(card.id, {
        borderPresetIndex: nextBorderPresetIndex ?? undefined,
        borderColor:
          nextBorderPresetIndex === null
            ? (nextBorderColor ?? undefined)
            : undefined,
      })
    },
    [card.id, onUpdate],
  )

  const handleRecordLinkOpen = useCallback(() => {
    recordLinkOpen(card.id)
  }, [card.id, recordLinkOpen])

  const handleOpenEditor = useCallback(() => {
    setTitleDraft(card.title)
    setUrlDraft(card.url)
    setWidthDraft(String(card.size.columns))
    setHeightDraft(String(card.size.rows))
    setCornerRadiusDraft(
      card.cornerRadius ?? appearance.defaultCardCornerRadius,
    )
    setShowTitleDraft(card.showTitle ?? appearance.defaultCardShowTitle)
    setShowImageDraft(card.showImage ?? appearance.defaultCardShowImage)
    setFillPresetIndexDraft(
      card.fillPresetIndex ?? activeColorSettings.defaultFillPresetIndex,
    )
    setBorderPresetIndexDraft(
      card.borderPresetIndex ?? activeColorSettings.defaultBorderPresetIndex,
    )
    setFillColorDraft(
      card.fillPresetIndex === undefined ? (card.fillColor ?? null) : null,
    )
    setBorderColorDraft(
      card.borderPresetIndex === undefined ? (card.borderColor ?? null) : null,
    )
    setSurfaceTransparencyDraft(
      card.surfaceTransparency ?? appearance.defaultSurfaceTransparency,
    )
    setShadowStyleDraft(
      card.shadowStyle ?? appearance.defaultSurfaceShadowStyle,
    )
    hideUrlTooltip()
    setEditPanelStyle(null)
    setIsEditing(true)
  }, [
    activeColorSettings.defaultBorderPresetIndex,
    activeColorSettings.defaultFillPresetIndex,
    appearance,
    card,
    hideUrlTooltip,
  ])

  useEffect(() => {
    if (!isEditMode || isEditing || autoEditCardId !== card.id) {
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      handleOpenEditor()
      clearAutoEditTarget()
    })

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [
    autoEditCardId,
    card.id,
    clearAutoEditTarget,
    handleOpenEditor,
    isEditMode,
    isEditing,
  ])

  useEffect(() => {
    return () => {
      clearUrlTooltipTimer()
    }
  }, [clearUrlTooltipTimer])

  useEffect(() => {
    if (!isEditing) {
      return
    }

    const handlePointerDownOutside = (event: PointerEvent) => {
      if (editPanelRef.current?.contains(event.target as Node)) {
        return
      }

      if (isSelectMenuPortalTarget(event.target)) {
        return
      }

      hideUrlTooltip()
      setEditPanelStyle(null)
      setIsEditing(false)
    }

    document.addEventListener('pointerdown', handlePointerDownOutside)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside)
    }
  }, [hideUrlTooltip, isEditing])

  useLayoutEffect(() => {
    if (!isUrlTooltipVisible || isEditMode) {
      return
    }

    const updateUrlTooltipPosition = () => {
      const articleRect = articleRef.current?.getBoundingClientRect()

      if (!articleRect) {
        return
      }

      const viewportPadding = 8
      const anchorGap = 9
      const left = Math.max(
        viewportPadding,
        Math.min(
          articleRect.left + articleRect.width / 2,
          window.innerWidth - viewportPadding,
        ),
      )
      const top = Math.max(viewportPadding, articleRect.top - anchorGap)

      setUrlTooltipStyle({
        left: `${left}px`,
        top: `${top}px`,
      })
    }

    const animationFrameId = window.requestAnimationFrame(
      updateUrlTooltipPosition,
    )

    window.addEventListener('resize', updateUrlTooltipPosition)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', updateUrlTooltipPosition)
    }
  }, [
    card.positionX,
    card.positionY,
    card.size.columns,
    card.size.rows,
    guide.gridSize,
    isEditMode,
    isUrlTooltipVisible,
    viewport.x,
    viewport.y,
    viewport.zoom,
  ])

  useLayoutEffect(() => {
    if (!isEditing) {
      return
    }

    const updateEditPanelPosition = () => {
      const articleRect = articleRef.current?.getBoundingClientRect()
      const panelRect = editPanelRef.current?.getBoundingClientRect()

      if (!articleRect || !panelRect) {
        return
      }

      const viewportPadding = 8
      const anchorGap = 12
      const taskbarRect = document
        .querySelector<HTMLElement>('[data-testid="bottom-taskbar"]')
        ?.getBoundingClientRect()
      const bottomBoundary = Math.min(
        window.innerHeight - viewportPadding,
        (taskbarRect?.top ?? window.innerHeight) - viewportPadding,
      )
      const { left, maxHeight, top } = getAnchoredOverlayPosition({
        anchorGap,
        anchorRect: {
          left: articleRect.left,
          top: articleRect.top,
          bottom: articleRect.bottom,
          width: articleRect.width,
        },
        bottomBoundary,
        overlayRect: {
          width: panelRect.width,
          height: panelRect.height,
        },
        topBoundary: viewportPadding,
        viewportPadding,
        viewportWidth: window.innerWidth,
      })

      setEditPanelStyle({
        left: `${left}px`,
        top: `${top}px`,
        maxHeight: `${maxHeight}px`,
      })
    }

    const animationFrameId = window.requestAnimationFrame(
      updateEditPanelPosition,
    )
    window.addEventListener('resize', updateEditPanelPosition)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', updateEditPanelPosition)
    }
  }, [
    card.positionX,
    card.positionY,
    card.size.columns,
    card.size.rows,
    isEditing,
    viewport.x,
    viewport.y,
    viewport.zoom,
  ])

  const handleCopyFormat = useCallback(() => {
    startFormatPainter(createFormatPainterFromCard(card))
    hideUrlTooltip()
    setIsEditing(false)
  }, [card, hideUrlTooltip, startFormatPainter])

  const handleCloseEditor = useCallback(() => {
    hideUrlTooltip()
    setIsEditing(false)
  }, [hideUrlTooltip])

  const handleCardPointerDown = useCallback<
    React.PointerEventHandler<HTMLElement>
  >(
    (event) => {
      if (event.button !== 0) {
        return
      }

      if (isEditMode && !isEditing) {
        const additive = event.metaKey || event.ctrlKey

        if (additive) {
          onSelect(card.id, true)
          event.preventDefault()
          event.stopPropagation()
          return
        }

        if (!isSelected) {
          onSelect(card.id, false)
        }
      }

      handleDragPointerDown(event)
    },
    [
      card.id,
      handleDragPointerDown,
      isEditMode,
      isEditing,
      isSelected,
      onSelect,
    ],
  )

  const handleOpenEditorClick = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (event) => {
      event.preventDefault()
      event.stopPropagation()
      handleOpenEditor()
    },
    [handleOpenEditor],
  )

  const handleDeleteClick = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (event) => {
      event.preventDefault()
      event.stopPropagation()
      onRemove(card.id)
    },
    [card.id, onRemove],
  )

  const handleViewClick = useCallback<
    React.MouseEventHandler<HTMLAnchorElement>
  >(
    (event) => {
      if (!event.defaultPrevented && event.button === 0) {
        handleRecordLinkOpen()
      }
    },
    [handleRecordLinkOpen],
  )

  const handleViewAuxClick = useCallback<
    React.MouseEventHandler<HTMLAnchorElement>
  >(
    (event) => {
      if (!event.defaultPrevented && event.button === 1) {
        handleRecordLinkOpen()
      }
    },
    [handleRecordLinkOpen],
  )

  const handleRequestImageOverride = useCallback(() => {
    onRequestImageOverridePicker(card.id)
  }, [card.id, onRequestImageOverridePicker])

  const handleResetImageOverride = useCallback(() => {
    onUpdate(card.id, { faviconOverrideImageId: undefined })
  }, [card.id, onUpdate])

  const handleTitleChange = useCallback(
    (nextTitle: string) => {
      setTitleDraft(nextTitle)
      onUpdate(card.id, { title: nextTitle })
    },
    [card.id, onUpdate],
  )

  const handleWidthChange = useCallback(
    (nextWidth: string) => {
      commitSizeDrafts(nextWidth, heightDraft)
    },
    [commitSizeDrafts, heightDraft],
  )

  const handleHeightChange = useCallback(
    (nextHeight: string) => {
      commitSizeDrafts(widthDraft, nextHeight)
    },
    [commitSizeDrafts, widthDraft],
  )

  const handleCornerRadiusChange = useCallback(
    (value: number) => {
      const nextCornerRadius = clampCardCornerRadius(value)

      setCornerRadiusDraft(nextCornerRadius)
      onUpdate(card.id, {
        cornerRadius: nextCornerRadius,
      })
    },
    [card.id, onUpdate],
  )

  const handleShowTitleChange = useCallback(
    (value: boolean) => {
      setShowTitleDraft(value)
      onUpdate(card.id, { showTitle: value })
    },
    [card.id, onUpdate],
  )

  const handleShowImageChange = useCallback(
    (value: boolean) => {
      setShowImageDraft(value)
      onUpdate(card.id, { showImage: value })
    },
    [card.id, onUpdate],
  )

  const handleSurfaceTransparencyChange = useCallback(
    (value: SurfaceTransparency) => {
      const nextValue = clampSurfaceTransparency(value)

      setSurfaceTransparencyDraft(nextValue)
      onUpdate(card.id, { surfaceTransparency: nextValue })
    },
    [card.id, onUpdate],
  )

  const handleShadowStyleChange = useCallback(
    (value: SurfaceShadowStyle) => {
      setShadowStyleDraft(value)
      onUpdate(card.id, { shadowStyle: value })
    },
    [card.id, onUpdate],
  )

  const handleOverlayPointerDown = useCallback<
    React.PointerEventHandler<HTMLDivElement>
  >((event) => {
    event.stopPropagation()
  }, [])

  const handleOverlayWheelCapture = useCallback<
    React.WheelEventHandler<HTMLDivElement>
  >((event) => {
    event.stopPropagation()
  }, [])

  return (
    <>
      <LinkCardView
        articleRef={articleRef}
        card={card}
        createResizePointerDown={createResizePointerDown}
        interactionMode={interactionMode}
        isEditMode={isEditMode}
        isSelected={isSelected}
        viewModel={viewModel}
        onCardBlur={hideUrlTooltip}
        onCardFocus={scheduleUrlTooltip}
        onCardPointerDown={handleCardPointerDown}
        onCardPointerEnter={scheduleUrlTooltip}
        onCardPointerLeave={hideUrlTooltip}
        onDelete={handleDeleteClick}
        onOpenEditor={handleOpenEditorClick}
        onViewAuxClick={handleViewAuxClick}
        onViewClick={handleViewClick}
      />
      {isEditing ? (
        <LinkCardEditOverlay
          activeColorSettings={activeColorSettings}
          borderPresetIndexDraft={borderPresetIndexDraft}
          card={card}
          cornerRadiusDraft={cornerRadiusDraft}
          editPanelRef={editPanelRef}
          editPanelStyle={editPanelStyle}
          fillPresetIndexDraft={fillPresetIndexDraft}
          heightDraft={heightDraft}
          normalizedCardSize={normalizedCardSize}
          normalizedUpdateUrl={normalizedUpdateUrl}
          selectedBorderColor={selectedBorderColor}
          selectedFillColor={selectedFillColor}
          shadowStyleDraft={shadowStyleDraft}
          showImageDraft={showImageDraft}
          showTitleDraft={showTitleDraft}
          surfaceTransparencyDraft={surfaceTransparencyDraft}
          titleDraft={titleDraft}
          urlDraft={urlDraft}
          widthDraft={widthDraft}
          onClose={handleCloseEditor}
          onCopyFormat={handleCopyFormat}
          onCornerRadiusChange={handleCornerRadiusChange}
          onCustomBorderColorChange={(color) => {
            commitBorderSelection(null, color)
          }}
          onCustomFillColorChange={(color) => {
            commitFillSelection(null, color)
          }}
          onHeightChange={handleHeightChange}
          onPointerDown={handleOverlayPointerDown}
          onRequestImageOverridePicker={handleRequestImageOverride}
          onResetBorderPresets={() => {
            setBorderPresets(defaultColorPresets.borderPresets)
          }}
          onResetFillPresets={() => {
            setFillPresets(defaultColorPresets.fillPresets)
          }}
          onResetImageOverride={handleResetImageOverride}
          onSaveBorderPresets={setBorderPresets}
          onSaveFillPresets={setFillPresets}
          onSelectBorderPreset={(index) => {
            commitBorderSelection(index, null)
          }}
          onSelectFillPreset={(index) => {
            commitFillSelection(index, null)
          }}
          onShadowStyleChange={handleShadowStyleChange}
          onShowImageChange={handleShowImageChange}
          onShowTitleChange={handleShowTitleChange}
          onSurfaceTransparencyChange={handleSurfaceTransparencyChange}
          onTitleChange={handleTitleChange}
          onUrlChange={commitUrlDraft}
          onWheelCapture={handleOverlayWheelCapture}
          onWidthChange={handleWidthChange}
        />
      ) : null}
      <LinkCardUrlTooltip
        displayUrl={viewModel.displayUrl}
        isEditMode={isEditMode}
        isVisible={isUrlTooltipVisible}
        style={urlTooltipStyle}
      />
    </>
  )
})
