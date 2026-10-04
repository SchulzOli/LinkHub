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
import {
  NodeActionBar,
  NodeActionButton,
  NodeResizeHandles,
} from '../nodes/NodeChrome'
import { NODE_CHROME_HOST } from '../nodes/nodeClasses'
import { GroupHeaderBar } from './GroupHeaderBar'
import type { GroupFrameViewModel } from './useGroupFrameViewModel'

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
        className={`${styles.group} ${NODE_CHROME_HOST} ${isEditMode ? styles.groupEdit : ''} ${isSelected ? styles.groupSelected : ''}`}
        data-collapsed={String(isCollapsed)}
        data-entity-id={group.id}
        data-entity-kind="group"
        data-mode={isEditMode ? 'edit' : 'view'}
        data-selected={isSelected}
        data-shadow-style={resolvedShadowStyle}
        data-surface-transparency={String(resolvedSurfaceTransparency)}
        data-testid={`card-group-${group.id}`}
        style={groupStyle}
      >
        {isEditMode && !isCollapsed ? (
          <NodeResizeHandles
            label={(direction) => `Resize group ${direction}`}
            onPointerDown={createResizePointerDown}
          />
        ) : null}
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
          <NodeActionBar>
            <NodeActionButton
              kind="edit"
              label="Update group"
              onClick={onOpenEditor}
            />
            <NodeActionButton
              kind="delete"
              label="Delete group"
              onClick={onDelete}
            />
          </NodeActionBar>
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
