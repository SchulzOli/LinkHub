/**
 * Node content that scrolls on its own (e.g. a news list) is marked with
 * `data-canvas-scroll="y"`. A plain wheel over it scrolls that
 * element instead of zooming the canvas, as long as it actually overflows.
 * Ctrl/Alt + wheel keep their canvas meaning everywhere.
 */
export function shouldScrollInsideNode(event: WheelEvent): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey) {
    return false
  }

  let element = event.target instanceof Element ? event.target : null

  while (element) {
    const axis = element.getAttribute('data-canvas-scroll')

    if (axis === 'y' && element.scrollHeight > element.clientHeight + 1) {
      return true
    }

    if (element.hasAttribute('data-entity-id')) {
      return false
    }

    element = element.parentElement
  }

  return false
}
