import { useSyncExternalStore } from 'react'

/**
 * Device-level setting for the optional card effects (html-in-canvas +
 * three.js). Stored in localStorage, not in the workspace, because it depends
 * on the browser (flag support, GPU) rather than on the content.
 */
export const CANVAS_EFFECTS_STORAGE_KEY = 'linkhub.canvasEffects'

const listeners = new Set<() => void>()

export function readCanvasEffectsEnabled() {
  try {
    return window.localStorage.getItem(CANVAS_EFFECTS_STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export function setCanvasEffectsEnabled(enabled: boolean) {
  try {
    if (enabled) {
      window.localStorage.setItem(CANVAS_EFFECTS_STORAGE_KEY, 'on')
    } else {
      window.localStorage.removeItem(CANVAS_EFFECTS_STORAGE_KEY)
    }
  } catch {
    // Storage unavailable: keep the in-memory notification only.
  }

  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  const onStorage = (event: StorageEvent) => {
    if (event.key === CANVAS_EFFECTS_STORAGE_KEY) {
      listener()
    }
  }
  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useCanvasEffectsEnabled() {
  return useSyncExternalStore(subscribe, readCanvasEffectsEnabled, () => false)
}
