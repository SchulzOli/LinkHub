import type { ReactNode, SVGProps } from 'react'

type IconBaseProps = Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'focusable'> & {
  /**
   * Children are the shapes (paths, rects, circles) that draw the icon.
   * The surrounding `<svg>` shell (viewBox, focusable, accessibility) is
   * standardized here so every icon component has an identical contract.
   */
  children: ReactNode
}

/**
 * Shared SVG shell for icon components under `src/components/ui/icons/`.
 *
 * Contract:
 *   - `viewBox="0 0 24 24"` is fixed; all icons are authored on a 24x24 grid.
 *   - `focusable="false"` so the icon is never part of tab order.
 *   - Size is controlled by the caller via `className` (typically a CSS
 *     module class that sets width/height, e.g. `styles.iconSvg`).
 *   - Color is inherited via `fill="currentColor"` / `stroke="currentColor"`
 *     inside the child paths, so the icon picks up the button's text color.
 *
 * Prefer extending this shell over writing a new raw `<svg>` element when
 * adding an icon; it keeps the icon catalog visually consistent.
 */
export function IconBase({ children, ...rest }: IconBaseProps) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" {...rest}>
      {children}
    </svg>
  )
}
