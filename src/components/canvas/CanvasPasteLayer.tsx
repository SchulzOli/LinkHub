import { useCallback } from 'react'

import { useCanvasPaste } from '../../features/links/useCanvasPaste'

type CanvasPasteLayerProps = {
  onText: (text: string) => void
  getFallbackText?: () => string | null
}

export function CanvasPasteLayer({
  onText,
  getFallbackText,
}: CanvasPasteLayerProps) {
  const handleText = useCallback(
    (text: string) => {
      onText(text)
    },
    [onText],
  )

  useCanvasPaste({ onText: handleText, getFallbackText })

  return null
}
