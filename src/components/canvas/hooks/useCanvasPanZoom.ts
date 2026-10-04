import { useCallback } from 'react'

import type { Viewport } from '../../../contracts/workspace'
import {
  getWheelZoom,
  panByScreenDelta,
  zoomAtScreenPoint,
} from '../../../engine/camera'
import { isCanvasBackgroundTarget } from '../../../engine/react/canvasBackground'
import type { InteractionMode } from '../../../state/workspaceStoreTypes'

type CanvasInteractionState = 'idle' | 'panning' | 'selecting'

export type UseCanvasPanZoomArgs = {
  canvasRef: React.RefObject<HTMLDivElement | null>
  viewport: Viewport
  interactionMode: InteractionMode
  onPanViewport: (nextViewport: Viewport) => void
  onInteractionChange?: (interaction: CanvasInteractionState) => void
}

export function useCanvasPanZoom({
  canvasRef,
  viewport,
  interactionMode,
  onPanViewport,
  onInteractionChange,
}: UseCanvasPanZoomArgs) {
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

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (interactionMode === 'edit' || isCanvasBackgroundTarget(event)) {
        event.preventDefault()
      }
    },
    [interactionMode],
  )

  const handleWheel = useCallback(
    (event: WheelEvent | React.WheelEvent<HTMLElement>) => {
      event.preventDefault()

      const localPoint = getLocalPoint(event.clientX, event.clientY)

      if (event.altKey) {
        onPanViewport(
          panByScreenDelta(viewport, -(event.deltaY + event.deltaX), 0),
        )
        return
      }

      if (!event.ctrlKey) {
        const nextViewport = zoomAtScreenPoint(
          viewport,
          localPoint,
          getWheelZoom(viewport.zoom, event.deltaY),
        )

        if (nextViewport !== viewport) {
          onPanViewport(nextViewport)
        }
        return
      }

      onPanViewport(panByScreenDelta(viewport, -event.deltaX, -event.deltaY))
    },
    [getLocalPoint, onPanViewport, viewport],
  )

  const handleRightClickPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 2) {
        return
      }

      event.preventDefault()
      onInteractionChange?.('panning')

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

        onPanViewport(
          panByScreenDelta(
            startViewport,
            moveEvent.clientX - startPoint.x,
            moveEvent.clientY - startPoint.y,
          ),
        )
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

        onInteractionChange?.('idle')
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', cleanup)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', cleanup, { once: true })
    },
    [onInteractionChange, onPanViewport, viewport],
  )

  return {
    handleContextMenu,
    handleWheel,
    /** Only handles right-click (button === 2). Return early otherwise. */
    handleRightClickPointerDown,
    getLocalPoint,
  }
}
