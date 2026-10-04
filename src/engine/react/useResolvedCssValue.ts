import { useSyncExternalStore } from 'react'

/**
 * Resolves a CSS value that may contain `var(--token)` references against
 * the document root and re-resolves whenever root styles/theme attributes
 * change (themes write their tokens onto `document.documentElement`).
 */
export function useResolvedCssValue(value: string) {
  return useSyncExternalStore(
    subscribeToRootStyle,
    () => resolveCssValue(value),
    () => value,
  )
}

function subscribeToRootStyle(onChange: () => void) {
  if (typeof MutationObserver === 'undefined') {
    return () => undefined
  }

  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style', 'class', 'data-theme-mode', 'data-style-preset'],
  })

  return () => observer.disconnect()
}

const VAR_PATTERN = /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g

export function resolveCssValue(value: string, depth = 0): string {
  if (!value.includes('var(') || depth > 8) {
    return value
  }

  const rootStyle = getComputedStyle(document.documentElement)

  return resolveCssValue(
    value.replace(VAR_PATTERN, (_match, name: string, fallback?: string) => {
      const resolved = rootStyle.getPropertyValue(name).trim()
      return resolved || fallback?.trim() || ''
    }),
    depth + 1,
  )
}
