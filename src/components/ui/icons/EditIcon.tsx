import { IconBase } from './IconBase'

type EditIconProps = {
  className?: string
}

export function EditIcon({ className }: EditIconProps) {
  return (
    <IconBase className={className}>
      <path
        d="M5 5.75A1.75 1.75 0 0 1 6.75 4h5.75a1 1 0 1 1 0 2H6.75a.25.25 0 0 0-.25.25v11.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V12a1 1 0 1 1 2 0v5.75A1.75 1.75 0 0 1 17.25 19.5H6.75A1.75 1.75 0 0 1 5 17.75V5.75Z"
        fill="currentColor"
      />
      <path
        d="M16.23 3.34a2.22 2.22 0 0 1 3.14 0l1.29 1.29a2.22 2.22 0 0 1 0 3.14l-7.18 7.18a1 1 0 0 1-.46.27l-3.22.81a.78.78 0 0 1-.95-.95l.8-3.22a1 1 0 0 1 .28-.46l7.17-7.18Zm1.73 1.42a.22.22 0 0 0-.31 0l-6.96 6.97-.31 1.23 1.23-.31 6.97-6.96a.22.22 0 0 0 0-.31l-1.29-1.29Z"
        fill="currentColor"
      />
    </IconBase>
  )
}
