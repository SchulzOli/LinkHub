import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Ensure URL.createObjectURL/revokeObjectURL exist before the module under test is imported.
if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: () => 'blob:mock',
    writable: true,
  })
}
if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: () => undefined,
    writable: true,
  })
}

const blobs = new Map<string, Blob>()
const thumbnails = new Map<string, Blob | null>()

vi.mock('../../../../src/storage/imageRepository', () => ({
  getImageBlob: vi.fn(async (imageId: string) => blobs.get(imageId) ?? null),
  getImageThumbnailBlob: vi.fn(
    async (imageId: string) => thumbnails.get(imageId) ?? null,
  ),
}))

import {
  acquireImageObjectUrl,
  invalidateImageObjectUrl,
  releaseImageObjectUrl,
} from '../../../../src/features/images/imageObjectUrlCache'

let createObjectURLSpy: ReturnType<typeof vi.spyOn>
let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>
let nextUrlId = 0

beforeEach(() => {
  blobs.clear()
  thumbnails.clear()
  nextUrlId = 0
  createObjectURLSpy = vi
    .spyOn(URL, 'createObjectURL')
    .mockImplementation(() => `blob:mock-${++nextUrlId}`)
  revokeObjectURLSpy = vi
    .spyOn(URL, 'revokeObjectURL')
    .mockImplementation(() => undefined)
})

afterEach(() => {
  createObjectURLSpy.mockRestore()
  revokeObjectURLSpy.mockRestore()
})

describe('imageObjectUrlCache', () => {
  it('shares a single object URL across multiple acquirers', async () => {
    blobs.set('img-1', new Blob(['full'], { type: 'image/png' }))
    thumbnails.set('img-1', new Blob(['thumb'], { type: 'image/png' }))

    const [firstUrl, secondUrl] = await Promise.all([
      acquireImageObjectUrl('img-1'),
      acquireImageObjectUrl('img-1'),
    ])

    expect(firstUrl).toBe('blob:mock-1')
    expect(secondUrl).toBe('blob:mock-1')
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
  })

  it('falls back to the full blob when no thumbnail is available', async () => {
    blobs.set('img-2', new Blob(['full'], { type: 'image/png' }))

    const url = await acquireImageObjectUrl('img-2')

    expect(url).toBe('blob:mock-1')
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
  })

  it('loads the full variant directly when requested', async () => {
    blobs.set('img-3', new Blob(['full'], { type: 'image/png' }))

    const url = await acquireImageObjectUrl('img-3', 'full')

    expect(url).toBe('blob:mock-1')
  })

  it('returns null when neither blob exists', async () => {
    const url = await acquireImageObjectUrl('missing')

    expect(url).toBeNull()
    expect(createObjectURLSpy).not.toHaveBeenCalled()
  })

  it('revokes the URL only when the last reference is released', async () => {
    blobs.set('img-4', new Blob(['full'], { type: 'image/png' }))

    await acquireImageObjectUrl('img-4', 'full')
    await acquireImageObjectUrl('img-4', 'full')

    releaseImageObjectUrl('img-4', 'full')
    expect(revokeObjectURLSpy).not.toHaveBeenCalled()

    releaseImageObjectUrl('img-4', 'full')
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1)
  })

  it('is safe to release an entry that was never acquired', () => {
    expect(() => releaseImageObjectUrl('nope')).not.toThrow()
  })

  it('invalidates both thumbnail and full variants in one call', async () => {
    blobs.set('img-5', new Blob(['full'], { type: 'image/png' }))
    thumbnails.set('img-5', new Blob(['thumb'], { type: 'image/png' }))

    await acquireImageObjectUrl('img-5', 'thumbnail')
    await acquireImageObjectUrl('img-5', 'full')

    invalidateImageObjectUrl('img-5')

    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(2)

    // After invalidation, re-acquiring yields a fresh URL.
    const reacquired = await acquireImageObjectUrl('img-5', 'full')
    expect(reacquired).toBe('blob:mock-3')
  })
})
