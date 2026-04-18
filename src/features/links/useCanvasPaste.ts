import { useEffect } from 'react'

type PasteHookOptions = {
  onText: (text: string) => void
  getFallbackText?: () => string | null
}

export function useCanvasPaste({ onText, getFallbackText }: PasteHookOptions) {
  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent | Event) => {
      const target = event.target

      if (target instanceof HTMLElement && target.closest('input, textarea')) {
        return
      }

      const clipboardEvent = event instanceof ClipboardEvent ? event : undefined

      let pastedText = clipboardEvent?.clipboardData?.getData('text')?.trim()

      if (!pastedText && navigator.clipboard?.readText) {
        try {
          pastedText = (await navigator.clipboard.readText()).trim()
        } catch {
          pastedText = ''
        }
      }

      if (!pastedText) {
        pastedText = getFallbackText?.()?.trim() ?? ''
      }

      if (!pastedText) {
        return
      }

      onText(pastedText)
    }

    window.addEventListener('paste', handlePaste)

    return () => window.removeEventListener('paste', handlePaste)
  }, [getFallbackText, onText])
}
