import { describe, expect, it } from 'vitest'

import {
  createPictureNode,
  getDefaultPictureNodeSize,
} from '../../../../src/features/images/pictureCreation'

describe('picture creation', () => {
  it('derives a landscape-oriented default size from image dimensions', () => {
    expect(getDefaultPictureNodeSize({ width: 1600, height: 900 })).toEqual({
      columns: 8,
      rows: 5,
    })
  })

  it('creates a picture node with a stable picture discriminator', () => {
    const picture = createPictureNode({
      image: {
        id: 'image-1',
        width: 900,
        height: 1600,
      },
      position: { x: 48, y: 96 },
    })

    expect(picture.type).toBe('picture')
    expect(picture.imageId).toBe('image-1')
    expect(picture.positionX).toBe(48)
    expect(picture.positionY).toBe(96)
    expect(picture.size.columns).toBeGreaterThanOrEqual(2)
    expect(picture.size.rows).toBeGreaterThanOrEqual(2)
  })
})
