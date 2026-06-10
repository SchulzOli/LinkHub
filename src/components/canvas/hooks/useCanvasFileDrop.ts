import { useCallback, useRef, useState } from 'react'

import {
  getSupportedDroppedImageFiles,
  hasFileDataTransfer,
} from '../../../features/images/imageDrop'
import { screenPointToCanvas } from '../../../features/placement/canvasMath'
import type { Viewport } from '../../../contracts/workspace'

export type UseCanvasFileDropArgs = {
  canvasRef: React.RefObject<HTMLDivElement | null>
  viewport: Viewport
  onDropImageFiles: (
    files: File[],
    canvasPosition: { x: number; y: number },
  ) => void
  onInvalidImageDrop: () => void
}

export function useCanvasFileDrop({
  canvasRef,
  viewport,
  onDropImageFiles,
  onInvalidImageDrop,
}: UseCanvasFileDropArgs) {
  const fileDragDepthRef = useRef(0)
  const [isFileDropActive, setIsFileDropActive] = useState(false)

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

  const resetFileDropState = useCallback(() => {
    fileDragDepthRef.current = 0
    setIsFileDropActive(false)
  }, [])

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!hasFileDataTransfer(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      fileDragDepthRef.current += 1

      if (!isFileDropActive) {
        setIsFileDropActive(true)
      }
    },
    [isFileDropActive],
  )

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!hasFileDataTransfer(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'

      if (!isFileDropActive) {
        setIsFileDropActive(true)
      }
    },
    [isFileDropActive],
  )

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!hasFileDataTransfer(event.dataTransfer)) {
        return
      }

      fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1)

      if (fileDragDepthRef.current === 0) {
        setIsFileDropActive(false)
      }
    },
    [],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
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
    },
    [getLocalPoint, onDropImageFiles, onInvalidImageDrop, resetFileDropState, viewport],
  )

  return {
    isFileDropActive,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}
