import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cancelLinkChecks,
  checkLinks,
} from '../../../../src/features/links/linkChecker'

describe('link checker cancellation', () => {
  const requested: string[] = []
  const signals: AbortSignal[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    requested.length = 0
    signals.length = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        requested.push(url)
        signals.push(init.signal as AbortSignal)
        // Never answers on its own; only an abort ends it.
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        })
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('stops queued requests, aborts the active one and reports nothing more', async () => {
    const onResult = vi.fn()
    const onComplete = vi.fn()

    checkLinks(
      [
        { cardId: 'a', url: 'https://same.example/one' },
        { cardId: 'b', url: 'https://same.example/two' },
      ],
      onResult,
      onComplete,
    )

    // One request per host at a time: only the first URL is in flight.
    expect(requested).toEqual(['https://same.example/one'])

    cancelLinkChecks()
    await vi.runAllTimersAsync()

    expect(signals[0].aborted).toBe(true)
    expect(requested).toEqual(['https://same.example/one'])
    expect(onResult).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
  })
})
