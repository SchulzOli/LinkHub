import { useCallback, useState } from 'react'

import { getGroupLayoutSize, type CardGroup } from '../../../contracts/cardGroup'
import type { LinkCard } from '../../../contracts/linkCard'
import { getCardPixelDimensions } from '../../../features/appearance/themeTokens'
import {
  getRootSelectedGroupIds,
  getSelectedGroupSubtree,
} from '../../../features/groups/groupLayout'
import { screenPointToCanvas } from '../../../features/placement/canvasMath'
import type { Viewport } from '../../../contracts/workspace'
import type { InteractionMode } from '../../../state/useWorkspaceStore'
import type { FormatPainterPayload } from '../../../features/appearance/formatPainter'

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

export type UseMarqueeSelectionArgs = {
  canvasRef: React.RefObject<HTMLDivElement | null>
  viewport: Viewport
  interactionMode: InteractionMode
  formatPainter: FormatPainterPayload | null
  onClearSelection: () => void
  clearFormatPainter: () => void
  onSelectSelection: (selection: {
    cardIds: string[]
    groupIds: string[]
    pictureIds: string[]
  }) => void
  visibleCards: LinkCard[]
  visibleGroups: CardGroup[]
  gridSize: number
}

function createSelectionMarquee(
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number },
): SelectionMarquee {
  return {
    left: Math.min(startPoint.x, endPoint.x),
    top: Math.min(startPoint.y, endPoint.y),
    width: Math.abs(endPoint.x - startPoint.x),
    height: Math.abs(endPoint.y - startPoint.y),
  }
}

function createCanvasRect(
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number },
): CanvasRect {
  return {
    left: Math.min(startPoint.x, endPoint.x),
    top: Math.min(startPoint.y, endPoint.y),
    right: Math.max(startPoint.x, endPoint.x),
    bottom: Math.max(startPoint.y, endPoint.y),
  }
}

function getFullyEnclosedCardIds(
  cards: LinkCard[],
  selectionRect: CanvasRect,
  gridSize: number,
) {
  return cards
    .filter((card) => {
      const size = getCardPixelDimensions(card.size, gridSize)
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
}

function getFullyEnclosedGroupIds(
  groups: CardGroup[],
  selectionRect: CanvasRect,
  gridSize: number,
) {
  return groups
    .filter((group) => {
      const size = getCardPixelDimensions(getGroupLayoutSize(group), gridSize)
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
}

export function useMarqueeSelection({
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
}: UseMarqueeSelectionArgs) {
  const [canvasInteraction, setCanvasInteraction] =
    useState<CanvasInteractionState>('idle')
  const [selectionMarquee, setSelectionMarquee] =
    useState<SelectionMarquee | null>(null)

  const getLocalPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect()

      return {
        x: clientX - (rect?.left ?? 0),
        y: clientY - (rect?.top ?? 0),
      }
    },
    [canvasRef],
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      // Format painter: clicking the canvas background clears it.
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
        const enclosedGroupIds = getFullyEnclosedGroupIds(
          visibleGroups,
          selectionRect,
          gridSize,
        )
        const rootGroupIds = getRootSelectedGroupIds(
          visibleGroups,
          enclosedGroupIds,
        )
        const selectedGroupSubtree = getSelectedGroupSubtree({
          cards: visibleCards,
          groups: visibleGroups,
          selectedGroupIds: rootGroupIds,
        })
        const selectedGroupCardIdSet = new Set(selectedGroupSubtree.cardIds)

        onSelectSelection({
          cardIds: getFullyEnclosedCardIds(
            visibleCards,
            selectionRect,
            gridSize,
          ).filter((cardId) => !selectedGroupCardIdSet.has(cardId)),
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
    },
    [
      clearFormatPainter,
      formatPainter,
      getLocalPoint,
      gridSize,
      interactionMode,
      onClearSelection,
      onSelectSelection,
      viewport,
      visibleCards,
      visibleGroups,
    ],
  )

  return {
    handlePointerDown,
    canvasInteraction,
    selectionMarquee,
  }
}