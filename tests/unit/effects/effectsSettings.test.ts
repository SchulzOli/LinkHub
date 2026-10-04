import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  CANVAS_EFFECTS_STORAGE_KEY,
  isHtmlInCanvasSupported,
  readCanvasEffectsEnabled,
  setCanvasEffectsEnabled,
  useCanvasEffectsEnabled,
} from '../../../src/effects'

describe('card effects setting', () => {
  afterEach(() => {
    window.localStorage.removeItem(CANVAS_EFFECTS_STORAGE_KEY)
  })

  it('is off by default', () => {
    expect(readCanvasEffectsEnabled()).toBe(false)
  })

  it('persists the key and notifies subscribers', () => {
    const { result } = renderHook(() => useCanvasEffectsEnabled())
    expect(result.current).toBe(false)

    act(() => setCanvasEffectsEnabled(true))
    expect(window.localStorage.getItem(CANVAS_EFFECTS_STORAGE_KEY)).toBe('on')
    expect(result.current).toBe(true)

    act(() => setCanvasEffectsEnabled(false))
    expect(window.localStorage.getItem(CANVAS_EFFECTS_STORAGE_KEY)).toBeNull()
    expect(result.current).toBe(false)
  })

  it('reports html-in-canvas as unsupported without the browser flag', () => {
    expect(isHtmlInCanvasSupported()).toBe(false)
  })
})
