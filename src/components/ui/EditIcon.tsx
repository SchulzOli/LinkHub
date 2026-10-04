import { StrokeIcon } from './StrokeIcon'

type EditIconProps = {
  className?: string
}

/** Pencil over a page, in the shared stroke style. */
export function EditIcon({ className }: EditIconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M12 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V12" />
      <path d="M17.6 3.9a1.9 1.9 0 0 1 2.7 2.7l-7.1 7.1-3.6.9.9-3.6 7.1-7.1Z" />
    </StrokeIcon>
  )
}
