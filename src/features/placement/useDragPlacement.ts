import { useCallback } from 'react'

import type { CardSize } from '../../contracts/linkCard'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type { Viewport } from '../../contracts/workspace'
import { screenDeltaToCanvas } from './canvasMath'
import type {
  DragPreview,
  PlaceableItem,
  PlacementBlockPredicate,
} from './placementTypes'
import { getSnapTargetPosition } from './snapEngine'

type DragOptions = {
  cardId: string
  cardSize: CardSize
  position: { x: number; y: number }
  cards: PlaceableItem[]
  enabled: boolean
  guide: PlacementGuide
  isOccupiedItemBlocking?: PlacementBlockPredicate
  viewport: Viewport
  onMove: (cardId: string, position: { x: number; y: number }) => void
  onPreviewChange: (preview: DragPreview | null) => void
}

function isSamePosition(
  left: { x: number; y: number } | null,
  right: { x: number; y: number },
) {
  return left?.x === right.x && left?.y === right.y
}

function clampPositionAboveTaskbar(input: {
  guide: PlacementGuide
  position: { x: number; y: number }
  size: CardSize
  viewport: Viewport
}) {
  if (window.innerWidth > 768) {
    return input.position
  }

  const taskbar = document.querySelector<HTMLElement>(
    '[data-testid="bottom-taskbar"]',
  )

  if (!taskbar) {
    return input.position
  }

  const taskbarRect = taskbar.getBoundingClientRect()
  const bottomGap = 12
  const itemHeight = input.size.rows * input.guide.gridSize
  const maxScreenY =
    taskbarRect.top - bottomGap - itemHeight * input.viewport.zoom

  if (!Number.isFinite(maxScreenY)) {
    return input.position
  }

  const maxCanvasY = input.viewport.y + maxScreenY / input.viewport.zoom

  if (input.position.y <= maxCanvasY) {
    return input.position
  }

  return {
    ...input.position,
    y: maxCanvasY,
  }
}

export function useDragPlacement({
  cardId,
  cardSize,
  position,
  cards,
  enabled,
  guide,
  isOccupiedItemBlocking,
  viewport,
  onMove,
  onPreviewChange,
}: DragOptions) {
  return useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled) {
        return
      }

      if (event.button !== 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const startPoint = { x: event.clientX, y: event.clientY }
      const startPosition = position
      let currentPosition = startPosition
      let currentPreview = getSnapTargetPosition(
        startPosition,
        guide,
        cardSize,
        {
          cards,
          excludedCardId: cardId,
          isOccupiedItemBlocking,
        },
      )

      onPreviewChange({
        cardId,
        size: cardSize,
        position: currentPreview,
      })

      let moveFrameId: number | null = null
      let pendingMoveEvent: PointerEvent | null = null

      const processMove = () => {
        moveFrameId = null

        if (!pendingMoveEvent) {
          return
        }

        const moveEvent = pendingMoveEvent
        pendingMoveEvent = null

        const deltaX = screenDeltaToCanvas(
          moveEvent.clientX - startPoint.x,
          viewport.zoom,
        )
        const deltaY = screenDeltaToCanvas(
          moveEvent.clientY - startPoint.y,
          viewport.zoom,
        )

        const rawPosition = {
          x: startPosition.x + deltaX,
          y: startPosition.y + deltaY,
        }
        const constrainedPosition = clampPositionAboveTaskbar({
          guide,
          position: rawPosition,
          size: cardSize,
          viewport,
        })

        const nextPreview = getSnapTargetPosition(
          constrainedPosition,
          guide,
          cardSize,
          {
            cards,
            excludedCardId: cardId,
            isOccupiedItemBlocking,
          },
        )

        if (!isSamePosition(currentPreview, nextPreview)) {
          currentPreview = nextPreview
          onPreviewChange({
            cardId,
            size: cardSize,
            position: currentPreview,
          })
        }

        currentPosition = constrainedPosition

        onMove(cardId, currentPosition)
      }

      const handleMove = (moveEvent: PointerEvent) => {
        pendingMoveEvent = moveEvent

        if (moveFrameId === null) {
          moveFrameId = requestAnimationFrame(processMove)
        }
      }

      const handlePointerUp = () => {
        if (moveFrameId !== null) {
          cancelAnimationFrame(moveFrameId)
          moveFrameId = null
        }

        if (pendingMoveEvent) {
          processMove()
        }

        pendingMoveEvent = null
        onMove(cardId, currentPreview)
        onPreviewChange(null)
        cleanup()
      }

      const cleanup = () => {
        if (moveFrameId !== null) {
          cancelAnimationFrame(moveFrameId)
          moveFrameId = null
        }

        pendingMoveEvent = null
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handlePointerUp)
        window.removeEventListener('pointercancel', handlePointerUp)
        window.removeEventListener('mouseup', handlePointerUp)
        onPreviewChange(null)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointercancel', handlePointerUp, { once: true })
      window.addEventListener('mouseup', handlePointerUp, { once: true })
      window.addEventListener('pointerup', handlePointerUp, { once: true })
    },
    [
      cardId,
      cardSize,
      cards,
      enabled,
      guide,
      isOccupiedItemBlocking,
      onMove,
      onPreviewChange,
      position,
      viewport,
    ],
  )
}
