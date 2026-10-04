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

  it('opens beside the anchor when it fits neither above nor below', () => {
    const anchor = { left: 400, top: 250, bottom: 430, width: 200 }
    const base = {
      anchorGap: 12,
      anchorRect: anchor,
      bottomBoundary: 692,
      overlayRect: { width: 320, height: 600 },
      topBoundary: 8,
      viewportPadding: 8,
    }

    expect(
      getAnchoredOverlayPosition({ ...base, viewportWidth: 1400 }),
    ).toEqual({
      left: 612,
      // As close to the anchor top as the 600px panel allows.
      top: 92,
      maxHeight: 684,
      placement: 'right',
    })
    // No room on the right: falls back to the left side.
    expect(
      getAnchoredOverlayPosition({
        ...base,
        anchorRect: { ...anchor, left: 1000 },
        viewportWidth: 1400,
      }),
    ).toMatchObject({ left: 668, placement: 'left' })
  })
})
