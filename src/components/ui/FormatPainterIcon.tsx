type FormatPainterIconProps = {
  className?: string
}

export function FormatPainterIcon({ className }: FormatPainterIconProps) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" className={className}>
      <path
        d="M6.25 4.5A2.75 2.75 0 0 1 9 1.75h6A2.75 2.75 0 0 1 17.75 4.5v1.25h.75a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2.17l-1.2 6.03A1.5 1.5 0 0 1 13.66 20h-3.3a1.5 1.5 0 0 1-1.47-1.22l-1.2-6.03H5.5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h.75V4.5Zm2.25-.75a.75.75 0 0 0-.75.75v1.25h8.5V4.5a.75.75 0 0 0-.75-.75h-6Zm-3 4v3h13v-3h-13Zm4.23 5 1.07 5.25h2.38l1.05-5.25H9.73Z"
        fill="currentColor"
      />
      <path
        d="M8.75 22.25a1 1 0 0 1 0-2h6.5a1 1 0 1 1 0 2h-6.5Z"
        fill="currentColor"
      />
    </svg>
  )
}
