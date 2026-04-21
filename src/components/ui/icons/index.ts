/**
 * Icon catalog.
 *
 * Add new icon components here when you need to reuse an SVG across more
 * than one call site. One-off decorative SVGs (e.g. the empty-canvas
 * illustration) should stay inline where they are used.
 *
 * Each icon component must:
 *   - Wrap its artwork in `IconBase` (standard 24x24 viewBox, focusable=false).
 *   - Accept `className` to let the caller control size via CSS.
 *   - Use `currentColor` for fill/stroke so the icon adopts the caller's color.
 */
export { EditIcon } from './EditIcon'
export { FormatPainterIcon } from './FormatPainterIcon'
export { IconBase } from './IconBase'
