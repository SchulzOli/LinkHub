import type { ReactNode } from 'react'

/**
 * Base for LinkHub's icon set: 24px grid, 1.75px round strokes, no fills,
 * so action, taskbar and chart icons read as one family.
 */
export function StrokeIcon({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
    >
      {children}
    </svg>
  )
}
