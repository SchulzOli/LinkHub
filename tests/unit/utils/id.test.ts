import { afterEach, describe, expect, it, vi } from 'vitest'

import { createId } from '../../../src/utils/id'

describe('createId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '11111111-2222-3333-4444-555555555555',
    })

    expect(createId()).toBe('11111111-2222-3333-4444-555555555555')
  })

  it('falls back to a time-based id when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {})

    const id = createId()

    expect(id).toMatch(/^id-\d+-[0-9a-f]+$/)
  })

  it('returns a unique id across successive fallback calls', () => {
    vi.stubGlobal('crypto', {})

    const first = createId()
    const second = createId()

    expect(first).not.toBe(second)
  })
})
