import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { getGroupLayoutSize, type CardGroup } from '../../contracts/cardGroup'
import type { LinkCard as LinkCardContract } from '../../contracts/linkCard'
import type { PictureNode as PictureNodeContract } from '../../contracts/pictureNode'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type { Viewport } from '../../contracts/workspace'
import {
  getCardUpdatesFromFormatPainter,
  getGroupUpdatesFromFormatPainter,
  isFormatPainterSourceMatch,
} from '../../features/appearance/formatPainter'
import { getCardPixelDimensions } from '../../features/appearance/themeTokens'
import {
  getRootSelectedGroupIds,
  getSelectedGroupSubtree,
  getVisibleCards,
  getVisibleGroups,
} from '../../features/groups/groupLayout'
import {
  getSupportedDroppedImageFiles,
  hasFileDataTransfer,
} from '../../features/images/imageDrop'
import {
  getVisibleCanvasBounds,
  isRectInBounds,
  screenDeltaToCanvas,
  screenPointToCanvas,
} from '../../features/placement/canvasMath'
import {
  useWorkspaceStore,
  type InteractionMode,
} from '../../state/useWorkspaceStore'
import { LinkCardContainer as LinkCard } from '../cards/LinkCardContainer'
import { GroupFrameContainer as GroupFrame } from '../groups/GroupFrameContainer'
import { PictureNode } from '../pictures/PictureNode'
import {
  useCanvasEditActions,
  type CanvasDragPreview,
} from './CanvasActionsContext'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.1

type CanvasInteractionState = 'idle' | 'panning' | 'selecting'

type SelectionMarquee = {
  left: number
  top: number
  width: number
  height: number
}

type CanvasRect = {
  left: number
  top: number
  right: number
  bottom: number
}

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
  const fileDragDepthRef = useRef(0)
  const [canvasInteraction, setCanvasInteraction] =
    useState<CanvasInteractionState>('idle')
  const [isFileDropActive, setIsFileDropActive] = useState(false)
  const [selectionMarquee, setSelectionMarquee] =
    useState<SelectionMarquee | null>(null)
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

  const getLocalPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()

    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    }
  }

  const createSelectionMarquee = (
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
  ): SelectionMarquee => ({
    left: Math.min(startPoint.x, endPoint.x),
    top: Math.min(startPoint.y, endPoint.y),
    width: Math.abs(endPoint.x - startPoint.x),
    height: Math.abs(endPoint.y - startPoint.y),
  })

  const createCanvasRect = (
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
  ): CanvasRect => ({
    left: Math.min(startPoint.x, endPoint.x),
    top: Math.min(startPoint.y, endPoint.y),
    right: Math.max(startPoint.x, endPoint.x),
    bottom: Math.max(startPoint.y, endPoint.y),
  })

  const resetFileDropState = () => {
    fileDragDepthRef.current = 0
    setIsFileDropActive(false)
  }

  const getFullyEnclosedCardIds = (selectionRect: CanvasRect) =>
    visibleCards
      .filter((card) => {
        const size = getCardPixelDimensions(card.size, placementGuide.gridSize)
        const right = card.positionX + size.width
        const bottom = card.positionY + size.height

        return (
          card.positionX >= selectionRect.left &&
          card.positionY >= selectionRect.top &&
          right <= selectionRect.right &&
          bottom <= selectionRect.bottom
        )
      })
      .map((card) => card.id)

  const getFullyEnclosedGroupIds = (selectionRect: CanvasRect) =>
    visibleGroups
      .filter((group) => {
        const size = getCardPixelDimensions(
          getGroupLayoutSize(group),
          placementGuide.gridSize,
        )
        const right = group.positionX + size.width
        const bottom = group.positionY + size.height

        return (
          group.positionX >= selectionRect.left &&
          group.positionY >= selectionRect.top &&
          right <= selectionRect.right &&
          bottom <= selectionRect.bottom
        )
      })
      .map((group) => group.id)

  const gridStyle = useMemo(() => {
    const { gridSize } = placementGuide
    const scaledGridSize = gridSize * viewport.zoom
    const backgroundPositionX = (-viewport.x * viewport.zoom) % scaledGridSize
    const backgroundPositionY = (-viewport.y * viewport.zoom) % scaledGridSize

    return {
      backgroundImage:
        'linear-gradient(var(--grid-color) 1px, transparent 1px), linear-gradient(90deg, var(--grid-color) 1px, transparent 1px)',
      backgroundPosition: `${backgroundPositionX}px ${backgroundPositionY}px`,
      backgroundSize: `${scaledGridSize}px ${scaledGridSize}px`,
    }
  }, [placementGuide, viewport.x, viewport.y, viewport.zoom])

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
      onContextMenu={(event) => {
        if (
          interactionMode === 'edit' ||
          event.target === event.currentTarget
        ) {
          event.preventDefault()
        }
      }}
      onWheel={(event) => {
        event.preventDefault()

        const localPoint = getLocalPoint(event.clientX, event.clientY)

        if (event.altKey) {
          onPanViewport({
            ...viewport,
            x:
              viewport.x +
              screenDeltaToCanvas(event.deltaY + event.deltaX, viewport.zoom),
          })
          return
        }

        if (!event.ctrlKey) {
          const canvasPoint = screenPointToCanvas(localPoint, viewport)
          const direction = event.deltaY > 0 ? -1 : 1
          const nextZoom = Math.min(
            MAX_ZOOM,
            Math.max(
              MIN_ZOOM,
              Number((viewport.zoom + direction * ZOOM_STEP).toFixed(2)),
            ),
          )

          if (nextZoom === viewport.zoom) {
            return
          }

          onPanViewport({
            x: canvasPoint.x - localPoint.x / nextZoom,
            y: canvasPoint.y - localPoint.y / nextZoom,
            zoom: nextZoom,
          })
          return
        }

        onPanViewport({
          ...viewport,
          x: viewport.x + screenDeltaToCanvas(event.deltaX, viewport.zoom),
          y: viewport.y + screenDeltaToCanvas(event.deltaY, viewport.zoom),
        })
      }}
      onDragEnter={(event) => {
        if (!hasFileDataTransfer(event.dataTransfer)) {
          return
        }

        event.preventDefault()
        fileDragDepthRef.current += 1

        if (!isFileDropActive) {
          setIsFileDropActive(true)
        }
      }}
      onDragOver={(event) => {
        if (!hasFileDataTransfer(event.dataTransfer)) {
          return
        }

        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'

        if (!isFileDropActive) {
          setIsFileDropActive(true)
        }
      }}
      onDragLeave={(event) => {
        if (!hasFileDataTransfer(event.dataTransfer)) {
          return
        }

        fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1)

        if (fileDragDepthRef.current === 0) {
          setIsFileDropActive(false)
        }
      }}
      onDrop={(event) => {
        if (!hasFileDataTransfer(event.dataTransfer)) {
          return
        }

        event.preventDefault()

        const files = getSupportedDroppedImageFiles(event.dataTransfer.files)

        resetFileDropState()

        if (files.length === 0) {
          onInvalidImageDrop()
          return
        }

        onDropImageFiles(
          files,
          screenPointToCanvas(
            getLocalPoint(event.clientX, event.clientY),
            viewport,
          ),
        )
      }}
      onPointerDown={(event) => {
        if (event.button === 2) {
          event.preventDefault()
          setCanvasInteraction('panning')

          const startPoint = { x: event.clientX, y: event.clientY }
          const startViewport = viewport
          let panFrameId: number | null = null
          let pendingPanEvent: PointerEvent | null = null

          const processPan = () => {
            panFrameId = null

            if (!pendingPanEvent) {
              return
            }

            const moveEvent = pendingPanEvent
            pendingPanEvent = null

            onPanViewport({
              ...startViewport,
              x:
                startViewport.x -
                screenDeltaToCanvas(
                  moveEvent.clientX - startPoint.x,
                  startViewport.zoom,
                ),
              y:
                startViewport.y -
                screenDeltaToCanvas(
                  moveEvent.clientY - startPoint.y,
                  startViewport.zoom,
                ),
            })
          }

          const handleMove = (moveEvent: PointerEvent) => {
            pendingPanEvent = moveEvent

            if (panFrameId === null) {
              panFrameId = requestAnimationFrame(processPan)
            }
          }

          const cleanup = () => {
            if (panFrameId !== null) {
              cancelAnimationFrame(panFrameId)
            }

            setCanvasInteraction('idle')
            window.removeEventListener('pointermove', handleMove)
            window.removeEventListener('pointerup', cleanup)
          }

          window.addEventListener('pointermove', handleMove)
          window.addEventListener('pointerup', cleanup, { once: true })
          return
        }

        if (
          formatPainter &&
          event.button === 0 &&
          event.target === event.currentTarget
        ) {
          event.preventDefault()
          onClearSelection()
          clearFormatPainter()
          setCanvasInteraction('idle')
          setSelectionMarquee(null)
          return
        }

        if (
          event.button !== 0 ||
          interactionMode !== 'edit' ||
          event.target !== event.currentTarget
        ) {
          return
        }

        event.preventDefault()
        onClearSelection()
        setCanvasInteraction('selecting')

        const startLocalPoint = getLocalPoint(event.clientX, event.clientY)
        const startCanvasPoint = screenPointToCanvas(startLocalPoint, viewport)

        setSelectionMarquee({
          left: startLocalPoint.x,
          top: startLocalPoint.y,
          width: 0,
          height: 0,
        })

        let marqueeFrameId: number | null = null
        let pendingMoveEvent: PointerEvent | null = null

        const processMarquee = () => {
          marqueeFrameId = null

          if (!pendingMoveEvent) {
            return
          }

          const moveEvent = pendingMoveEvent
          pendingMoveEvent = null

          const currentLocalPoint = getLocalPoint(
            moveEvent.clientX,
            moveEvent.clientY,
          )

          setSelectionMarquee(
            createSelectionMarquee(startLocalPoint, currentLocalPoint),
          )
        }

        const handleMove = (moveEvent: PointerEvent) => {
          pendingMoveEvent = moveEvent

          if (marqueeFrameId === null) {
            marqueeFrameId = requestAnimationFrame(processMarquee)
          }
        }

        const handlePointerUp = (upEvent: PointerEvent) => {
          const endCanvasPoint = screenPointToCanvas(
            getLocalPoint(upEvent.clientX, upEvent.clientY),
            viewport,
          )
          const selectionRect = createCanvasRect(
            startCanvasPoint,
            endCanvasPoint,
          )
          const rootGroupIds = getRootSelectedGroupIds(
            visibleGroups,
            getFullyEnclosedGroupIds(selectionRect),
          )
          const selectedGroupSubtree = getSelectedGroupSubtree({
            cards: visibleCards,
            groups: visibleGroups,
            selectedGroupIds: rootGroupIds,
          })
          const selectedGroupCardIdSet = new Set(selectedGroupSubtree.cardIds)

          onSelectSelection({
            cardIds: getFullyEnclosedCardIds(selectionRect).filter(
              (cardId) => !selectedGroupCardIdSet.has(cardId),
            ),
            groupIds: rootGroupIds,
            pictureIds: [],
          })
          cleanup()
        }

        const cleanup = () => {
          if (marqueeFrameId !== null) {
            cancelAnimationFrame(marqueeFrameId)
            marqueeFrameId = null
          }

          setCanvasInteraction('idle')
          setSelectionMarquee(null)
          window.removeEventListener('pointermove', handleMove)
          window.removeEventListener('pointerup', handlePointerUp)
        }

        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handlePointerUp, { once: true })
      }}
      style={placementGuide.gridVisible ? gridStyle : undefined}
    >
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
      {culledPictures.map((picture) => (
        <PictureNode
          key={picture.id}
          picture={picture}
          guide={placementGuide}
          isSelected={selectedPictureIdSet.has(picture.id)}
          interactionMode={interactionMode}
          viewport={viewport}
        />
      ))}
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
