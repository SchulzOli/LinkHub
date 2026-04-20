import { useMemo, type CSSProperties } from 'react'

import type { AppearanceProfile } from '../../contracts/appearanceProfile'
import {
  getGroupChromeMetrics,
  getGroupCornerRadii,
  getGroupLayoutSize,
  type CardGroup,
} from '../../contracts/cardGroup'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'
import type { Viewport } from '../../contracts/workspace'
import {
  getSurfaceLayerColor,
  getSurfaceShadow,
} from '../../features/appearance/surfaceEffects'
import {
  getCardPixelDimensions,
  getOverlayActionMetrics,
} from '../../features/appearance/themeTokens'

type UseGroupFrameViewModelArgs = {
  appearance: AppearanceProfile
  group: CardGroup
  guide: PlacementGuide
  resolvedGroupColors: { borderColor: string; fillColor: string }
  resolvedShadowStyle: SurfaceShadowStyle
  resolvedSurfaceTransparency: SurfaceTransparency
  viewport: Viewport
}

export type GroupFrameViewModel = {
  actionMetrics: ReturnType<typeof getOverlayActionMetrics>
  chromeMetrics: ReturnType<typeof getGroupChromeMetrics>
  displayTitle: string
  groupCornerRadii: ReturnType<typeof getGroupCornerRadii>
  groupStyle: CSSProperties & Record<string, string | number>
  isCollapsed: boolean
  layoutSize: ReturnType<typeof getGroupLayoutSize>
  resolvedCornerRadius: number
  size: { width: number; height: number }
}

export function useGroupFrameViewModel({
  appearance,
  group,
  guide,
  resolvedGroupColors,
  resolvedShadowStyle,
  resolvedSurfaceTransparency,
  viewport,
}: UseGroupFrameViewModelArgs): GroupFrameViewModel {
  const isCollapsed = group.collapsed === true
  const layoutSize = getGroupLayoutSize(group)
  const size = getCardPixelDimensions(layoutSize, guide.gridSize)
  const chromeMetrics = getGroupChromeMetrics(layoutSize, guide.gridSize)
  const resolvedCornerRadius =
    group.cornerRadius ?? appearance.defaultCardCornerRadius
  const groupCornerRadii = getGroupCornerRadii({
    collapsed: isCollapsed,
    cornerRadius: resolvedCornerRadius,
    gridSize: guide.gridSize,
    size: layoutSize,
  })
  const actionMetrics = getOverlayActionMetrics(size.width, size.height)
  const displayTitle = group.name.trim() || 'Group'

  const groupStyle = useMemo<CSSProperties & Record<string, string | number>>(
    () => ({
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
    }),
    [
      actionMetrics.buttonSize,
      actionMetrics.gap,
      actionMetrics.iconSize,
      actionMetrics.offset,
      appearance,
      chromeMetrics.gap,
      chromeMetrics.headerHeight,
      chromeMetrics.padding,
      group.positionX,
      group.positionY,
      groupCornerRadii.bodyBottomRadius,
      groupCornerRadii.bodyTopRadius,
      groupCornerRadii.headerBottomRadius,
      groupCornerRadii.headerTopRadius,
      groupCornerRadii.shellBottomRadius,
      groupCornerRadii.shellTopRadius,
      resolvedGroupColors.borderColor,
      resolvedGroupColors.fillColor,
      resolvedShadowStyle,
      resolvedSurfaceTransparency,
      size.height,
      size.width,
      viewport.x,
      viewport.y,
      viewport.zoom,
    ],
  )

  return {
    actionMetrics,
    chromeMetrics,
    displayTitle,
    groupCornerRadii,
    groupStyle,
    isCollapsed,
    layoutSize,
    resolvedCornerRadius,
    size,
  }
}
