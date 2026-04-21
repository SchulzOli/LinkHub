import { useCallback, useEffect, useRef } from 'react'

import { CARD_SIZE_LIMITS, type CardSize } from '../../contracts/linkCard'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type { Viewport } from '../../contracts/workspace'
import { screenDeltaToCanvas } from './canvasMath'
import type {
  DragPreview,
  PlaceableItem,
  PlacementBlockPredicate,
} from './placementTypes'
import { isPlacementAvailable } from './snapEngine'

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

type ResizeFrame = {
  position: { x: number; y: number }
  size: CardSize
}

type ResizeOptions = {
  card: PlaceableItem
  /**
   * Called lazily at pointerdown time to produce the placement-neighborhood
   * snapshot. Using a getter keeps sibling nodes from re-rendering on every
   * workspace change — see `useDragPlacement`.
   */
  getCards: () => PlaceableItem[]
  enabled: boolean
  guide: PlacementGuide
  isOccupiedItemBlocking?: PlacementBlockPredicate
  sizeLimits?: {
    min: number
    max?: number
  }
  viewport: Viewport
  onResize: (cardId: string, frame: ResizeFrame) => void
  onPreviewChange: (preview: DragPreview | null) => void
}

function clampSize(
  value: number,
  limits: {
    min: number
    max?: number
  },
) {
  const clampedValue = Math.max(limits.min, value)

  return typeof limits.max === 'number'
    ? Math.min(limits.max, clampedValue)
    : clampedValue
}

function createResizeFrame(
  card: PlaceableItem,
  direction: ResizeDirection,
  delta: { x: number; y: number },
  gridSize: number,
  sizeLimits: {
    min: number
    max?: number
  },
): ResizeFrame {
  const startLeft = Math.round(card.positionX / gridSize)
  const startTop = Math.round(card.positionY / gridSize)
  const startRight = startLeft + card.size.columns
  const startBottom = startTop + card.size.rows

  let left = startLeft
  let top = startTop
  let right = startRight
  let bottom = startBottom

  if (direction.includes('e')) {
    const nextRight = Math.round(
      (card.positionX + card.size.columns * gridSize + delta.x) / gridSize,
    )
    const width = clampSize(nextRight - startLeft, sizeLimits)
    right = startLeft + width
  }

  if (direction.includes('w')) {
    const nextLeft = Math.round((card.positionX + delta.x) / gridSize)
    const width = clampSize(startRight - nextLeft, sizeLimits)
    left = startRight - width
  }

  if (direction.includes('s')) {
    const nextBottom = Math.round(
      (card.positionY + card.size.rows * gridSize + delta.y) / gridSize,
    )
    const height = clampSize(nextBottom - startTop, sizeLimits)
    bottom = startTop + height
  }

  if (direction.includes('n')) {
    const nextTop = Math.round((card.positionY + delta.y) / gridSize)
    const height = clampSize(startBottom - nextTop, sizeLimits)
    top = startBottom - height
  }

  return {
    position: {
      x: left * gridSize,
      y: top * gridSize,
    },
    size: {
      columns: right - left,
      rows: bottom - top,
    },
  }
}

function isSameFrame(left: ResizeFrame, right: ResizeFrame) {
  return (
    left.position.x === right.position.x &&
    left.position.y === right.position.y &&
    left.size.columns === right.size.columns &&
    left.size.rows === right.size.rows
  )
}

export function useResizePlacement({
  card,
  getCards,
  enabled,
  guide,
  isOccupiedItemBlocking,
  sizeLimits = CARD_SIZE_LIMITS,
  viewport,
  onResize,
  onPreviewChange,
}: ResizeOptions) {
  const getCardsRef = useRef(getCards)
  useEffect(() => {
    getCardsRef.current = getCards
  }, [getCards])

  return useCallback(
    (direction: ResizeDirection) =>
      (event: React.PointerEvent<HTMLElement>) => {
        if (!enabled || event.button !== 0) {
          return
        }

        event.preventDefault()
        event.stopPropagation()

        const startPoint = { x: event.clientX, y: event.clientY }
        const initialFrame: ResizeFrame = {
          position: { x: card.positionX, y: card.positionY },
          size: card.size,
        }
        let currentFrame = initialFrame
        const cards = getCardsRef.current()

        onPreviewChange({
          cardId: card.id,
          position: initialFrame.position,
          size: initialFrame.size,
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

          const delta = {
            x: screenDeltaToCanvas(
              moveEvent.clientX - startPoint.x,
              viewport.zoom,
            ),
            y: screenDeltaToCanvas(
              moveEvent.clientY - startPoint.y,
              viewport.zoom,
            ),
          }

          const nextFrame = createResizeFrame(
            card,
            direction,
            delta,
            guide.gridSize,
            sizeLimits,
          )

          if (
            !isPlacementAvailable(nextFrame.position, nextFrame.size, guide, {
              cards,
              excludedCardId: card.id,
              isOccupiedItemBlocking,
            })
          ) {
            return
          }

          if (!isSameFrame(currentFrame, nextFrame)) {
            currentFrame = nextFrame
            onPreviewChange({
              cardId: card.id,
              position: nextFrame.position,
              size: nextFrame.size,
            })
          }
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
          onResize(card.id, currentFrame)
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
          onPreviewChange(null)
        }

        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handlePointerUp, { once: true })
      },
    [
      card,
      enabled,
      guide,
      isOccupiedItemBlocking,
      onPreviewChange,
      onResize,
      sizeLimits,
      viewport.zoom,
    ],
  )
}
