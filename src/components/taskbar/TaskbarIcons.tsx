import type { ReactNode } from 'react'

/**
 * Taskbar icon set: one 24px grid, 1.75px round strokes, no fills, so all
 * dock actions read as a single family.
 */
function StrokeIcon({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <svg
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

type IconProps = { className?: string }

/** Add link: chain link with a plus. */
export function AddLinkIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M10 14a4 4 0 0 0 5.66 0l2.83-2.83a4 4 0 0 0-5.66-5.66l-.7.7" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-2.83 2.83a4 4 0 0 0 5.66 5.66l.7-.7" />
      <path d="M19 15.5v5M16.5 18h5" />
    </StrokeIcon>
  )
}

/** Close (quick add open). */
export function CloseIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </StrokeIcon>
  )
}

/** Add group: a frame with a header rule, matching the group design. */
export function AddGroupIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M13 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7" />
      <path d="M4 8.5h16" />
      <path d="M7.5 12h3M7.5 15.5h3" />
      <path d="M18 16v5M15.5 18.5h5" />
    </StrokeIcon>
  )
}

/** Upload image: picture frame with an upward arrow. */
export function UploadImageIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
      <path d="m4 16 4.3-4.3a1.5 1.5 0 0 1 2.1 0L16 17.3" />
      <path d="m14 15 1.3-1.3a1.5 1.5 0 0 1 2.1 0L20 16.3" />
      <circle cx="9" cy="8.5" r="1.25" />
      <path d="M18 9V3M15.5 5.5 18 3l2.5 2.5" />
    </StrokeIcon>
  )
}

/** Image gallery: two stacked picture frames. */
export function ImageGalleryIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <rect x="7" y="3.5" width="13.5" height="13.5" rx="2" />
      <path d="M3.5 7.5v11a2 2 0 0 0 2 2h11" />
      <circle cx="11.5" cy="8" r="1.25" />
      <path d="m20.5 13.5-3.1-3.1a1.5 1.5 0 0 0-2.1 0L9 16.7" />
    </StrokeIcon>
  )
}
