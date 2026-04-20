import { useMemo, type CSSProperties } from 'react'

import type { AppearanceProfile } from '../../contracts/appearanceProfile'
import type { LinkCard as LinkCardModel } from '../../contracts/linkCard'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'
import type { Viewport } from '../../contracts/workspace'
import {
  applyColorOpacity,
  getReadableTextColor,
  isDarkSurfaceColor,
} from '../../features/appearance/surfaceContrast'
import {
  getScaledShadow,
  getSurfaceLayerColor,
  getSurfaceShadow,
} from '../../features/appearance/surfaceEffects'
import {
  getCardPixelDimensions,
  getOverlayActionMetrics,
} from '../../features/appearance/themeTokens'

function roundToDevicePixel(value: number) {
  if (typeof window === 'undefined') {
    return value
  }

  const pixelRatio = window.devicePixelRatio || 1

  return Math.round(value * pixelRatio) / pixelRatio
}

type UseLinkCardViewModelArgs = {
  appearance: AppearanceProfile
  card: LinkCardModel
  guide: PlacementGuide
  resolvedCardColors: {
    borderColor: string
    fillColor: string
  }
  resolvedCardImageUrl: string | null | undefined
  resolvedShadowStyle: SurfaceShadowStyle
  resolvedSurfaceTransparency: SurfaceTransparency
  viewport: Viewport
}

export type LinkCardViewModel = {
  cardImageLayout: string
  cardLayout: string
  cardStyle: CSSProperties & Record<string, string | number>
  displayUrl: string
  isCircularShape: boolean
  linkClassName: string
  openLinkInNewTab: boolean
  resolvedCardImageUrl: string | null | undefined
  resolvedCornerRadius: number
  resolvedShadowStyle: SurfaceShadowStyle
  resolvedSurfaceTransparency: SurfaceTransparency
  showCardImage: boolean
  showCardTitle: boolean
  titleFallbackText: string
  usesContainedTitleImage: boolean
  usesEdgeToEdgeCardImage: boolean
}

export function useLinkCardViewModel({
  appearance,
  card,
  guide,
  resolvedCardColors,
  resolvedCardImageUrl,
  resolvedShadowStyle,
  resolvedSurfaceTransparency,
  viewport,
}: UseLinkCardViewModelArgs) {
  const size = getCardPixelDimensions(card.size, guide.gridSize)
  const displayUrl = useMemo(() => {
    try {
      const parsed = new URL(card.url)
      const pathname = parsed.pathname === '/' ? '' : parsed.pathname

      return `${parsed.hostname.replace(/^www\./, '')}${pathname}${parsed.search}${parsed.hash}`
    } catch {
      return card.url.replace(/^https?:\/\//, '')
    }
  }, [card.url])
  const titleText = card.title.trim()
  const titleFallbackText = titleText.length > 0 ? titleText : displayUrl.trim()
  const wantsCardTitle =
    (card.showTitle ?? appearance.defaultCardShowTitle) &&
    titleFallbackText.length > 0
  const showCardImage = card.showImage ?? appearance.defaultCardShowImage
  const openLinkInNewTab = appearance.defaultCardOpenInNewTab
  const showCardTitle = wantsCardTitle
  const visibleContentCount = Number(showCardTitle) + Number(showCardImage)
  const usesFullBleedCardImageSource =
    Boolean(card.faviconOverrideImageId) ||
    (typeof resolvedCardImageUrl === 'string' &&
      resolvedCardImageUrl.startsWith('blob:'))
  const usesEdgeToEdgeCardImage =
    showCardImage &&
    typeof resolvedCardImageUrl === 'string' &&
    resolvedCardImageUrl.length > 0 &&
    usesFullBleedCardImageSource
  const usesContainedTitleImage =
    showCardImage &&
    showCardTitle &&
    typeof resolvedCardImageUrl === 'string' &&
    resolvedCardImageUrl.length > 0 &&
    !usesEdgeToEdgeCardImage
  const compactDimension = Math.min(size.width, size.height)
  const containedImagePadding = Math.max(
    6,
    Math.min(18, Math.round(compactDimension * 0.08)),
  )
  const cardContentPadding = showCardImage
    ? usesEdgeToEdgeCardImage
      ? 0
      : containedImagePadding
    : Math.max(6, Math.round(compactDimension * 0.08))
  const availableContentWidth = Math.max(0, size.width - cardContentPadding * 2)
  const availableContentHeight = Math.max(
    0,
    size.height - cardContentPadding * 2,
  )
  const resolvedCornerRadius =
    card.cornerRadius ?? appearance.defaultCardCornerRadius
  const titleLength = titleFallbackText.length
  const titleLengthScale =
    titleLength > 72
      ? 0.74
      : titleLength > 56
        ? 0.82
        : titleLength > 40
          ? 0.9
          : 1
  const overlayCurveFactor = showCardImage
    ? Math.max(0, resolvedCornerRadius - 22) / 28
    : 0
  const isCircularImageCard = showCardImage && resolvedCornerRadius >= 48
  const isCompactCircularImageCard =
    isCircularImageCard && compactDimension <= 104
  const isCompactCircularEdgeToEdgeImageCard =
    isCompactCircularImageCard && usesEdgeToEdgeCardImage
  const titleLineClamp = showCardImage
    ? isCircularImageCard
      ? 1
      : usesEdgeToEdgeCardImage || compactDimension < 92
        ? 2
        : 3
    : 3
  const titleLineHeight = showCardImage
    ? isCircularImageCard
      ? isCompactCircularImageCard
        ? 1.1
        : 1.08
      : usesEdgeToEdgeCardImage
        ? 1.08
        : 1.06
    : 1.04
  const baseTitleFontSize = showCardImage
    ? isCompactCircularImageCard
      ? Math.min(16, Math.max(8, compactDimension * 0.096))
      : Math.min(18, Math.max(9, compactDimension * 0.115))
    : Math.min(24, Math.max(12, compactDimension * 0.18))
  const titleFontSize = Math.max(
    showCardImage ? (isCompactCircularImageCard ? 8 : 9) : 12,
    Math.min(
      baseTitleFontSize * titleLengthScale,
      compactDimension *
        (showCardImage ? (isCompactCircularImageCard ? 0.145 : 0.165) : 0.24),
    ),
  )
  const titleTextBlockHeight = titleFontSize * titleLineHeight * titleLineClamp
  const titleMaxHeight = showCardImage
    ? usesEdgeToEdgeCardImage
      ? Math.max(22, Math.round(availableContentHeight * 0.28))
      : Math.max(22, Math.round(availableContentHeight * 0.32))
    : Math.max(26, availableContentHeight)
  const titleZoneHeight = showCardImage
    ? usesEdgeToEdgeCardImage
      ? Math.min(
          titleMaxHeight,
          Math.max(
            Math.round(titleTextBlockHeight + 8),
            Math.round(availableContentHeight / 4),
          ),
        )
      : Math.min(
          titleMaxHeight,
          Math.max(
            Math.round(titleTextBlockHeight + 10),
            Math.round(availableContentHeight * 0.27),
          ),
        )
    : Math.min(titleMaxHeight, Math.round(titleTextBlockHeight + 18))
  const titlePaddingBlock = showCardImage
    ? usesEdgeToEdgeCardImage
      ? Math.max(4, Math.round(compactDimension * 0.026))
      : Math.max(4, Math.round(compactDimension * 0.038))
    : Math.max(8, Math.round(compactDimension * 0.06))
  const titlePaddingInline = showCardImage
    ? usesEdgeToEdgeCardImage
      ? isCompactCircularEdgeToEdgeImageCard
        ? Math.max(5, Math.round(compactDimension * 0.055))
        : Math.max(4, Math.round(compactDimension * 0.016))
      : Math.max(10, Math.round(cardContentPadding * 1.25))
    : Math.max(10, Math.round(cardContentPadding * 1.25))
  const titleBottomSafeFactor = isCircularImageCard ? 0.08 : 0.14
  const titleSafeBottom = showCardImage
    ? Math.round(
        Math.max(0, compactDimension * titleBottomSafeFactor) *
          overlayCurveFactor,
      )
    : 0
  const titleSafeInline = showCardImage
    ? Math.round(
        Math.max(
          0,
          compactDimension *
            (isCompactCircularEdgeToEdgeImageCard ? 0.05 : 0.075),
        ) * overlayCurveFactor,
      )
    : 0
  const imageShellRadius = showCardImage
    ? Math.round(
        (Math.min(
          Math.max(0, availableContentWidth),
          Math.max(0, availableContentHeight),
        ) *
          resolvedCornerRadius) /
          100,
      )
    : 0
  const containedTitleImageInset = usesContainedTitleImage
    ? Math.max(10, Math.round(compactDimension * 0.05))
    : 0
  const containedCardImageSize =
    showCardImage &&
    typeof resolvedCardImageUrl === 'string' &&
    resolvedCardImageUrl.length > 0 &&
    !usesEdgeToEdgeCardImage
      ? Math.max(
          36,
          usesContainedTitleImage
            ? Math.round(
                Math.min(availableContentWidth, availableContentHeight) -
                  containedTitleImageInset * 2,
              )
            : Math.round(
                Math.min(availableContentWidth, availableContentHeight) * 0.9,
              ),
        )
      : null
  const faviconPadding =
    usesEdgeToEdgeCardImage || usesContainedTitleImage ? '0px' : '0.16rem'
  const containedImageRadius =
    usesContainedTitleImage && containedCardImageSize
      ? Math.round((containedCardImageSize * resolvedCornerRadius) / 100)
      : imageShellRadius
  const faviconRadius = `${containedImageRadius}px`
  const actionMetrics = getOverlayActionMetrics(size.width, size.height)
  const effectiveSurfaceColor = resolvedCardColors.fillColor
  const useDarkSurfaceTreatment = isDarkSurfaceColor(effectiveSurfaceColor)
  const isDarkTheme = appearance.themeMode === 'dark'
  const themeCanvasColor = appearance.styleTokens[appearance.themeMode].bgCanvas
  const lightTitleTextColor = appearance.styleTokens.dark.textPrimary
  const darkTitleTextColor = appearance.styleTokens.light.textPrimary
  const titleUsesOverlayTreatment = usesEdgeToEdgeCardImage && showCardTitle
  const titlePanelOpacity = showCardImage
    ? titleUsesOverlayTreatment
      ? 0.92
      : Math.max(0.78, (100 - resolvedSurfaceTransparency) / 100)
    : 0
  const titlePanelBackgroundColor = showCardImage
    ? applyColorOpacity(resolvedCardColors.fillColor, titlePanelOpacity)
    : 'transparent'
  const titlePanelRadius = showCardImage
    ? isCircularImageCard
      ? Math.max(14, Math.round(compactDimension * 0.22))
      : Math.max(10, Math.round(compactDimension * 0.12))
    : 0
  const titlePanelInsetInline = showCardImage
    ? usesEdgeToEdgeCardImage
      ? isCompactCircularEdgeToEdgeImageCard
        ? Math.max(1, Math.round(compactDimension * 0.01))
        : Math.max(2, Math.round(compactDimension * 0.008))
      : Math.max(6, Math.round(cardContentPadding * 0.55))
    : 0
  const titlePanelInsetTop = showCardImage
    ? usesEdgeToEdgeCardImage
      ? Math.max(6, Math.round(titlePaddingBlock * 0.65))
      : Math.max(4, Math.round(titlePaddingBlock * 0.45))
    : 0
  const titlePanelInsetBottom = showCardImage
    ? usesEdgeToEdgeCardImage
      ? Math.max(4, Math.round(titlePaddingBlock * 0.55))
      : Math.max(3, Math.round(titlePaddingBlock * 0.35))
    : 0
  const titlePanelBlur = titleUsesOverlayTreatment ? 16 : 0
  const effectiveTitleBackgroundColor = showCardImage
    ? titlePanelBackgroundColor
    : applyColorOpacity(
        resolvedCardColors.fillColor,
        (100 - resolvedSurfaceTransparency) / 100,
      )
  const titleColor = getReadableTextColor({
    backgroundColor: effectiveTitleBackgroundColor,
    backgroundBackdropColor: themeCanvasColor,
    lightTextColor: lightTitleTextColor,
    darkTextColor: darkTitleTextColor,
  })
  const titlePanelBorderColor = showCardImage
    ? titleColor === lightTitleTextColor
      ? 'rgba(255, 255, 255, 0.18)'
      : 'rgba(15, 23, 42, 0.12)'
    : 'transparent'
  const titlePanelShadow = showCardImage
    ? titleUsesOverlayTreatment
      ? getScaledShadow(
          isDarkTheme
            ? ([
                [0, 10, 22, -8, 'rgba(0, 0, 0, 0.34)'],
                [0, 0, 0, 1, 'rgba(255, 255, 255, 0.06)'],
              ] as const)
            : ([
                [0, 8, 18, -7, 'rgba(15, 23, 42, 0.18)'],
                [0, 0, 0, 1, 'rgba(15, 23, 42, 0.08)'],
              ] as const),
          viewport.zoom,
        )
      : getScaledShadow(
          useDarkSurfaceTreatment
            ? ([
                [0, 6, 14, -6, 'rgba(0, 0, 0, 0.2)'],
                [0, 0, 0, 1, 'rgba(255, 255, 255, 0.05)'],
              ] as const)
            : ([
                [0, 6, 14, -6, 'rgba(15, 23, 42, 0.14)'],
                [0, 0, 0, 1, 'rgba(15, 23, 42, 0.07)'],
              ] as const),
          viewport.zoom,
        )
    : 'none'
  const imageShellBackground = usesEdgeToEdgeCardImage
    ? getSurfaceLayerColor(
        resolvedCardColors.fillColor,
        resolvedSurfaceTransparency,
      )
    : 'transparent'
  const translatedX = roundToDevicePixel(
    (card.positionX - viewport.x) * viewport.zoom,
  )
  const translatedY = roundToDevicePixel(
    (card.positionY - viewport.y) * viewport.zoom,
  )

  const cardStyle: CSSProperties & Record<string, string | number> = useMemo(
    () => ({
      width: size.width,
      height: size.height,
      ['--card-radius' as const]: `${resolvedCornerRadius}%`,
      ['--card-content-padding' as const]: `${cardContentPadding}px`,
      ['--card-surface' as const]: resolvedCardColors.fillColor,
      ['--card-surface-layer' as const]: getSurfaceLayerColor(
        resolvedCardColors.fillColor,
        resolvedSurfaceTransparency,
      ),
      ['--card-surface-hover-layer' as const]: getSurfaceLayerColor(
        `color-mix(in srgb, ${resolvedCardColors.fillColor} 88%, var(--accent) 12%)`,
        resolvedSurfaceTransparency,
      ),
      ['--card-outline' as const]: resolvedCardColors.borderColor,
      ['--card-shadow' as const]: getSurfaceShadow(
        resolvedShadowStyle,
        appearance,
        viewport.zoom,
      ),
      ['--card-title-size' as const]: `${titleFontSize}px`,
      ['--card-title-line-clamp' as const]: String(titleLineClamp),
      ['--card-title-line-height' as const]: String(titleLineHeight),
      ['--card-title-max-height' as const]: `${titleZoneHeight}px`,
      ['--card-title-zone-height' as const]: `${titleZoneHeight}px`,
      ['--card-title-padding-inline' as const]: `${titlePaddingInline}px`,
      ['--card-title-padding-block' as const]: `${titlePaddingBlock}px`,
      ['--card-title-safe-bottom' as const]: `${titleSafeBottom}px`,
      ['--card-title-safe-inline' as const]: `${titleSafeInline}px`,
      ['--card-title-color' as const]: titleColor,
      ['--card-title-shadow' as const]: 'none',
      ['--card-title-panel-bg' as const]: titlePanelBackgroundColor,
      ['--card-title-panel-border' as const]: titlePanelBorderColor,
      ['--card-title-panel-shadow' as const]: titlePanelShadow,
      ['--card-title-panel-radius' as const]: `${titlePanelRadius}px`,
      ['--card-title-panel-inset-inline' as const]: `${titlePanelInsetInline}px`,
      ['--card-title-panel-inset-top' as const]: `${titlePanelInsetTop}px`,
      ['--card-title-panel-inset-bottom' as const]: `${titlePanelInsetBottom}px`,
      ['--card-title-panel-blur' as const]: `${titlePanelBlur}px`,
      ['--action-button-size' as const]: `${actionMetrics.buttonSize}px`,
      ['--action-icon-size' as const]: `${actionMetrics.iconSize}px`,
      ['--action-bar-gap' as const]: `${actionMetrics.gap}px`,
      ['--action-bar-offset' as const]: `${actionMetrics.offset}px`,
      ['--favicon-size' as const]: containedCardImageSize
        ? `${containedCardImageSize}px`
        : 'clamp(2.75rem, 48%, 4rem)',
      ['--favicon-padding' as const]: faviconPadding,
      ['--favicon-radius' as const]: faviconRadius,
      ['--card-image-size' as const]: '100%',
      ['--card-image-fit' as const]: 'contain',
      ['--card-image-position' as const]: 'center center',
      ['--card-image-radius' as const]: `${containedImageRadius}px`,
      ['--card-image-shell-bg' as const]: imageShellBackground,
      ['--card-image-shell-border' as const]: 'transparent',
      ['--favicon-plate-bg' as const]: 'transparent',
      ['--favicon-plate-border' as const]: 'transparent',
      ['--favicon-filter' as const]: usesEdgeToEdgeCardImage
        ? 'none'
        : useDarkSurfaceTreatment
          ? isDarkTheme
            ? 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.34)) saturate(1.08)'
            : 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.18)) saturate(1.03)'
          : isDarkTheme
            ? 'drop-shadow(0 1px 1px rgba(255, 255, 255, 0.16)) saturate(1.02)'
            : 'drop-shadow(0 1px 1px rgba(255, 255, 255, 0.22)) saturate(0.98)',
      transform: `translate(${translatedX}px, calc(${translatedY}px + var(--card-hover-offset, 0px))) scale(${viewport.zoom})`,
      transformOrigin: 'top left',
    }),
    [
      actionMetrics.buttonSize,
      actionMetrics.gap,
      actionMetrics.iconSize,
      actionMetrics.offset,
      appearance,
      cardContentPadding,
      containedCardImageSize,
      containedImageRadius,
      faviconPadding,
      faviconRadius,
      imageShellBackground,
      isDarkTheme,
      resolvedCardColors.borderColor,
      resolvedCardColors.fillColor,
      resolvedCornerRadius,
      resolvedShadowStyle,
      resolvedSurfaceTransparency,
      size.height,
      size.width,
      titleColor,
      titleFontSize,
      titleLineClamp,
      titleLineHeight,
      titlePaddingBlock,
      titlePaddingInline,
      titlePanelBackgroundColor,
      titlePanelBlur,
      titlePanelBorderColor,
      titlePanelInsetBottom,
      titlePanelInsetInline,
      titlePanelInsetTop,
      titlePanelRadius,
      titlePanelShadow,
      titleSafeBottom,
      titleSafeInline,
      titleZoneHeight,
      translatedX,
      translatedY,
      useDarkSurfaceTreatment,
      usesEdgeToEdgeCardImage,
      viewport.zoom,
    ],
  )

  const cardImageLayout = showCardImage
    ? usesEdgeToEdgeCardImage
      ? showCardTitle
        ? 'edge-to-edge-with-title'
        : 'edge-to-edge'
      : showCardTitle
        ? 'icon-with-title'
        : 'icon-only'
    : 'hidden'
  const cardLayout =
    visibleContentCount === 0
      ? 'empty'
      : visibleContentCount === 1
        ? 'single-content'
        : 'dual-content'
  const linkClassName = [
    'link',
    visibleContentCount === 0 ? 'linkIconOnly' : '',
    visibleContentCount === 1 ? 'linkSingleMeta' : '',
    visibleContentCount > 1 ? 'linkDualMeta' : '',
    !showCardTitle && showCardImage ? 'linkIconOnly' : '',
    usesContainedTitleImage ? 'linkOverlayTitle' : '',
    usesEdgeToEdgeCardImage ? 'linkEdgeToEdgeImage' : '',
    usesEdgeToEdgeCardImage && showCardTitle
      ? 'linkEdgeToEdgeImageWithTitle'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return useMemo(
    () => ({
      cardImageLayout,
      cardLayout,
      cardStyle,
      displayUrl,
      isCircularShape: resolvedCornerRadius >= 48,
      linkClassName,
      openLinkInNewTab,
      resolvedCardImageUrl,
      resolvedCornerRadius,
      resolvedShadowStyle,
      resolvedSurfaceTransparency,
      showCardImage,
      showCardTitle,
      titleFallbackText,
      usesContainedTitleImage,
      usesEdgeToEdgeCardImage,
    }),
    [
      cardImageLayout,
      cardLayout,
      cardStyle,
      displayUrl,
      linkClassName,
      openLinkInNewTab,
      resolvedCardImageUrl,
      resolvedCornerRadius,
      resolvedShadowStyle,
      resolvedSurfaceTransparency,
      showCardImage,
      showCardTitle,
      titleFallbackText,
      usesContainedTitleImage,
      usesEdgeToEdgeCardImage,
    ],
  )
}
