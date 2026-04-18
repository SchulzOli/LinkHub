import { describe, expect, it } from 'vitest'

import { getAnchoredOverlayPosition } from '../../../../src/features/placement/overlayPlacement'

describe('overlayPlacement', () => {
  it('centers overlays below the anchor when there is enough room', () => {
    const position = getAnchoredOverlayPosition({
      anchorGap: 12,
      anchorRect: {
        left: 120,
        top: 140,
        bottom: 220,
        width: 96,
      },
      bottomBoundary: 692,
      overlayRect: {
        width: 240,
        height: 180,
      },
      topBoundary: 8,
      viewportPadding: 8,
      viewportWidth: 390,
    })

    expect(position).toEqual({
      left: 48,
      top: 232,
      maxHeight: 460,
      placement: 'below',
    })
  })

  it('moves the overlay above the anchor when below space is insufficient', () => {
    const position = getAnchoredOverlayPosition({
      anchorGap: 12,
      anchorRect: {
        left: 120,
        top: 420,
        bottom: 520,
        width: 96,
      },
      bottomBoundary: 692,
      overlayRect: {
        width: 240,
        height: 180,
      },
      topBoundary: 8,
      viewportPadding: 8,
      viewportWidth: 390,
    })

    expect(position).toEqual({
      left: 48,
      top: 228,
      maxHeight: 400,
      placement: 'above',
    })
  })

  it('shrinks the overlay into the larger free side instead of overlapping the anchor', () => {
    const position = getAnchoredOverlayPosition({
      anchorGap: 12,
      anchorRect: {
        left: 120,
        top: 250,
        bottom: 430,
        width: 96,
      },
      bottomBoundary: 692,
      overlayRect: {
        width: 240,
        height: 320,
      },
      topBoundary: 8,
      viewportPadding: 8,
      viewportWidth: 390,
    })

    expect(position).toEqual({
      left: 48,
      top: 442,
      maxHeight: 250,
      placement: 'below',
    })
  })
})
