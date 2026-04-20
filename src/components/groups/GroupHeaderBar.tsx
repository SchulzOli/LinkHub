import type { MouseEventHandler, PointerEventHandler } from 'react'

import styles from './GroupFrame.module.css'

type GroupHeaderBarProps = {
  displayTitle: string
  groupId: string
  groupName: string
  isCollapsed: boolean
  isEditMode: boolean
  onCollapseToggleButtonPointerDown: PointerEventHandler<HTMLButtonElement>
  onHeaderClick?: MouseEventHandler<HTMLDivElement>
  onHeaderPointerDown?: PointerEventHandler<HTMLDivElement>
  onToggleCollapsed: (
    event:
      | React.KeyboardEvent<HTMLElement>
      | React.MouseEvent<HTMLElement>
      | React.PointerEvent<HTMLElement>,
  ) => void
}

export function GroupHeaderBar({
  displayTitle,
  groupId,
  groupName,
  isCollapsed,
  isEditMode,
  onCollapseToggleButtonPointerDown,
  onHeaderClick,
  onHeaderPointerDown,
  onToggleCollapsed,
}: GroupHeaderBarProps) {
  return (
    <div className={styles.header}>
      <div
        className={styles.headerSurface}
        data-testid={`card-group-header-${groupId}`}
        onClick={!isEditMode ? onHeaderClick : undefined}
        onPointerDown={isEditMode ? onHeaderPointerDown : undefined}
      >
        <span className={styles.headerMeta}>
          <button
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} group ${groupName}`}
            aria-pressed={isCollapsed}
            className={styles.headerGripButton}
            data-testid={`group-collapse-toggle-${groupId}`}
            title={isCollapsed ? 'Expand group' : 'Collapse group'}
            type="button"
            onClick={onToggleCollapsed}
            onPointerDown={onCollapseToggleButtonPointerDown}
          >
            {isCollapsed ? (
              <span
                aria-hidden="true"
                className={styles.headerGripCollapseIcon}
              >
                <svg
                  viewBox="0 0 16 16"
                  focusable="false"
                  className={styles.headerGripCollapseSvg}
                >
                  <path
                    d="M6.1 6.1 2.35 2.35M2.35 5.2v-2.85H5.2M9.9 6.1l3.75-3.75M10.8 2.35h2.85V5.2M6.1 9.9l-3.75 3.75M2.35 10.8v2.85H5.2M9.9 9.9l3.75 3.75M10.8 13.65h2.85V10.8"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                  />
                </svg>
              </span>
            ) : (
              <span aria-hidden="true" className={styles.headerGrip}>
                <svg
                  viewBox="0 0 16 16"
                  focusable="false"
                  className={styles.headerGripSvg}
                  shapeRendering="geometricPrecision"
                >
                  <circle cx="4.5" cy="4.5" r="1.7" fill="currentColor" />
                  <circle cx="11.5" cy="4.5" r="1.7" fill="currentColor" />
                  <circle cx="4.5" cy="11.5" r="1.7" fill="currentColor" />
                  <circle cx="11.5" cy="11.5" r="1.7" fill="currentColor" />
                </svg>
              </span>
            )}
          </button>
          <span className={styles.titleBadge}>{displayTitle}</span>
        </span>
      </div>
    </div>
  )
}
