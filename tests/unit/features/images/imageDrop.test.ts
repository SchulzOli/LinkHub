import { describe, expect, it } from 'vitest'

import {
  getSupportedDroppedImageFiles,
  hasFileDataTransfer,
} from '../../../../src/features/images/imageDrop'

describe('image drop', () => {
  it('detects file-based drag payloads', () => {
    expect(
      hasFileDataTransfer({
        types: ['Files'],
      }),
    ).toBe(true)

    expect(
      hasFileDataTransfer({
        types: ['text/plain'],
      }),
    ).toBe(false)

    expect(
      hasFileDataTransfer({
        types: ['application/x-moz-file'],
      }),
    ).toBe(true)
  })

  it('keeps only supported image files from a drop payload', () => {
    const imageFile = new File(['image'], 'photo.png', {
      type: 'image/png',
    })
    const extensionOnlyImageFile = new File(['image'], 'photo.webp', {
      type: '',
    })
    const textFile = new File(['note'], 'note.txt', {
      type: 'text/plain',
    })

    expect(
      getSupportedDroppedImageFiles([
        imageFile,
        extensionOnlyImageFile,
        textFile,
      ]),
    ).toEqual([imageFile, extensionOnlyImageFile])
  })
})
