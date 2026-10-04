import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { getGroupLayoutSize, type CardGroup } from '../../contracts/cardGroup'
import type { LinkCard as LinkCardContract } from '../../contracts/linkCard'
import type { PictureNode as PictureNodeContract } from '../../contracts/pictureNode'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type { Viewport } from '../../contracts/workspace'
import { OptionalCardEffects } from '../../effects'
import {
  CanvasEngineSurface,
  shouldScrollInsideNode,
  type GridOptions,
} from '../../engine'
import {
  getCardUpdatesFromFormatPainter,
  getGroupUpdatesFromFormatPainter,
  isFormatPainterSourceMatch,
} from '../../features/appearance/formatPainter'
import { getCardPixelDimensions } from '../../features/appearance/themeTokens'
import {
  getVisibleCards,
  getVisibleGroups,
} from '../../features/groups/groupLayout'
import {
  getVisibleCanvasBounds,
  isRectInBounds,
} from '../../features/placement/canvasMath'
import {
  useWorkspaceStore,
  type InteractionMode,
} from '../../state/useWorkspaceStore'
import { LinkCardContainer as LinkCard } from '../cards/LinkCardContainer'
import { ChartNode } from '../charts/ChartNode'
import { FeedNode } from '../feeds/FeedNode'
import { GroupFrameContainer as GroupFrame } from '../groups/GroupFrameContainer'
import { PictureNode } from '../pictures/PictureNode'
import {
  useCanvasEditActions,
  type CanvasDragPreview,
} from './CanvasActionsContext'
import { useCanvasFileDrop } from './hooks/useCanvasFileDrop'
import { useCanvasPanZoom } from './hooks/useCanvasPanZoom'
import { useMarqueeSelection } from './hooks/useMarqueeSelection'

type InfiniteCanvasProps = {
  cards: LinkCardContract[]
  groups: CardGroup[]
  pictures: PictureNodeContract[]
  viewport: Viewport
  placementGuide: PlacementGuide
  interactionMode: InteractionMode
  selectedCardIds: string[]
  selectedGroupIds: string[]
  selectedPictureIds: string[]
  onClearSelection: () => void
  onSelectSelection: (selection: {
    cardIds: string[]
    groupIds: string[]
    pictureIds: string[]
  }) => void
  onDropImageFiles: (
    files: File[],
    canvasPosition: { x: number; y: number },
  ) => void
  onInvalidImageDrop: () => void
  onPanViewport: (nextViewport: Viewport) => void
  dragPreview: CanvasDragPreview | null
}

export const InfiniteCanvas = memo(function InfiniteCanvas({
  cards,
  groups,
  pictures,
  viewport,
  placementGuide,
  interactionMode,
  selectedCardIds,
  selectedGroupIds,
  selectedPictureIds,
  onClearSelection,
  onSelectSelection,
  onDropImageFiles,
  onInvalidImageDrop,
  onPanViewport,
  dragPreview,
}: InfiniteCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const formatPainter = useWorkspaceStore((state) => state.formatPainter)
  const clearFormatPainter = useWorkspaceStore(
    (state) => state.clearFormatPainter,
  )
  const { onUpdateCard, onUpdateGroup } = useCanvasEditActions()

  const visibleCards = useMemo(
    () => getVisibleCards(cards, groups),
    [cards, groups],
  )
  const visibleGroups = useMemo(() => getVisibleGroups(groups), [groups])
  const visiblePictures = pictures

  const selectedCardIdSet = useMemo(
    () => new Set(selectedCardIds),
    [selectedCardIds],
  )
  const selectedGroupIdSet = useMemo(
    () => new Set(selectedGroupIds),
    [selectedGroupIds],
  )
  const selectedPictureIdSet = useMemo(
    () => new Set(selectedPictureIds),
    [selectedPictureIds],
  )

  const viewportBounds = useMemo(
    () =>
      getVisibleCanvasBounds(viewport, window.innerWidth, window.innerHeight),
    [viewport],
  )

  const gridSize = placementGuide.gridSize

  const culledCards = useMemo(
    () =>
      visibleCards.filter((card) => {
        const px = getCardPixelDimensions(card.size, gridSize)

        return isRectInBounds(
          card.positionX,
          card.positionY,
          px.width,
          px.height,
          viewportBounds,
        )
      }),
    [visibleCards, viewportBounds, gridSize],
  )

  const culledGroups = useMemo(
    () =>
      visibleGroups.filter((group) => {
        const px = getCardPixelDimensions(getGroupLayoutSize(group), gridSize)

        return isRectInBounds(
          group.positionX,
          group.positionY,
          px.width,
          px.height,
          viewportBounds,
        )
      }),
    [visibleGroups, viewportBounds, gridSize],
  )

  const culledPictures = useMemo(
    () =>
      visiblePictures.filter((picture) => {
        const px = getCardPixelDimensions(picture.size, gridSize)

        return isRectInBounds(
          picture.positionX,
          picture.positionY,
          px.width,
          px.height,
          viewportBounds,
        )
      }),
    [visiblePictures, viewportBounds, gridSize],
  )

  const grid = useMemo<GridOptions>(
    () => ({
      visible: placementGuide.gridVisible,
      size: placementGuide.gridSize,
      color: 'var(--grid-color)',
    }),
    [placementGuide.gridSize, placementGuide.gridVisible],
  )

  const { handleContextMenu, handleWheel, handleRightClickPointerDown } =
    useCanvasPanZoom({
      canvasRef,
      viewport,
      interactionMode,
      onPanViewport,
    })

  const {
    isFileDropActive,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useCanvasFileDrop({
    canvasRef,
    viewport,
    onDropImageFiles,
    onInvalidImageDrop,
  })

  const { handlePointerDown, canvasInteraction, selectionMarquee } =
    useMarqueeSelection({
      canvasRef,
      viewport,
      interactionMode,
      formatPainter,
      onClearSelection,
      clearFormatPainter,
      onSelectSelection,
      visibleCards,
      visibleGroups,
      gridSize,
    })

  // React registers wheel listeners as passive, so preventDefault() inside
  // onWheel is ignored (and warns). Attach a non-passive native listener so
  // wheel zoom/pan doesn't also scroll or zoom the page.
  const handleWheelRef = useRef(handleWheel)
  useEffect(() => {
    handleWheelRef.current = handleWheel
  }, [handleWheel])

  useEffect(() => {
    const element = canvasRef.current
    if (!element) {
      return
    }

    const listener = (event: WheelEvent) => {
      if (shouldScrollInsideNode(event)) {
        return
      }

      handleWheelRef.current(event)
    }
    element.addEventListener('wheel', listener, { passive: false })

    return () => element.removeEventListener('wheel', listener)
  }, [])

  const handleFormatPainterCapture = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || !formatPainter) {
        return
      }

      const target = event.target as HTMLElement | null
      if (!target) {
        return
      }

      if (target.closest('button, input, select, textarea, a, label')) {
        return
      }

      const entityEl = target.closest<HTMLElement>('[data-entity-kind]')
      if (!entityEl || !canvasRef.current?.contains(entityEl)) {
        return
      }

      const kind = entityEl.dataset.entityKind
      const id = entityEl.dataset.entityId
      if (!id || (kind !== 'card' && kind !== 'group' && kind !== 'picture')) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (kind === 'picture') {
        return
      }

      if (isFormatPainterSourceMatch(formatPainter, { id, kind })) {
        return
      }

      if (kind === 'card') {
        onUpdateCard(id, getCardUpdatesFromFormatPainter(formatPainter))
      } else {
        onUpdateGroup(id, getGroupUpdatesFromFormatPainter(formatPainter))
      }
    },
    [formatPainter, onUpdateCard, onUpdateGroup],
  )

  const handlePointerDownCombined = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      handleRightClickPointerDown(event)
      handlePointerDown(event)
    },
    [handlePointerDown, handleRightClickPointerDown],
  )

  return (
    <section
      ref={canvasRef}
      className="canvasRoot"
      data-canvas-interaction={canvasInteraction}
      data-file-drop-active={isFileDropActive}
      data-format-painter={formatPainter ? 'active' : 'idle'}
      data-mode={interactionMode}
      data-testid="infinite-canvas"
      onPointerDownCapture={handleFormatPainterCapture}
      onContextMenu={handleContextMenu}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPointerDown={handlePointerDownCombined}
    >
      <CanvasEngineSurface viewport={viewport} grid={grid}>
        {culledGroups.map((group) => (
          <GroupFrame
            key={group.id}
            group={group}
            groups={groups}
            pictures={pictures}
            guide={placementGuide}
            isSelected={selectedGroupIdSet.has(group.id)}
            interactionMode={interactionMode}
            viewport={viewport}
          />
        ))}
        {culledCards.map((card) => (
          <LinkCard
            key={card.id}
            card={card}
            guide={placementGuide}
            isSelected={selectedCardIdSet.has(card.id)}
            interactionMode={interactionMode}
            viewport={viewport}
          />
        ))}
        {culledPictures.map((picture) =>
          picture.type === 'chart' ? (
            <ChartNode
              key={picture.id}
              chart={picture}
              guide={placementGuide}
              isSelected={selectedPictureIdSet.has(picture.id)}
              interactionMode={interactionMode}
              viewport={viewport}
            />
          ) : picture.type === 'feed' ? (
            <FeedNode
              key={picture.id}
              feed={picture}
              guide={placementGuide}
              isSelected={selectedPictureIdSet.has(picture.id)}
              interactionMode={interactionMode}
              viewport={viewport}
            />
          ) : (
            <PictureNode
              key={picture.id}
              picture={picture}
              guide={placementGuide}
              isSelected={selectedPictureIdSet.has(picture.id)}
              interactionMode={interactionMode}
              viewport={viewport}
            />
          ),
        )}
      </CanvasEngineSurface>
      <OptionalCardEffects rootRef={canvasRef} />
      {isFileDropActive ? (
        <div
          className="canvasFileDropOverlay"
          data-testid="canvas-file-drop-overlay"
        >
          <div className="canvasFileDropHint">
            Drop image files to add them to the gallery and create picture
            nodes.
          </div>
        </div>
      ) : null}
      {interactionMode === 'edit' && selectionMarquee ? (
        <div
          className="selectionMarquee"
          data-testid="selection-marquee"
          style={{
            left: selectionMarquee.left,
            top: selectionMarquee.top,
            width: selectionMarquee.width,
            height: selectionMarquee.height,
          }}
        />
      ) : null}
      {interactionMode === 'edit' && dragPreview
        ? (() => {
            const size = getCardPixelDimensions(
              dragPreview.size,
              placementGuide.gridSize,
            )

            return (
              <div
                className="cardSnapPreview"
                data-testid="card-snap-preview"
                style={{
                  width: size.width,
                  height: size.height,
                  transform: `translate(${(dragPreview.position.x - viewport.x) * viewport.zoom}px, ${(dragPreview.position.y - viewport.y) * viewport.zoom}px) scale(${viewport.zoom})`,
                  transformOrigin: 'top left',
                }}
              />
            )
          })()
        : null}
    </section>
  )
})
