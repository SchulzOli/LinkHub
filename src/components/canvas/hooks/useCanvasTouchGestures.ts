import { useEffect, useRef } from 'react'

import type { Viewport } from '../../../contracts/workspace'
import { panByScreenDelta } from '../../../engine/camera'
import { isCanvasBackgroundTarget } from '../../../engine/react/canvasBackground'
import {
  distance,
  DOUBLE_TAP_DISTANCE,
  DOUBLE_TAP_MS,
  doubleTapViewport,
  midpoint,
  pinchViewport,
  TOUCH_TAP_SLOP,
} from '../../../engine/touchGestures'
import type { InteractionMode } from '../../../state/workspaceStoreTypes'

type Point = { x: number; y: number }

type Gesture =
  | { kind: 'none' }
  /** One finger down; becomes a pan once it moves past the tap slop. */
  | { kind: 'pending'; pointerId: number; start: Point; at: number }
  | { kind: 'pan'; pointerId: number; start: Point; viewport: Viewport }
  | {
      kind: 'pinch'
      viewport: Viewport
      startMidpoint: Point
      startDistance: number
    }

export type UseCanvasTouchGesturesArgs = {
  canvasRef: React.RefObject<HTMLDivElement | null>
  viewport: Viewport
  interactionMode: InteractionMode
  onPanViewport: (nextViewport: Viewport) => void
}

/**
 * Touch gestures for the canvas (phones and tablets); mouse and pen keep
 * their own handling:
 *
 * - one finger on empty canvas pans (in view mode also on cards and groups,
 *   so a tap still opens the link but a drag scrolls the board)
 * - two fingers pinch to zoom and pan, wherever they land
 * - a double tap on empty canvas zooms in, or back to 100 %
 *
 * Listeners run in the capture phase, before cards and the marquee see the
 * events, so a gesture never also drags a card or opens a link.
 */
export function useCanvasTouchGestures({
  canvasRef,
  viewport,
  interactionMode,
  onPanViewport,
}: UseCanvasTouchGesturesArgs) {
  const viewportRef = useRef(viewport)
  const modeRef = useRef(interactionMode)
  const onPanRef = useRef(onPanViewport)

  useEffect(() => {
    viewportRef.current = viewport
    modeRef.current = interactionMode
    onPanRef.current = onPanViewport
  }, [interactionMode, onPanViewport, viewport])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const pointers = new Map<number, Point>()
    let gesture: Gesture = { kind: 'none' }
    let lastTap: { at: number; point: Point } | null = null
    let suppressClickUntil = 0
    let frame: number | null = null
    let pendingViewport: Viewport | null = null

    const local = (event: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect()

      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const applyViewport = (next: Viewport) => {
      pendingViewport = next

      if (frame === null) {
        frame = requestAnimationFrame(() => {
          frame = null

          if (pendingViewport) {
            onPanRef.current(pendingViewport)
            pendingViewport = null
          }
        })
      }
    }

    const startPinch = () => {
      const [a, b] = [...pointers.values()]

      gesture = {
        kind: 'pinch',
        viewport: pendingViewport ?? viewportRef.current,
        startMidpoint: midpoint(a, b),
        startDistance: distance(a, b),
      }
    }

    const startPan = (pointerId: number, point: Point) => {
      gesture = {
        kind: 'pan',
        pointerId,
        start: point,
        viewport: pendingViewport ?? viewportRef.current,
      }
    }

    /** Where one finger may start a pan (anything else keeps its touch). */
    const canPanFrom = (event: PointerEvent) => {
      if (
        isCanvasBackgroundTarget({
          target: event.target,
          currentTarget: canvas,
        })
      ) {
        return true
      }

      if (modeRef.current !== 'view' || !(event.target instanceof Element)) {
        return false
      }

      const entity = event.target.closest('[data-entity-kind]')

      return (
        entity?.getAttribute('data-entity-kind') === 'card' ||
        entity?.getAttribute('data-entity-kind') === 'group'
      )
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') {
        return
      }

      const point = local(event)

      pointers.set(event.pointerId, point)

      if (pointers.size === 2) {
        // Second finger: pinch, whatever the first one was doing.
        event.preventDefault()
        event.stopPropagation()
        startPinch()
        return
      }

      if (pointers.size > 2 || !canPanFrom(event)) {
        return
      }

      const onBackground = isCanvasBackgroundTarget({
        target: event.target,
        currentTarget: canvas,
      })

      if (onBackground) {
        // Empty canvas: no marquee on touch; this finger pans.
        event.preventDefault()
        event.stopPropagation()
      }

      gesture = {
        kind: 'pending',
        pointerId: event.pointerId,
        start: point,
        at: event.timeStamp,
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !pointers.has(event.pointerId)) {
        return
      }

      const point = local(event)

      pointers.set(event.pointerId, point)

      if (gesture.kind === 'pinch' && pointers.size >= 2) {
        const [a, b] = [...pointers.values()]

        event.stopPropagation()
        applyViewport(
          pinchViewport(
            gesture.viewport,
            gesture.startMidpoint,
            gesture.startDistance,
            midpoint(a, b),
            distance(a, b),
          ),
        )
        return
      }

      if (
        gesture.kind === 'pending' &&
        gesture.pointerId === event.pointerId &&
        distance(point, gesture.start) > TOUCH_TAP_SLOP
      ) {
        startPan(event.pointerId, gesture.start)
      }

      if (gesture.kind === 'pan' && gesture.pointerId === event.pointerId) {
        event.stopPropagation()
        applyViewport(
          panByScreenDelta(
            gesture.viewport,
            point.x - gesture.start.x,
            point.y - gesture.start.y,
          ),
        )
      }
    }

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !pointers.has(event.pointerId)) {
        return
      }

      const point = pointers.get(event.pointerId) as Point

      pointers.delete(event.pointerId)

      if (gesture.kind === 'pinch' || gesture.kind === 'pan') {
        // The lifted finger shouldn't also tap whatever is under it.
        suppressClickUntil = event.timeStamp + 400

        if (gesture.kind === 'pinch' && pointers.size === 1) {
          // One finger left: keep panning with it.
          const [[pointerId, remaining]] = [...pointers.entries()]

          startPan(pointerId, remaining)
          return
        }

        if (pointers.size === 0) {
          gesture = { kind: 'none' }
        }
        return
      }

      if (gesture.kind === 'pending' && event.type === 'pointerup') {
        const onBackground = isCanvasBackgroundTarget({
          target: event.target,
          currentTarget: canvas,
        })

        if (
          onBackground &&
          lastTap &&
          event.timeStamp - lastTap.at < DOUBLE_TAP_MS &&
          distance(point, lastTap.point) < DOUBLE_TAP_DISTANCE
        ) {
          lastTap = null
          onPanRef.current(doubleTapViewport(viewportRef.current, point))
        } else {
          lastTap = onBackground ? { at: event.timeStamp, point } : null
        }
      }

      if (pointers.size === 0) {
        gesture = { kind: 'none' }
      }
    }

    const handleClick = (event: MouseEvent) => {
      if (event.timeStamp < suppressClickUntil) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    canvas.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('pointermove', handlePointerMove, true)
    window.addEventListener('pointerup', handlePointerEnd, true)
    window.addEventListener('pointercancel', handlePointerEnd, true)
    canvas.addEventListener('click', handleClick, true)

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame)
      }

      canvas.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('pointermove', handlePointerMove, true)
      window.removeEventListener('pointerup', handlePointerEnd, true)
      window.removeEventListener('pointercancel', handlePointerEnd, true)
      canvas.removeEventListener('click', handleClick, true)
    }
  }, [canvasRef])
}
