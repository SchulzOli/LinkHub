import { describe, expect, it } from 'vitest'

import { resolveSupportedImageUploadMimeType } from '../../../src/contracts/imageAsset'

describe('image asset mime type resolution', () => {
  it('keeps supported browser-provided image mime types', () => {
    expect(
      resolveSupportedImageUploadMimeType({
        filename: 'photo.png',
        mimeType: 'image/png',
      }),
    ).toBe('image/png')
  })

  it('falls back to the file extension when the mime type is missing', () => {
    expect(
      resolveSupportedImageUploadMimeType({
        filename: 'photo.PNG',
        mimeType: '',
      }),
    ).toBe('image/png')
  })

  it('normalizes image/jpg to image/jpeg', () => {
    expect(
      resolveSupportedImageUploadMimeType({
        filename: 'photo.jpg',
        mimeType: 'image/jpg',
      }),
    ).toBe('image/jpeg')
  })
})
