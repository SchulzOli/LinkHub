import {
  memo,
  type MouseEventHandler,
  type PointerEventHandler,
  type ReactNode,
  type RefObject,
} from 'react'

import styles from './GroupFrame.module.css'

import type { CardGroup } from '../../contracts/cardGroup'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'
import { type ResizeDirection } from '../../features/placement/useResizePlacement'
import { DeleteIcon } from '../ui/DeleteIcon'
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
  headerTools?: ReactNode
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
  headerTools,
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
    <>
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
          tools={headerTools}
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
                <DeleteIcon className={styles.actionSvg} />
              </span>
            </button>
          </div>
        ) : null}
      </article>
      {/* Outline lives in its own layer above cards/pictures so members that
        sit flush against the edge never cover the border. */}
      <div
        aria-hidden="true"
        className={`${styles.groupOutline} ${isSelected ? styles.groupOutlineSelected : ''}`}
        data-role="group-outline"
        style={groupStyle}
      />
    </>
  )
})
