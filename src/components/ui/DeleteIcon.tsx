import { StrokeIcon } from './StrokeIcon'

/** Thin X used for delete / close actions. */
export function DeleteIcon({ className }: { className?: string }) {
  return (
    <StrokeIcon className={className}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </StrokeIcon>
  )
}
