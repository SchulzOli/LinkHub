import type {
  CSSProperties,
  PointerEventHandler,
  ReactNode,
  RefObject,
  WheelEventHandler,
} from 'react'

import styles from './EditPanel.module.css'

type EditPanelProps = {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  testId?: string
  panelRef?: RefObject<HTMLDivElement | null>
  style?: CSSProperties
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onWheelCapture?: WheelEventHandler<HTMLDivElement>
}

/**
 * Frame of every node edit panel: a titled header with icon actions and a
 * scrolling body made of PanelSections.
 */
export function EditPanel({
  title,
  subtitle,
  actions,
  children,
  testId,
  panelRef,
  style,
  onPointerDown,
  onWheelCapture,
}: EditPanelProps) {
  return (
    <div
      className={styles.editPanel}
      data-testid={testId}
      ref={panelRef}
      style={style}
      onPointerDown={onPointerDown}
      onWheelCapture={onWheelCapture}
    >
      <div className={styles.header}>
        <div className={styles.heading}>
          <h3 className={styles.title}>{title}</h3>
          {subtitle ? (
            <span className={styles.subtitle}>{subtitle}</span>
          ) : null}
        </div>
        {actions ? <div className={styles.headerActions}>{actions}</div> : null}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
