import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import {
  GROUP_SIZE_LIMITS,
  parseGroupSizeDraft,
  type CardGroup,
} from '../../contracts/cardGroup'
import { clampCardCornerRadius } from '../../contracts/linkCard'
import type { PictureNode } from '../../contracts/pictureNode'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'
import { clampSurfaceTransparency } from '../../contracts/surfaceEffects'
import type { Viewport } from '../../contracts/workspace'
import { createFormatPainterFromGroup } from '../../features/appearance/formatPainter'
import { useSurfaceStyles } from '../../features/appearance/useSurfaceStyles'
import {
  getGroupDescendantIds,
  getGroupPlacementFrames,
  getPictureIdsWithinGroupBodies,
  isGroupPlacementBlockedByVisibleGroup,
} from '../../features/groups/groupLayout'
import { getAnchoredOverlayPosition } from '../../features/placement/overlayPlacement'
import { useDragPlacement } from '../../features/placement/useDragPlacement'
import { useResizePlacement } from '../../features/placement/useResizePlacement'
import { useAppearanceStore } from '../../state/useAppearanceStore'
import {
  useWorkspaceStore,
  type InteractionMode,
} from '../../state/useWorkspaceStore'
import {
  useCanvasEditActions,
  useCanvasPlacementActions,
  useCanvasSelectionActions,
} from '../canvas/CanvasActionsContext'
import { isSelectMenuPortalTarget } from '../ui/SelectMenu'
import { GroupFrameEditOverlay } from './GroupFrameEditOverlay'
import { GroupFrameView } from './GroupFrameView'
import { useGroupFrameViewModel } from './useGroupFrameViewModel'

export type GroupFrameProps = {
  group: CardGroup
  groups: CardGroup[]
  pictures: PictureNode[]
  guide: PlacementGuide
  isSelected: boolean
  interactionMode: InteractionMode
  viewport: Viewport
}

export const GroupFrameContainer = memo(function GroupFrameContainer({
  group,
  groups,
  pictures,
  guide,
  isSelected,
  interactionMode,
  viewport,
}: GroupFrameProps) {
  const {
    autoEditTarget,
    onClearAutoEditTarget: clearAutoEditTarget,
    onSelectGroup: onSelect,
  } = useCanvasSelectionActions()
  const { onRemoveGroup: onRemove, onUpdateGroup: onUpdate } =
    useCanvasEditActions()
  const { onMoveGroup: onMove, onPreviewChange } = useCanvasPlacementActions()
  const { appearance, setBorderPresets, setFillPresets } = useAppearanceStore()
  const startFormatPainter = useWorkspaceStore(
    (state) => state.startFormatPainter,
  )
  const toggleGroupCollapsed = useWorkspaceStore(
    (state) => state.toggleGroupCollapsed,
  )
  const [isEditing, setIsEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(group.name)
  const [widthDraft, setWidthDraft] = useState(String(group.size.columns))
  const [heightDraft, setHeightDraft] = useState(String(group.size.rows))
  const [cornerRadiusDraft, setCornerRadiusDraft] = useState(
    group.cornerRadius ?? appearance.defaultCardCornerRadius,
  )
  const [showTitleDraft, setShowTitleDraft] = useState(group.showTitle ?? true)
  const [fillPresetIndexDraft, setFillPresetIndexDraft] = useState<
    number | null
  >(group.fillPresetIndex ?? null)
  const [borderPresetIndexDraft, setBorderPresetIndexDraft] = useState<
    number | null
  >(group.borderPresetIndex ?? null)
  const [fillColorDraft, setFillColorDraft] = useState(group.fillColor ?? null)
  const [borderColorDraft, setBorderColorDraft] = useState(
    group.borderColor ?? null,
  )
  const [surfaceTransparencyDraft, setSurfaceTransparencyDraft] =
    useState<SurfaceTransparency>(
      group.surfaceTransparency ?? appearance.defaultSurfaceTransparency,
    )
  const dragPictureIdsRef = useRef<string[]>([])
  const [shadowStyleDraft, setShadowStyleDraft] = useState<SurfaceShadowStyle>(
    group.shadowStyle ?? appearance.defaultSurfaceShadowStyle,
  )
  const articleRef = useRef<HTMLElement | null>(null)
  const editPanelRef = useRef<HTMLDivElement | null>(null)
  const [editPanelStyle, setEditPanelStyle] = useState<CSSProperties | null>(
    null,
  )
  const autoEditGroupId =
    autoEditTarget?.kind === 'group' ? autoEditTarget.id : null
  const {
    activeColorSettings,
    defaultColorPresets,
    resolvedColors: resolvedGroupColors,
    resolvedShadowStyle,
    resolvedSurfaceTransparency,
    selectedBorderColor,
    selectedFillColor,
  } = useSurfaceStyles({
    appearance,
    drafts: {
      borderColorDraft,
      borderPresetIndexDraft,
      fillColorDraft,
      fillPresetIndexDraft,
    },
    entity: group,
  })
  const viewModel = useGroupFrameViewModel({
    appearance,
    group,
    guide,
    resolvedGroupColors,
    resolvedShadowStyle,
    resolvedSurfaceTransparency,
    viewport,
  })
  const { isCollapsed, layoutSize } = viewModel
  const descendantGroupIds = useMemo(
    () => new Set(getGroupDescendantIds(groups, group.id)),
    [group.id, groups],
  )
  const groupSubtree = useMemo(
    () =>
      groups.filter(
        (candidate) =>
          candidate.id === group.id || descendantGroupIds.has(candidate.id),
      ),
    [descendantGroupIds, group.id, groups],
  )
  const getGroupPlacementSnapshot = useCallback(() => {
    const liveGroups = useWorkspaceStore.getState().workspace.groups
    return getGroupPlacementFrames(liveGroups).filter(
      (candidate) =>
        candidate.id !== group.id && !descendantGroupIds.has(candidate.id),
    )
  }, [descendantGroupIds, group.id])
  const normalizedGroupSize = useMemo(
    () => parseGroupSizeDraft(widthDraft, heightDraft),
    [heightDraft, widthDraft],
  )

  const isEditMode = interactionMode === 'edit'

  const handleGroupMove = useCallback(
    (groupId: string, position: { x: number; y: number }) => {
      onMove(groupId, position, dragPictureIdsRef.current)
    },
    [onMove],
  )

  const handleDragPointerDown = useDragPlacement({
    cardId: group.id,
    cardSize: layoutSize,
    position: { x: group.positionX, y: group.positionY },
    getCards: getGroupPlacementSnapshot,
    enabled: isEditMode && !isEditing,
    guide,
    isOccupiedItemBlocking: (candidate, occupiedItem, currentGuide) =>
      isGroupPlacementBlockedByVisibleGroup({
        candidate,
        gridSize: currentGuide.gridSize,
        occupiedGroup: occupiedItem,
      }),
    viewport,
    onMove: handleGroupMove,
    onPreviewChange,
  })

  const createResizePointerDown = useResizePlacement({
    card: {
      ...group,
      size: layoutSize,
    },
    getCards: getGroupPlacementSnapshot,
    enabled: isEditMode && !isEditing && !isCollapsed,
    guide,
    isOccupiedItemBlocking: (candidate, occupiedItem, currentGuide) =>
      isGroupPlacementBlockedByVisibleGroup({
        candidate,
        gridSize: currentGuide.gridSize,
        occupiedGroup: occupiedItem,
      }),
    sizeLimits: GROUP_SIZE_LIMITS,
    viewport,
    onResize: (groupId, frame) => {
      onUpdate(groupId, {
        size: frame.size,
        positionX: frame.position.x,
        positionY: frame.position.y,
      })
    },
    onPreviewChange,
  })

  const handleToggleCollapsed = useCallback(
    (
      event:
        | React.KeyboardEvent<HTMLElement>
        | React.MouseEvent<HTMLElement>
        | React.PointerEvent<HTMLElement>,
    ) => {
      event.preventDefault()
      event.stopPropagation()
      toggleGroupCollapsed(group.id)
    },
    [group.id, toggleGroupCollapsed],
  )

  useEffect(() => {
    if (!isEditing) {
      return
    }

    const handlePointerDownOutside = (event: PointerEvent) => {
      if (editPanelRef.current?.contains(event.target as Node)) {
        return
      }

      if (isSelectMenuPortalTarget(event.target)) {
        return
      }

      setEditPanelStyle(null)
      setIsEditing(false)
    }

    document.addEventListener('pointerdown', handlePointerDownOutside)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside)
    }
  }, [isEditing])

  useLayoutEffect(() => {
    if (!isEditing) {
      return
    }

    const updateEditPanelPosition = () => {
      const articleRect = articleRef.current?.getBoundingClientRect()
      const panelRect = editPanelRef.current?.getBoundingClientRect()

      if (!articleRect || !panelRect) {
        return
      }

      const viewportPadding = 8
      const anchorGap = 12
      const taskbarRect = document
        .querySelector<HTMLElement>('[data-testid="bottom-taskbar"]')
        ?.getBoundingClientRect()
      const bottomBoundary = Math.min(
        window.innerHeight - viewportPadding,
        (taskbarRect?.top ?? window.innerHeight) - viewportPadding,
      )
      const { left, maxHeight, top } = getAnchoredOverlayPosition({
        anchorGap,
        anchorRect: {
          left: articleRect.left,
          top: articleRect.top,
          bottom: articleRect.bottom,
          width: articleRect.width,
        },
        bottomBoundary,
        overlayRect: {
          width: panelRect.width,
          height: panelRect.height,
        },
        topBoundary: viewportPadding,
        viewportPadding,
        viewportWidth: window.innerWidth,
      })

      setEditPanelStyle({
        left: `${left}px`,
        top: `${top}px`,
        maxHeight: `${maxHeight}px`,
      })
    }

    const animationFrameId = window.requestAnimationFrame(
      updateEditPanelPosition,
    )
    window.addEventListener('resize', updateEditPanelPosition)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', updateEditPanelPosition)
    }
  }, [
    group.positionX,
    group.positionY,
    isCollapsed,
    isEditing,
    layoutSize.columns,
    layoutSize.rows,
    viewport.x,
    viewport.y,
    viewport.zoom,
  ])

  const commitSizeDrafts = useCallback(
    (nextWidthDraft: string, nextHeightDraft: string) => {
      setWidthDraft(nextWidthDraft)
      setHeightDraft(nextHeightDraft)

      const nextSize = parseGroupSizeDraft(nextWidthDraft, nextHeightDraft)

      if (!nextSize) {
        return
      }

      onUpdate(group.id, { size: nextSize })
    },
    [group.id, onUpdate],
  )

  const commitFillSelection = useCallback(
    (nextFillPresetIndex: number | null, nextFillColor: string | null) => {
      setFillPresetIndexDraft(nextFillPresetIndex)
      setFillColorDraft(nextFillColor)

      onUpdate(group.id, {
        fillPresetIndex: nextFillPresetIndex ?? undefined,
        fillColor:
          nextFillPresetIndex === null
            ? (nextFillColor ?? undefined)
            : undefined,
      })
    },
    [group.id, onUpdate],
  )

  const commitBorderSelection = useCallback(
    (nextBorderPresetIndex: number | null, nextBorderColor: string | null) => {
      setBorderPresetIndexDraft(nextBorderPresetIndex)
      setBorderColorDraft(nextBorderColor)

      onUpdate(group.id, {
        borderPresetIndex: nextBorderPresetIndex ?? undefined,
        borderColor:
          nextBorderPresetIndex === null
            ? (nextBorderColor ?? undefined)
            : undefined,
      })
    },
    [group.id, onUpdate],
  )

  const handleOpenEditor = useCallback(() => {
    setNameDraft(group.name)
    setWidthDraft(String(group.size.columns))
    setHeightDraft(String(group.size.rows))
    setCornerRadiusDraft(
      group.cornerRadius ?? appearance.defaultCardCornerRadius,
    )
    setShowTitleDraft(group.showTitle ?? true)
    setFillPresetIndexDraft(
      group.fillPresetIndex ?? activeColorSettings.defaultFillPresetIndex,
    )
    setBorderPresetIndexDraft(
      group.borderPresetIndex ?? activeColorSettings.defaultBorderPresetIndex,
    )
    setFillColorDraft(
      group.fillPresetIndex === undefined ? (group.fillColor ?? null) : null,
    )
    setBorderColorDraft(
      group.borderPresetIndex === undefined
        ? (group.borderColor ?? null)
        : null,
    )
    setSurfaceTransparencyDraft(
      group.surfaceTransparency ?? appearance.defaultSurfaceTransparency,
    )
    setShadowStyleDraft(
      group.shadowStyle ?? appearance.defaultSurfaceShadowStyle,
    )
    setEditPanelStyle(null)
    setIsEditing(true)
  }, [
    activeColorSettings.defaultBorderPresetIndex,
    activeColorSettings.defaultFillPresetIndex,
    appearance,
    group,
  ])

  useEffect(() => {
    if (!isEditMode || isEditing || autoEditGroupId !== group.id) {
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      handleOpenEditor()
      clearAutoEditTarget()
    })

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [
    autoEditGroupId,
    clearAutoEditTarget,
    group.id,
    handleOpenEditor,
    isEditMode,
    isEditing,
  ])

  const handleHeaderPointerDown = useCallback<
    React.PointerEventHandler<HTMLDivElement>
  >(
    (event) => {
      if (event.button !== 0) {
        return
      }

      const additive = event.metaKey || event.ctrlKey

      if (additive) {
        onSelect(group.id, true)
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (!isSelected) {
        onSelect(group.id, false)
      }

      dragPictureIdsRef.current = getPictureIdsWithinGroupBodies(
        pictures,
        groupSubtree,
        guide.gridSize,
        { useExpandedBody: true },
      )

      handleDragPointerDown(event)
    },
    [
      group.id,
      groupSubtree,
      guide.gridSize,
      handleDragPointerDown,
      isSelected,
      onSelect,
      pictures,
    ],
  )

  const handleCollapseToggleButtonPointerDown = useCallback<
    React.PointerEventHandler<HTMLButtonElement>
  >((event) => {
    event.stopPropagation()
  }, [])

  const handleCopyFormat = useCallback(() => {
    startFormatPainter(createFormatPainterFromGroup(group))
    setIsEditing(false)
  }, [group, startFormatPainter])

  const handleCloseEditor = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleDelete = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (event) => {
      event.preventDefault()
      event.stopPropagation()
      onRemove(group.id)
    },
    [group.id, onRemove],
  )

  const handleOpenEditorClick = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (event) => {
      event.preventDefault()
      event.stopPropagation()
      handleOpenEditor()
    },
    [handleOpenEditor],
  )

  const handleHeaderClick = useCallback<
    React.MouseEventHandler<HTMLDivElement>
  >(
    (event) => {
      handleToggleCollapsed(event)
    },
    [handleToggleCollapsed],
  )

  const handleOverlayPointerDown = useCallback<
    React.PointerEventHandler<HTMLDivElement>
  >((event) => {
    event.stopPropagation()
  }, [])

  const handleOverlayWheelCapture = useCallback<
    React.WheelEventHandler<HTMLDivElement>
  >((event) => {
    event.stopPropagation()
  }, [])

  const handleNameChange = useCallback(
    (nextName: string) => {
      setNameDraft(nextName)
      if (nextName.trim()) {
        onUpdate(group.id, { name: nextName.trim() })
      }
    },
    [group.id, onUpdate],
  )

  const handleWidthChange = useCallback(
    (value: string) => {
      commitSizeDrafts(value, heightDraft)
    },
    [commitSizeDrafts, heightDraft],
  )

  const handleHeightChange = useCallback(
    (value: string) => {
      commitSizeDrafts(widthDraft, value)
    },
    [commitSizeDrafts, widthDraft],
  )

  const handleCornerRadiusChange = useCallback(
    (value: number) => {
      const nextCornerRadius = clampCardCornerRadius(value)

      setCornerRadiusDraft(nextCornerRadius)
      onUpdate(group.id, { cornerRadius: nextCornerRadius })
    },
    [group.id, onUpdate],
  )

  const handleShowTitleChange = useCallback(
    (value: boolean) => {
      setShowTitleDraft(value)
      onUpdate(group.id, { showTitle: value })
    },
    [group.id, onUpdate],
  )

  const handleSurfaceTransparencyChange = useCallback(
    (value: SurfaceTransparency) => {
      const nextValue = clampSurfaceTransparency(value)

      setSurfaceTransparencyDraft(nextValue)
      onUpdate(group.id, { surfaceTransparency: nextValue })
    },
    [group.id, onUpdate],
  )

  const handleShadowStyleChange = useCallback(
    (value: SurfaceShadowStyle) => {
      setShadowStyleDraft(value)
      onUpdate(group.id, { shadowStyle: value })
    },
    [group.id, onUpdate],
  )

  return (
    <>
      <GroupFrameView
        articleRef={articleRef}
        createResizePointerDown={createResizePointerDown}
        group={group}
        isEditMode={isEditMode}
        isSelected={isSelected}
        resolvedShadowStyle={resolvedShadowStyle}
        resolvedSurfaceTransparency={resolvedSurfaceTransparency}
        viewModel={viewModel}
        onCollapseToggleButtonPointerDown={
          handleCollapseToggleButtonPointerDown
        }
        onDelete={handleDelete}
        onHeaderClick={handleHeaderClick}
        onHeaderPointerDown={handleHeaderPointerDown}
        onOpenEditor={handleOpenEditorClick}
        onToggleCollapsed={handleToggleCollapsed}
      />
      {isEditing ? (
        <GroupFrameEditOverlay
          activeColorSettings={activeColorSettings}
          borderPresetIndexDraft={borderPresetIndexDraft}
          cornerRadiusDraft={cornerRadiusDraft}
          editPanelRef={editPanelRef}
          editPanelStyle={editPanelStyle}
          fillPresetIndexDraft={fillPresetIndexDraft}
          group={group}
          heightDraft={heightDraft}
          nameDraft={nameDraft}
          normalizedGroupSize={normalizedGroupSize}
          selectedBorderColor={selectedBorderColor}
          selectedFillColor={selectedFillColor}
          shadowStyleDraft={shadowStyleDraft}
          showTitleDraft={showTitleDraft}
          surfaceTransparencyDraft={surfaceTransparencyDraft}
          widthDraft={widthDraft}
          onClose={handleCloseEditor}
          onCopyFormat={handleCopyFormat}
          onCornerRadiusChange={handleCornerRadiusChange}
          onCustomBorderColorChange={(color) => {
            commitBorderSelection(null, color)
          }}
          onCustomFillColorChange={(color) => {
            commitFillSelection(null, color)
          }}
          onHeightChange={handleHeightChange}
          onNameChange={handleNameChange}
          onPointerDown={handleOverlayPointerDown}
          onResetBorderPresets={() => {
            setBorderPresets(defaultColorPresets.borderPresets)
          }}
          onResetFillPresets={() => {
            setFillPresets(defaultColorPresets.fillPresets)
          }}
          onSaveBorderPresets={setBorderPresets}
          onSaveFillPresets={setFillPresets}
          onSelectBorderPreset={(index) => {
            commitBorderSelection(index, null)
          }}
          onSelectFillPreset={(index) => {
            commitFillSelection(index, null)
          }}
          onShadowStyleChange={handleShadowStyleChange}
          onShowTitleChange={handleShowTitleChange}
          onSurfaceTransparencyChange={handleSurfaceTransparencyChange}
          onWheelCapture={handleOverlayWheelCapture}
          onWidthChange={handleWidthChange}
        />
      ) : null}
    </>
  )
})
