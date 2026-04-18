import { useId } from 'react'

type LinkHubMarkProps = {
  className?: string
  color?: string
  title?: string
}

export function LinkHubMark({
  className,
  color = 'currentColor',
  title,
}: LinkHubMarkProps) {
  const titleId = useId().replace(/:/g, '')

  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-labelledby={title ? titleId : undefined}
      className={className}
      fill="none"
      focusable="false"
      role={title ? 'img' : undefined}
      viewBox="0 0 64 64"
    >
      {title ? <title id={titleId}>{title}</title> : null}
      <path
        d="M19 31.5C19 24.32 24.82 18.5 32 18.5H35.5"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="6.5"
      />
      <path
        d="M45 32.5C45 39.68 39.18 45.5 32 45.5H28.5"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="6.5"
      />
      <circle cx="20" cy="31.5" r="5.25" fill={color} />
      <circle cx="44" cy="32.5" r="5.25" fill={color} />
      <rect x="27" y="27" width="10" height="10" rx="3.5" fill={color} />
    </svg>
  )
}
