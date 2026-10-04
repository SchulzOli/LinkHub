type IconProps = { className?: string }

function StrokeIcon({
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 19h14" />
    </StrokeIcon>
  )
}

export function InsertIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </StrokeIcon>
  )
}

export function DuplicateIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <rect height="11" rx="2" width="11" x="9" y="9" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </StrokeIcon>
  )
}

export function ReplaceIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M4 9a7 7 0 0 1 12.5-3.5L19 8" />
      <path d="M19 4v4h-4" />
      <path d="M20 15a7 7 0 0 1-12.5 3.5L5 16" />
      <path d="M5 20v-4h4" />
    </StrokeIcon>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="m15 6-6 6 6 6" />
    </StrokeIcon>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="m9 6 6 6-6 6" />
    </StrokeIcon>
  )
}
