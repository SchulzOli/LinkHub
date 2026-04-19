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
import { createPortal } from 'react-dom'

import styles from './GroupFrame.module.css'

import {
  getGroupChromeMetrics,
  getGroupCornerRadii,
  getGroupLayoutSize,
  GROUP_SIZE_LIMITS,
  parseGroupSizeDraft,
  type CardGroup,
} from '../../contracts/cardGroup'
import {
  CARD_CORNER_RADIUS_LIMITS,
  clampCardCornerRadius,
} from '../../contracts/linkCard'
import type { PictureNode } from '../../contracts/pictureNode'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'
import {
  clampSurfaceTransparency,
  SURFACE_TRANSPARENCY_LIMITS,
} from '../../contracts/surfaceEffects'
import type { Viewport } from '../../contracts/workspace'
import { createFormatPainterFromGroup } from '../../features/appearance/formatPainter'
import {
  getSurfaceLayerColor,
  getSurfaceShadow,
  SURFACE_SHADOW_STYLE_LABELS,
  SURFACE_SHADOW_STYLE_OPTIONS,
} from '../../features/appearance/surfaceEffects'
import {
  getCardPixelDimensions,
  getOverlayActionMetrics,
} from '../../features/appearance/themeTokens'
import { useSurfaceStyles } from '../../features/appearance/useSurfaceStyles'
import {
  getGroupDescendantIds,
  getGroupPlacementFrames,
  getPictureIdsWithinGroupBodies,
  isGroupPlacementBlockedByVisibleGroup,
} from '../../features/groups/groupLayout'
import { getAnchoredOverlayPosition } from '../../features/placement/overlayPlacement'
import { useDragPlacement } from '../../features/placement/useDragPlacement'
import {
  useResizePlacement,
  type ResizeDirection,
} from '../../features/placement/useResizePlacement'
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
import { ColorPresetPicker } from '../ui/ColorPresetPicker'
import { EditIcon } from '../ui/EditIcon'
import { FormatPainterIcon } from '../ui/FormatPainterIcon'
import { isSelectMenuPortalTarget, SelectMenu } from '../ui/SelectMenu'

type GroupFrameProps = {
  group: CardGroup
  groups: CardGroup[]
  pictures: PictureNode[]
  guide: PlacementGuide
  isSelected: boolean
  interactionMode: InteractionMode
  viewport: Viewport
}

export const GroupFrame = memo(function GroupFrame({
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
  const isCollapsed = group.collapsed === true
  const layoutSize = getGroupLayoutSize(group)
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
  const size = getCardPixelDimensions(layoutSize, guide.gridSize)
  const chromeMetrics = getGroupChromeMetrics(layoutSize, guide.gridSize)
  const resolvedCornerRadius =
    group.cornerRadius ?? appearance.defaultCardCornerRadius
  const normalizedGroupSize = useMemo(
    () => parseGroupSizeDraft(widthDraft, heightDraft),
    [heightDraft, widthDraft],
  )
  const groupCornerRadii = getGroupCornerRadii({
    collapsed: isCollapsed,
    cornerRadius: resolvedCornerRadius,
    gridSize: guide.gridSize,
    size: layoutSize,
  })
  const actionMetrics = getOverlayActionMetrics(size.width, size.height)
  const displayTitle = group.name.trim() || 'Group'

  const isEditMode = interactionMode === 'edit'

  const handleGroupMove = useCallback(
    (groupId: string, position: { x: number; y: number }) => {
      onMove(groupId, position, dragPictureIdsRef.current)
    },
    [onMove],
  )

  const handlePointerDown = useDragPlacement({
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

  const commitSizeDrafts = (
    nextWidthDraft: string,
    nextHeightDraft: string,
  ) => {
    setWidthDraft(nextWidthDraft)
    setHeightDraft(nextHeightDraft)

    const nextSize = parseGroupSizeDraft(nextWidthDraft, nextHeightDraft)

    if (!nextSize) {
      return
    }

    onUpdate(group.id, { size: nextSize })
  }

  const commitFillSelection = (
    nextFillPresetIndex: number | null,
    nextFillColor: string | null,
  ) => {
    setFillPresetIndexDraft(nextFillPresetIndex)
    setFillColorDraft(nextFillColor)

    onUpdate(group.id, {
      fillPresetIndex: nextFillPresetIndex ?? undefined,
      fillColor:
        nextFillPresetIndex === null ? (nextFillColor ?? undefined) : undefined,
    })
  }

  const commitBorderSelection = (
    nextBorderPresetIndex: number | null,
    nextBorderColor: string | null,
  ) => {
    setBorderPresetIndexDraft(nextBorderPresetIndex)
    setBorderColorDraft(nextBorderColor)

    onUpdate(group.id, {
      borderPresetIndex: nextBorderPresetIndex ?? undefined,
      borderColor:
        nextBorderPresetIndex === null
          ? (nextBorderColor ?? undefined)
          : undefined,
    })
  }

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

  const resizeHandles: ResizeDirection[] = [
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

  const groupStyle = {
    width: size.width,
    height: size.height,
    ['--group-radius' as const]: `${groupCornerRadii.shellBottomRadius}px`,
    ['--group-shell-top-radius' as const]: `${groupCornerRadii.shellTopRadius}px`,
    ['--group-shell-bottom-radius' as const]: `${groupCornerRadii.shellBottomRadius}px`,
    ['--group-header-top-radius' as const]: `${groupCornerRadii.headerTopRadius}px`,
    ['--group-header-bottom-radius' as const]: `${groupCornerRadii.headerBottomRadius}px`,
    ['--group-body-top-radius' as const]: `${groupCornerRadii.bodyTopRadius}px`,
    ['--group-body-bottom-radius' as const]: `${groupCornerRadii.bodyBottomRadius}px`,
    ['--group-padding' as const]: `${chromeMetrics.padding}px`,
    ['--group-gap' as const]: `${chromeMetrics.gap}px`,
    ['--group-header-height' as const]: `${chromeMetrics.headerHeight}px`,
    ['--group-surface' as const]: resolvedGroupColors.fillColor,
    ['--group-shell-fill' as const]: getSurfaceLayerColor(
      resolvedGroupColors.fillColor,
      resolvedSurfaceTransparency,
    ),
    ['--group-header-fill' as const]: getSurfaceLayerColor(
      `color-mix(in srgb, ${resolvedGroupColors.fillColor} 86%, var(--accent) 14%)`,
      resolvedSurfaceTransparency,
    ),
    ['--group-body-fill' as const]: getSurfaceLayerColor(
      `color-mix(in srgb, ${resolvedGroupColors.fillColor} 92%, white 8%)`,
      resolvedSurfaceTransparency,
    ),
    ['--group-outline' as const]: resolvedGroupColors.borderColor,
    ['--group-shadow' as const]: getSurfaceShadow(
      resolvedShadowStyle,
      appearance,
      viewport.zoom,
    ),
    ['--action-button-size' as const]: `${actionMetrics.buttonSize}px`,
    ['--action-icon-size' as const]: `${actionMetrics.iconSize}px`,
    ['--action-bar-gap' as const]: `${actionMetrics.gap}px`,
    ['--action-bar-offset' as const]: `${actionMetrics.offset}px`,
    transform: `translate(${(group.positionX - viewport.x) * viewport.zoom}px, ${(group.positionY - viewport.y) * viewport.zoom}px) scale(${viewport.zoom})`,
    transformOrigin: 'top left' as const,
  }

  const handleHeaderPointerDown = (event: React.PointerEvent<HTMLElement>) => {
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

    handlePointerDown(event)
  }

  const handleCopyFormat = useCallback(() => {
    startFormatPainter(createFormatPainterFromGroup(group))
    setIsEditing(false)
  }, [group, startFormatPainter])

  const handleCloseEditor = useCallback(() => {
    setIsEditing(false)
  }, [])

  const editPanel =
    isEditing && typeof document !== 'undefined'
      ? createPortal(
          <div
            className={styles.editPanel}
            data-testid="group-edit-panel"
            ref={editPanelRef}
            style={editPanelStyle ?? undefined}
            onPointerDown={(event) => event.stopPropagation()}
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <div className={styles.editPanelHeader}>
              <div className={styles.editPanelHeaderActions}>
                <button
                  aria-label={`Copy format from group ${group.id}`}
                  className={`${styles.secondaryActionButton} ${styles.iconHeaderButton}`}
                  title="Copy format"
                  type="button"
                  onClick={handleCopyFormat}
                >
                  <FormatPainterIcon className={styles.actionSvg} />
                </button>
                <button
                  aria-label={`Exit editor for group ${group.id}`}
                  className={styles.closeEditButton}
                  type="button"
                  onClick={handleCloseEditor}
                >
                  Exit
                </button>
              </div>
            </div>
            <p className={styles.editHint}>
              Apply this styling, shape, and size to other cards or groups.
              Press Escape or click empty canvas to stop.
            </p>
            <label className={styles.editField}>
              <span className={styles.editLabel}>Group name</span>
              <input
                aria-label={`Edit group name for ${group.id}`}
                value={nameDraft}
                onChange={(event) => {
                  const nextName = event.target.value

                  setNameDraft(nextName)
                  if (nextName.trim()) {
                    onUpdate(group.id, { name: nextName.trim() })
                  }
                }}
              />
            </label>
            <div className={styles.editSizeGrid}>
              <label className={styles.editField}>
                <span className={styles.editLabel}>Width</span>
                <input
                  aria-label={`Edit group width for ${group.id}`}
                  inputMode="numeric"
                  min={GROUP_SIZE_LIMITS.min}
                  type="number"
                  value={widthDraft}
                  onChange={(event) =>
                    commitSizeDrafts(event.target.value, heightDraft)
                  }
                />
              </label>
              <label className={styles.editField}>
                <span className={styles.editLabel}>Height</span>
                <input
                  aria-label={`Edit group height for ${group.id}`}
                  inputMode="numeric"
                  min={GROUP_SIZE_LIMITS.min}
                  type="number"
                  value={heightDraft}
                  onChange={(event) =>
                    commitSizeDrafts(widthDraft, event.target.value)
                  }
                />
              </label>
            </div>
            <label className={styles.editField}>
              <span className={styles.editLabel}>Corner radius</span>
              <div className={styles.editSliderRow}>
                <input
                  aria-label={`Edit group corner radius for ${group.id}`}
                  max={CARD_CORNER_RADIUS_LIMITS.max}
                  min={CARD_CORNER_RADIUS_LIMITS.min}
                  type="range"
                  value={cornerRadiusDraft}
                  onChange={(event) => {
                    const nextCornerRadius = clampCardCornerRadius(
                      Number(event.currentTarget.value),
                    )

                    setCornerRadiusDraft(nextCornerRadius)
                    onUpdate(group.id, { cornerRadius: nextCornerRadius })
                  }}
                />
                <span className={styles.editSliderValue}>
                  {cornerRadiusDraft}%
                </span>
              </div>
            </label>
            <label className={styles.editToggleField}>
              <input
                aria-label={`Show title on group ${group.id}`}
                checked={showTitleDraft}
                type="checkbox"
                onChange={(event) => {
                  const nextValue = event.currentTarget.checked

                  setShowTitleDraft(nextValue)
                  onUpdate(group.id, { showTitle: nextValue })
                }}
              />
              <span>Show title</span>
            </label>
            <div className={styles.editEffectGrid}>
              <label className={styles.editField}>
                <span className={styles.editLabel}>Transparency</span>
                <div className={styles.editSliderRow}>
                  <input
                    aria-label={`Edit transparency for group ${group.id}`}
                    className={styles.editSlider}
                    max={SURFACE_TRANSPARENCY_LIMITS.max}
                    min={SURFACE_TRANSPARENCY_LIMITS.min}
                    type="range"
                    value={surfaceTransparencyDraft}
                    onChange={(event) => {
                      const nextValue = clampSurfaceTransparency(
                        Number(event.currentTarget.value),
                      )

                      setSurfaceTransparencyDraft(nextValue)
                      onUpdate(group.id, { surfaceTransparency: nextValue })
                    }}
                  />
                  <span className={styles.editSliderValue}>
                    {surfaceTransparencyDraft}%
                  </span>
                </div>
              </label>
              <label className={styles.editField}>
                <span className={styles.editLabel}>Shadow</span>
                <SelectMenu
                  ariaLabel={`Edit shadow for group ${group.id}`}
                  className={styles.editSelect}
                  options={SURFACE_SHADOW_STYLE_OPTIONS.map((value) => ({
                    value,
                    label: SURFACE_SHADOW_STYLE_LABELS[value],
                  }))}
                  value={shadowStyleDraft}
                  onChange={(nextValue) => {
                    const nextShadowStyle = nextValue as SurfaceShadowStyle

                    setShadowStyleDraft(nextShadowStyle)
                    onUpdate(group.id, { shadowStyle: nextShadowStyle })
                  }}
                />
              </label>
            </div>
            <ColorPresetPicker
              allowCustomColor
              colors={activeColorSettings.fillPresets}
              hint="Use one of your five saved fill presets or pick a free color for this group."
              kind="fill"
              label="Fill color"
              onCustomColorChange={(color) => commitFillSelection(null, color)}
              onResetPresets={() =>
                setFillPresets(defaultColorPresets.fillPresets)
              }
              onSavePresets={setFillPresets}
              onSelectPreset={(index) => commitFillSelection(index, null)}
              selectedColor={selectedFillColor}
              selectedIndex={fillPresetIndexDraft ?? undefined}
            />
            <ColorPresetPicker
              allowCustomColor
              colors={activeColorSettings.borderPresets}
              hint="Use one of your five saved border presets or pick a free color for this group."
              kind="border"
              label="Border color"
              onCustomColorChange={(color) =>
                commitBorderSelection(null, color)
              }
              onResetPresets={() =>
                setBorderPresets(defaultColorPresets.borderPresets)
              }
              onSavePresets={setBorderPresets}
              onSelectPreset={(index) => commitBorderSelection(index, null)}
              selectedColor={selectedBorderColor}
              selectedIndex={borderPresetIndexDraft ?? undefined}
            />
            {!nameDraft.trim() ? (
              <p className={styles.editError}>Enter a group name.</p>
            ) : null}
            {!normalizedGroupSize ? (
              <p className={styles.editError}>
                Enter a width and height of at least {GROUP_SIZE_LIMITS.min}{' '}
                cells.
              </p>
            ) : null}
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <article
        ref={articleRef}
        className={`${styles.group} ${isEditMode ? styles.groupEdit : ''} ${isSelected ? styles.groupSelected : ''}`}
        data-collapsed={String(isCollapsed)}
        data-entity-id={group.id}
        data-entity-kind="group"
        data-selected={isSelected}
        data-surface-transparency={String(resolvedSurfaceTransparency)}
        data-shadow-style={resolvedShadowStyle}
        data-testid={`card-group-${group.id}`}
        style={groupStyle}
      >
        {isEditMode && !isCollapsed
          ? resizeHandles.map((direction) => (
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
        <div className={styles.header}>
          <div
            className={styles.headerSurface}
            data-testid={`card-group-header-${group.id}`}
            onClick={
              !isEditMode
                ? (event) => {
                    handleToggleCollapsed(event)
                  }
                : undefined
            }
            onPointerDown={isEditMode ? handleHeaderPointerDown : undefined}
          >
            <span className={styles.headerMeta}>
              <button
                aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} group ${group.name}`}
                aria-pressed={isCollapsed}
                className={styles.headerGripButton}
                data-testid={`group-collapse-toggle-${group.id}`}
                onClick={handleToggleCollapsed}
                onPointerDown={(event) => event.stopPropagation()}
                title={isCollapsed ? 'Expand group' : 'Collapse group'}
                type="button"
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
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                handleOpenEditor()
              }}
              title="Update group"
              type="button"
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
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onRemove(group.id)
              }}
              title="Delete group"
              type="button"
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
      {editPanel}
    </>
  )
})
