import {
  memo,
  type MouseEventHandler,
  type PointerEventHandler,
  type RefObject,
} from 'react'

import styles from './GroupFrame.module.css'

import type { CardGroup } from '../../contracts/cardGroup'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'
import { type ResizeDirection } from '../../features/placement/useResizePlacement'
import { EditIcon } from '../ui/EditIcon'
import { GroupHeaderBar } from './GroupHeaderBar'
import type { GroupFrameViewModel } from './useGroupFrameViewModel'

const RESIZE_HANDLES: ResizeDirection[] = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
]

const resizeHandleClassNameByDirection: Record<ResizeDirection, string> = {
  n: styles.resizeHandleN,
  s: styles.resizeHandleS,
  e: styles.resizeHandleE,
  w: styles.resizeHandleW,
  ne: styles.resizeHandleNE,
  nw: styles.resizeHandleNW,
  se: styles.resizeHandleSE,
  sw: styles.resizeHandleSW,
}

type GroupFrameViewProps = {
  articleRef: RefObject<HTMLElement | null>
  createResizePointerDown: (
    direction: ResizeDirection,
  ) => PointerEventHandler<HTMLButtonElement>
  group: CardGroup
  isEditMode: boolean
  isSelected: boolean
  resolvedShadowStyle: SurfaceShadowStyle
  resolvedSurfaceTransparency: SurfaceTransparency
  viewModel: GroupFrameViewModel
  onCollapseToggleButtonPointerDown: PointerEventHandler<HTMLButtonElement>
  onDelete: MouseEventHandler<HTMLButtonElement>
  onHeaderClick: MouseEventHandler<HTMLDivElement>
  onHeaderPointerDown: PointerEventHandler<HTMLDivElement>
  onOpenEditor: MouseEventHandler<HTMLButtonElement>
  onToggleCollapsed: (
    event:
      | React.KeyboardEvent<HTMLElement>
      | React.MouseEvent<HTMLElement>
      | React.PointerEvent<HTMLElement>,
  ) => void
}

export const GroupFrameView = memo(function GroupFrameView({
  articleRef,
  createResizePointerDown,
  group,
  isEditMode,
  isSelected,
  resolvedShadowStyle,
  resolvedSurfaceTransparency,
  viewModel,
  onCollapseToggleButtonPointerDown,
  onDelete,
  onHeaderClick,
  onHeaderPointerDown,
  onOpenEditor,
  onToggleCollapsed,
}: GroupFrameViewProps) {
  const { displayTitle, groupStyle, isCollapsed } = viewModel

  return (
    <article
      ref={articleRef}
      className={`${styles.group} ${isEditMode ? styles.groupEdit : ''} ${isSelected ? styles.groupSelected : ''}`}
      data-collapsed={String(isCollapsed)}
      data-entity-id={group.id}
      data-entity-kind="group"
      data-selected={isSelected}
      data-shadow-style={resolvedShadowStyle}
      data-surface-transparency={String(resolvedSurfaceTransparency)}
      data-testid={`card-group-${group.id}`}
      style={groupStyle}
    >
      {isEditMode && !isCollapsed
        ? RESIZE_HANDLES.map((direction) => (
            <button
              aria-label={`Resize group ${direction}`}
              className={`${styles.resizeHandle} ${resizeHandleClassNameByDirection[direction]}`}
              data-role="resize-handle"
              key={direction}
              onPointerDown={createResizePointerDown(direction)}
              tabIndex={-1}
              type="button"
            />
          ))
        : null}
      <GroupHeaderBar
        displayTitle={displayTitle}
        groupId={group.id}
        groupName={group.name}
        isCollapsed={isCollapsed}
        isEditMode={isEditMode}
        onCollapseToggleButtonPointerDown={onCollapseToggleButtonPointerDown}
        onHeaderClick={onHeaderClick}
        onHeaderPointerDown={onHeaderPointerDown}
        onToggleCollapsed={onToggleCollapsed}
      />
      {!isCollapsed ? (
        <div
          className={styles.body}
          data-testid={`card-group-body-${group.id}`}
        />
      ) : null}
      {isEditMode ? (
        <div className={styles.actionBar} data-role="action-bar">
          <button
            aria-label="Update group"
            className={`${styles.actionButton} ${styles.actionButtonEdit}`}
            title="Update group"
            type="button"
            onClick={onOpenEditor}
          >
            <span
              aria-hidden="true"
              className={`${styles.actionIcon} ${styles.actionIconEdit}`}
            >
              <EditIcon className={styles.actionSvg} />
            </span>
          </button>
          <button
            aria-label="Delete group"
            className={`${styles.actionButton} ${styles.actionButtonDanger}`}
            title="Delete group"
            type="button"
            onClick={onDelete}
          >
            <span aria-hidden="true" className={styles.actionIcon}>
              <svg
                viewBox="0 0 24 24"
                focusable="false"
                className={styles.actionSvg}
              >
                <path
                  d="M6.7 5.3a1 1 0 0 1 1.4 0L12 9.17l3.9-3.88a1 1 0 1 1 1.4 1.42L13.4 10.6l3.88 3.9a1 1 0 0 1-1.42 1.4L12 12l-3.9 3.9a1 1 0 0 1-1.4-1.42l3.88-3.88-3.9-3.9a1 1 0 0 1 0-1.4Z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </button>
        </div>
      ) : null}
    </article>
  )
})
