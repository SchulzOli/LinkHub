import type { MouseEventHandler, PointerEventHandler, ReactNode } from 'react'

import type { ResizeDirection } from '../../features/placement/useResizePlacement'
import { DeleteIcon } from '../ui/DeleteIcon'
import { EditIcon } from '../ui/EditIcon'

import styles from './NodeChrome.module.css'

const RESIZE_DIRECTIONS: ResizeDirection[] = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
]

/** Hover/edit action bar shared by every node kind. */
export function NodeActionBar(props: { children: ReactNode }) {
  return (
    <div className={styles.actionBar} data-role="action-bar">
      {props.children}
    </div>
  )
}

export function NodeActionButton(props: {
  label: string
  /** `edit` and `delete` use the shared icons; pass `icon` for others. */
  kind: 'edit' | 'delete' | 'custom'
  icon?: ReactNode
  onClick: MouseEventHandler<HTMLButtonElement>
}) {
  return (
    <button
      aria-label={props.label}
      className={`${styles.actionButton} ${props.kind === 'delete' ? styles.actionButtonDanger : ''}`}
      onClick={props.onClick}
      title={props.label}
      type="button"
    >
      {props.kind === 'edit' ? (
        <EditIcon className={styles.actionSvg} />
      ) : props.kind === 'delete' ? (
        <DeleteIcon className={styles.actionSvg} />
      ) : (
        props.icon
      )}
    </button>
  )
}

/** Eight resize handles (edges + corners) in the shared style. */
export function NodeResizeHandles(props: {
  /** Accessible name per direction, e.g. (d) => `Resize chart ${d}`. */
  label: (direction: ResizeDirection) => string
  onPointerDown: (
    direction: ResizeDirection,
  ) => PointerEventHandler<HTMLButtonElement>
}) {
  return (
    <>
      {RESIZE_DIRECTIONS.map((direction) => (
        <button
          aria-label={props.label(direction)}
          className={`${styles.resizeHandle} ${styles[direction]}`}
          data-role="resize-handle"
          key={direction}
          onPointerDown={props.onPointerDown(direction)}
          tabIndex={-1}
          type="button"
        />
      ))}
    </>
  )
}
