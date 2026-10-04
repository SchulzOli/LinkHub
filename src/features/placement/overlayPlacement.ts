type OverlayPlacementSide = 'above' | 'below'
type OverlayPlacement = OverlayPlacementSide | 'right' | 'left'

type AnchorRect = {
  left: number
  top: number
  bottom: number
  width: number
}

type OverlayRect = {
  width: number
  height: number
}

type AnchoredOverlayPositionArgs = {
  anchorGap: number
  anchorRect: AnchorRect
  bottomBoundary: number
  overlayRect: OverlayRect
  preferredPlacement?: OverlayPlacementSide
  topBoundary: number
  viewportPadding: number
  viewportWidth: number
}

type AnchoredOverlayPosition = {
  left: number
  maxHeight: number
  placement: OverlayPlacement
  top: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function getAnchoredOverlayPosition({
  anchorGap,
  anchorRect,
  bottomBoundary,
  overlayRect,
  preferredPlacement = 'below',
  topBoundary,
  viewportPadding,
  viewportWidth,
}: AnchoredOverlayPositionArgs): AnchoredOverlayPosition {
  const alternatePlacement = preferredPlacement === 'above' ? 'below' : 'above'
  const availableSpace = {
    above: Math.max(0, anchorRect.top - anchorGap - topBoundary),
    below: Math.max(0, bottomBoundary - anchorRect.bottom - anchorGap),
  }
  const preferredFits = overlayRect.height <= availableSpace[preferredPlacement]
  const alternateFits = overlayRect.height <= availableSpace[alternatePlacement]

  // Too tall for above and below: open beside the anchor when there is room,
  // so the element being edited stays visible next to its settings.
  if (!preferredFits && !alternateFits) {
    const anchorRight = anchorRect.left + anchorRect.width
    const rightLeft = anchorRight + anchorGap
    const leftLeft = anchorRect.left - anchorGap - overlayRect.width
    const fitsRight =
      rightLeft + overlayRect.width <= viewportWidth - viewportPadding
    const fitsLeft = leftLeft >= viewportPadding

    if (fitsRight || fitsLeft) {
      const maxHeight = Math.max(1, bottomBoundary - topBoundary)
      const renderedHeight = Math.min(overlayRect.height, maxHeight)

      return {
        left: fitsRight ? rightLeft : leftLeft,
        maxHeight,
        placement: fitsRight ? 'right' : 'left',
        top: clamp(
          anchorRect.top,
          topBoundary,
          bottomBoundary - renderedHeight,
        ),
      }
    }
  }

  let placement: OverlayPlacementSide = preferredPlacement

  if (!preferredFits && alternateFits) {
    placement = alternatePlacement
  } else if (
    !preferredFits &&
    !alternateFits &&
    availableSpace[alternatePlacement] > availableSpace[preferredPlacement]
  ) {
    placement = alternatePlacement
  }

  const maxHeight = Math.max(1, availableSpace[placement])
  const renderedHeight = Math.min(overlayRect.height, maxHeight)
  const centeredLeft =
    anchorRect.left + anchorRect.width / 2 - overlayRect.width / 2
  const maxLeft = Math.max(
    viewportPadding,
    viewportWidth - overlayRect.width - viewportPadding,
  )
  const left = clamp(centeredLeft, viewportPadding, maxLeft)
  const top =
    placement === 'above'
      ? anchorRect.top - anchorGap - renderedHeight
      : anchorRect.bottom + anchorGap

  return {
    left,
    maxHeight,
    placement,
    top: clamp(top, topBoundary, bottomBoundary - renderedHeight),
  }
}
