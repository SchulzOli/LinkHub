import { useCallback } from 'react'

import { screenDeltaToCanvas, screenPointToCanvas } from '../../../features/placement/canvasMath'
import type { Viewport } from '../../../contracts/workspace'
import type { InteractionMode } from '../../../state/workspaceStoreTypes'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.1

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
      if (
        interactionMode === 'edit' ||
        event.target === event.currentTarget
      ) {
        event.preventDefault()
      }
    },
    [interactionMode],
  )

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLElement>) => {
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
