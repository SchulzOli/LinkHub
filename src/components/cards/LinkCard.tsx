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

import styles from './LinkCard.module.css'

import {
  CARD_CORNER_RADIUS_LIMITS,
  CARD_SIZE_LIMITS,
  clampCardCornerRadius,
  parseCardSizeDraft,
  type LinkCard as LinkCardModel,
} from '../../contracts/linkCard'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'
import {
  SURFACE_TRANSPARENCY_LIMITS,
  clampSurfaceTransparency,
} from '../../contracts/surfaceEffects'
import type { Viewport } from '../../contracts/workspace'
import { createFormatPainterFromCard } from '../../features/appearance/formatPainter'
import {
  applyColorOpacity,
  getReadableTextColor,
  isDarkSurfaceColor,
} from '../../features/appearance/surfaceContrast'
import {
  SURFACE_SHADOW_STYLE_LABELS,
  SURFACE_SHADOW_STYLE_OPTIONS,
  getScaledShadow,
  getSurfaceLayerColor,
  getSurfaceShadow,
} from '../../features/appearance/surfaceEffects'
import {
  getCardPixelDimensions,
  getOverlayActionMetrics,
} from '../../features/appearance/themeTokens'
import { useSurfaceStyles } from '../../features/appearance/useSurfaceStyles'
import { isPlacementBlockedByOccupiedItem } from '../../features/groups/groupLayout'
import { useImageAssetUrl } from '../../features/images/useImageAssetUrl'
import {
  createFaviconUrl,
  normalizeUrl,
} from '../../features/links/urlValidation'
import { getAnchoredOverlayPosition } from '../../features/placement/overlayPlacement'
import { getPlaceableItemsSnapshot } from '../../features/placement/placeableItemsSnapshot'
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
import { SelectMenu, isSelectMenuPortalTarget } from '../ui/SelectMenu'

type LinkCardProps = {
  card: LinkCardModel
  guide: PlacementGuide
  isSelected: boolean
  interactionMode: InteractionMode
  viewport: Viewport
}

function roundToDevicePixel(value: number) {
  if (typeof window === 'undefined') {
    return value
  }

  const pixelRatio = window.devicePixelRatio || 1

  return Math.round(value * pixelRatio) / pixelRatio
}

export const LinkCard = memo(function LinkCard({
  card,
  guide,
  isSelected,
  interactionMode,
  viewport,
}: LinkCardProps) {
  const {
    autoEditTarget,
    onClearAutoEditTarget: clearAutoEditTarget,
    onSelectCard: onSelect,
  } = useCanvasSelectionActions()
  const {
    onRecordLinkOpen: recordLinkOpen,
    onRemoveCard: onRemove,
    onRequestCardImageOverridePicker: onRequestImageOverridePicker,
    onUpdateCard: onUpdate,
  } = useCanvasEditActions()
  const { onMoveCard: onMove, onPreviewChange } = useCanvasPlacementActions()
  const { appearance, setBorderPresets, setFillPresets } = useAppearanceStore()
  const startFormatPainter = useWorkspaceStore(
    (state) => state.startFormatPainter,
  )
  const [isEditing, setIsEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(card.title)
  const [urlDraft, setUrlDraft] = useState(card.url)
  const [widthDraft, setWidthDraft] = useState(String(card.size.columns))
  const [heightDraft, setHeightDraft] = useState(String(card.size.rows))
  const [cornerRadiusDraft, setCornerRadiusDraft] = useState(
    card.cornerRadius ?? appearance.defaultCardCornerRadius,
  )
  const [showTitleDraft, setShowTitleDraft] = useState(
    card.showTitle ?? appearance.defaultCardShowTitle,
  )
  const [showImageDraft, setShowImageDraft] = useState(
    card.showImage ?? appearance.defaultCardShowImage,
  )
  const [fillPresetIndexDraft, setFillPresetIndexDraft] = useState<
    number | null
  >(card.fillPresetIndex ?? null)
  const [borderPresetIndexDraft, setBorderPresetIndexDraft] = useState<
    number | null
  >(card.borderPresetIndex ?? null)
  const [fillColorDraft, setFillColorDraft] = useState(card.fillColor ?? null)
  const [borderColorDraft, setBorderColorDraft] = useState(
    card.borderColor ?? null,
  )
  const [surfaceTransparencyDraft, setSurfaceTransparencyDraft] =
    useState<SurfaceTransparency>(
      card.surfaceTransparency ?? appearance.defaultSurfaceTransparency,
    )
  const [shadowStyleDraft, setShadowStyleDraft] = useState<SurfaceShadowStyle>(
    card.shadowStyle ?? appearance.defaultSurfaceShadowStyle,
  )
  const articleRef = useRef<HTMLElement | null>(null)
  const editPanelRef = useRef<HTMLDivElement | null>(null)
  const [editPanelStyle, setEditPanelStyle] = useState<CSSProperties | null>(
    null,
  )
  const tooltipTimeoutRef = useRef<number | null>(null)
  const [isUrlTooltipVisible, setIsUrlTooltipVisible] = useState(false)
  const [urlTooltipStyle, setUrlTooltipStyle] = useState<CSSProperties | null>(
    null,
  )
  const autoEditCardId =
    autoEditTarget?.kind === 'card' ? autoEditTarget.id : null
  const overrideImageUrl = useImageAssetUrl(card.faviconOverrideImageId)
  const {
    activeColorSettings,
    defaultColorPresets,
    resolvedColors: resolvedCardColors,
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
    entity: card,
  })

  const isEditMode = interactionMode === 'edit'

  const handlePointerDown = useDragPlacement({
    cardId: card.id,
    cardSize: card.size,
    position: { x: card.positionX, y: card.positionY },
    getCards: getPlaceableItemsSnapshot,
    enabled: isEditMode && !isEditing,
    guide,
    isOccupiedItemBlocking: (candidate, occupiedItem, currentGuide) =>
      isPlacementBlockedByOccupiedItem({
        candidate,
        gridSize: currentGuide.gridSize,
        occupiedItem,
      }),
    viewport,
    onMove,
    onPreviewChange,
  })
  const createResizePointerDown = useResizePlacement({
    card,
    getCards: getPlaceableItemsSnapshot,
    enabled: isEditMode && !isEditing,
    guide,
    isOccupiedItemBlocking: (candidate, occupiedItem, currentGuide) =>
      isPlacementBlockedByOccupiedItem({
        candidate,
        gridSize: currentGuide.gridSize,
        occupiedItem,
      }),
    viewport,
    onResize: (cardId, frame) => {
      onUpdate(cardId, {
        size: frame.size,
        positionX: frame.position.x,
        positionY: frame.position.y,
      })
    },
    onPreviewChange,
  })

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
  const resolvedCardImageUrl = card.faviconOverrideImageId
    ? overrideImageUrl
    : card.faviconUrl
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
  const imageFit = 'contain'
  const actionMetrics = getOverlayActionMetrics(size.width, size.height)
  const normalizedUpdateUrl = useMemo(() => normalizeUrl(urlDraft), [urlDraft])
  const normalizedCardSize = useMemo(
    () => parseCardSizeDraft(widthDraft, heightDraft),
    [heightDraft, widthDraft],
  )
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
  const effectiveTitleBackgroundBackdropColor = themeCanvasColor
  const titleColor = getReadableTextColor({
    backgroundColor: effectiveTitleBackgroundColor,
    backgroundBackdropColor: effectiveTitleBackgroundBackdropColor,
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
  const imageShellBorder = usesEdgeToEdgeCardImage
    ? 'transparent'
    : 'transparent'
  const faviconPlateBackground = 'transparent'
  const faviconPlateBorder = 'transparent'
  const translatedX = roundToDevicePixel(
    (card.positionX - viewport.x) * viewport.zoom,
  )
  const translatedY = roundToDevicePixel(
    (card.positionY - viewport.y) * viewport.zoom,
  )

  const clearUrlTooltipTimer = useCallback(() => {
    if (tooltipTimeoutRef.current !== null) {
      window.clearTimeout(tooltipTimeoutRef.current)
      tooltipTimeoutRef.current = null
    }
  }, [])

  const hideUrlTooltip = useCallback(() => {
    clearUrlTooltipTimer()
    setIsUrlTooltipVisible(false)
    setUrlTooltipStyle(null)
  }, [clearUrlTooltipTimer])

  const scheduleUrlTooltip = useCallback(() => {
    if (isEditMode) {
      return
    }

    clearUrlTooltipTimer()
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setIsUrlTooltipVisible(true)
      tooltipTimeoutRef.current = null
    }, 500)
  }, [clearUrlTooltipTimer, isEditMode])

  const commitUrlDraft = (nextUrlDraft: string) => {
    setUrlDraft(nextUrlDraft)

    const normalizedUrl = normalizeUrl(nextUrlDraft)

    if (!normalizedUrl) {
      return
    }

    onUpdate(card.id, {
      url: normalizedUrl,
      faviconUrl: createFaviconUrl(normalizedUrl),
    })
  }

  const commitSizeDrafts = (
    nextWidthDraft: string,
    nextHeightDraft: string,
  ) => {
    setWidthDraft(nextWidthDraft)
    setHeightDraft(nextHeightDraft)

    const nextSize = parseCardSizeDraft(nextWidthDraft, nextHeightDraft)

    if (!nextSize) {
      return
    }

    onUpdate(card.id, {
      size: nextSize,
    })
  }

  const commitFillSelection = (
    nextFillPresetIndex: number | null,
    nextFillColor: string | null,
  ) => {
    setFillPresetIndexDraft(nextFillPresetIndex)
    setFillColorDraft(nextFillColor)

    onUpdate(card.id, {
      fillPresetIndex: nextFillPresetIndex ?? undefined,
      fillColor:
        nextFillPresetIndex === null ? (nextFillColor ?? undefined) : undefined,
    })
  }

  const handleRecordLinkOpen = useCallback(() => {
    recordLinkOpen(card.id)
  }, [card.id, recordLinkOpen])

  const commitBorderSelection = (
    nextBorderPresetIndex: number | null,
    nextBorderColor: string | null,
  ) => {
    setBorderPresetIndexDraft(nextBorderPresetIndex)
    setBorderColorDraft(nextBorderColor)

    onUpdate(card.id, {
      borderPresetIndex: nextBorderPresetIndex ?? undefined,
      borderColor:
        nextBorderPresetIndex === null
          ? (nextBorderColor ?? undefined)
          : undefined,
    })
  }

  const handleOpenEditor = useCallback(() => {
    setTitleDraft(card.title)
    setUrlDraft(card.url)
    setWidthDraft(String(card.size.columns))
    setHeightDraft(String(card.size.rows))
    setCornerRadiusDraft(
      card.cornerRadius ?? appearance.defaultCardCornerRadius,
    )
    setShowTitleDraft(card.showTitle ?? appearance.defaultCardShowTitle)
    setShowImageDraft(card.showImage ?? appearance.defaultCardShowImage)
    setFillPresetIndexDraft(
      card.fillPresetIndex ?? activeColorSettings.defaultFillPresetIndex,
    )
    setBorderPresetIndexDraft(
      card.borderPresetIndex ?? activeColorSettings.defaultBorderPresetIndex,
    )
    setFillColorDraft(
      card.fillPresetIndex === undefined ? (card.fillColor ?? null) : null,
    )
    setBorderColorDraft(
      card.borderPresetIndex === undefined ? (card.borderColor ?? null) : null,
    )
    setSurfaceTransparencyDraft(
      card.surfaceTransparency ?? appearance.defaultSurfaceTransparency,
    )
    setShadowStyleDraft(
      card.shadowStyle ?? appearance.defaultSurfaceShadowStyle,
    )
    hideUrlTooltip()
    setEditPanelStyle(null)
    setIsEditing(true)
  }, [
    activeColorSettings.defaultBorderPresetIndex,
    activeColorSettings.defaultFillPresetIndex,
    appearance,
    card,
    hideUrlTooltip,
  ])

  useEffect(() => {
    if (!isEditMode || isEditing || autoEditCardId !== card.id) {
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
    autoEditCardId,
    card.id,
    clearAutoEditTarget,
    handleOpenEditor,
    isEditMode,
    isEditing,
  ])

  useEffect(() => {
    return () => {
      clearUrlTooltipTimer()
    }
  }, [clearUrlTooltipTimer])

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

      hideUrlTooltip()
      setEditPanelStyle(null)
      setIsEditing(false)
    }

    document.addEventListener('pointerdown', handlePointerDownOutside)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside)
    }
  }, [hideUrlTooltip, isEditing])

  useLayoutEffect(() => {
    if (!isUrlTooltipVisible || isEditMode) {
      return
    }

    const updateUrlTooltipPosition = () => {
      const articleRect = articleRef.current?.getBoundingClientRect()

      if (!articleRect) {
        return
      }

      const viewportPadding = 8
      const anchorGap = 9
      const left = Math.max(
        viewportPadding,
        Math.min(
          articleRect.left + articleRect.width / 2,
          window.innerWidth - viewportPadding,
        ),
      )
      const top = Math.max(viewportPadding, articleRect.top - anchorGap)

      setUrlTooltipStyle({
        left: `${left}px`,
        top: `${top}px`,
      })
    }

    const animationFrameId = window.requestAnimationFrame(
      updateUrlTooltipPosition,
    )

    window.addEventListener('resize', updateUrlTooltipPosition)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', updateUrlTooltipPosition)
    }
  }, [
    card.positionX,
    card.positionY,
    isEditMode,
    isUrlTooltipVisible,
    size.height,
    size.width,
    viewport.x,
    viewport.y,
    viewport.zoom,
  ])

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
    card.positionX,
    card.positionY,
    card.size.columns,
    card.size.rows,
    isEditing,
    viewport.x,
    viewport.y,
    viewport.zoom,
  ])

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
      ['--card-image-fit' as const]: imageFit,
      ['--card-image-position' as const]: 'center center',
      ['--card-image-radius' as const]: `${containedImageRadius}px`,
      ['--card-image-shell-bg' as const]: imageShellBackground,
      ['--card-image-shell-border' as const]: imageShellBorder,
      ['--favicon-plate-bg' as const]: faviconPlateBackground,
      ['--favicon-plate-border' as const]: faviconPlateBorder,
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
      containedImageRadius,
      containedCardImageSize,
      faviconPadding,
      faviconRadius,
      faviconPlateBackground,
      faviconPlateBorder,
      imageFit,
      imageShellBackground,
      imageShellBorder,
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
      titlePanelBackgroundColor,
      titlePanelBlur,
      titlePanelBorderColor,
      titlePanelInsetBottom,
      titlePanelInsetInline,
      titlePanelInsetTop,
      titlePanelShadow,
      titlePanelRadius,
      titlePaddingInline,
      titlePaddingBlock,
      titleSafeBottom,
      titleSafeInline,
      titleZoneHeight,
      translatedX,
      translatedY,
      usesEdgeToEdgeCardImage,
      useDarkSurfaceTreatment,
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
    styles.link,
    visibleContentCount === 0 ? styles.linkIconOnly : '',
    visibleContentCount === 1 ? styles.linkSingleMeta : '',
    visibleContentCount > 1 ? styles.linkDualMeta : '',
    !showCardTitle && showCardImage ? styles.linkIconOnly : '',
    usesContainedTitleImage ? styles.linkOverlayTitle : '',
    usesEdgeToEdgeCardImage ? styles.linkEdgeToEdgeImage : '',
    usesEdgeToEdgeCardImage && showCardTitle
      ? styles.linkEdgeToEdgeImageWithTitle
      : '',
  ]
    .filter(Boolean)
    .join(' ')

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

  const handleCopyFormat = useCallback(() => {
    startFormatPainter(createFormatPainterFromCard(card))
    hideUrlTooltip()
    setIsEditing(false)
  }, [card, hideUrlTooltip, startFormatPainter])

  const handleCloseEditor = useCallback(() => {
    hideUrlTooltip()
    setIsEditing(false)
  }, [hideUrlTooltip])

  const content = (
    <>
      {showCardImage ? (
        <div className={styles.cardHeader}>
          <div className={styles.faviconShell}>
            {resolvedCardImageUrl ? (
              <img
                alt=""
                className={`${styles.favicon} ${usesEdgeToEdgeCardImage ? styles.faviconImageSource : styles.faviconIconSource}`}
                data-testid="card-image"
                draggable={false}
                loading="lazy"
                src={resolvedCardImageUrl}
                onDragStart={(event) => {
                  event.preventDefault()
                }}
                onError={(event) => {
                  const image = event.currentTarget as HTMLImageElement

                  if (usesEdgeToEdgeCardImage) {
                    image.style.visibility = 'hidden'
                    return
                  }

                  if (image.dataset.fallbackApplied === 'true') {
                    image.style.visibility = 'hidden'
                    return
                  }

                  image.dataset.fallbackApplied = 'true'
                  image.src = `${new URL(card.url).origin}/favicon.ico`
                }}
              />
            ) : (
              <div className={styles.placeholder}>Image unavailable</div>
            )}
            {showCardTitle ? (
              <div className={styles.titleOverlay}>
                <h2
                  className={`${styles.title} ${styles.overlayTitle}`}
                  data-testid="card-title"
                >
                  {titleFallbackText}
                </h2>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {showCardTitle && !showCardImage ? (
        <div className={styles.textOnlyFrame}>
          <h2 className={styles.title} data-testid="card-title">
            {titleFallbackText}
          </h2>
        </div>
      ) : null}
    </>
  )

  const editPanel =
    isEditing && typeof document !== 'undefined'
      ? createPortal(
          <div
            className={styles.editPanel}
            data-testid="card-edit-panel"
            ref={editPanelRef}
            style={editPanelStyle ?? undefined}
            onPointerDown={(event) => {
              event.stopPropagation()
            }}
            onWheelCapture={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.editPanelHeader}>
              <div className={styles.editPanelHeaderActions}>
                <button
                  aria-label={`Copy format from ${card.id}`}
                  className={`${styles.secondaryActionButton} ${styles.iconHeaderButton}`}
                  title="Copy format"
                  type="button"
                  onClick={handleCopyFormat}
                >
                  <FormatPainterIcon className={styles.actionSvg} />
                </button>
                <button
                  aria-label={`Exit editor for ${card.id}`}
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
              <span className={styles.editLabel}>Title</span>
              <input
                aria-label={`Edit title for ${card.id}`}
                value={titleDraft}
                onChange={(event) => {
                  const nextTitle = event.target.value

                  setTitleDraft(nextTitle)
                  onUpdate(card.id, { title: nextTitle })
                }}
              />
            </label>
            <label className={styles.editField}>
              <span className={styles.editLabel}>URL</span>
              <input
                aria-label={`Edit url for ${card.id}`}
                value={urlDraft}
                onChange={(event) => commitUrlDraft(event.target.value)}
              />
            </label>
            <div className={styles.editField}>
              <span className={styles.editLabel}>Custom image</span>
              <div className={styles.editActionRow}>
                <button
                  className={styles.secondaryActionButton}
                  type="button"
                  onClick={() => onRequestImageOverridePicker(card.id)}
                >
                  {card.faviconOverrideImageId
                    ? 'Change image'
                    : 'Choose from gallery'}
                </button>
                {card.faviconOverrideImageId ? (
                  <button
                    className={styles.secondaryActionButton}
                    type="button"
                    onClick={() =>
                      onUpdate(card.id, { faviconOverrideImageId: undefined })
                    }
                  >
                    Use default favicon
                  </button>
                ) : null}
              </div>
              <p className={styles.editHint}>
                {card.faviconOverrideImageId
                  ? 'A gallery image currently replaces the default favicon for this card.'
                  : 'The backend favicon stays active until you choose a custom gallery image.'}
              </p>
            </div>
            <div className={styles.editSizeGrid}>
              <label className={styles.editField}>
                <span className={styles.editLabel}>Width</span>
                <input
                  aria-label={`Edit width for ${card.id}`}
                  inputMode="numeric"
                  max={CARD_SIZE_LIMITS.max}
                  min={CARD_SIZE_LIMITS.min}
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
                  aria-label={`Edit height for ${card.id}`}
                  inputMode="numeric"
                  max={CARD_SIZE_LIMITS.max}
                  min={CARD_SIZE_LIMITS.min}
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
                  aria-label={`Edit corner radius for ${card.id}`}
                  className={styles.editSlider}
                  max={CARD_CORNER_RADIUS_LIMITS.max}
                  min={CARD_CORNER_RADIUS_LIMITS.min}
                  type="range"
                  value={cornerRadiusDraft}
                  onChange={(event) => {
                    const nextCornerRadius = clampCardCornerRadius(
                      Number(event.currentTarget.value),
                    )

                    setCornerRadiusDraft(nextCornerRadius)
                    onUpdate(card.id, {
                      cornerRadius: nextCornerRadius,
                    })
                  }}
                />
                <span className={styles.editSliderValue}>
                  {cornerRadiusDraft}%
                </span>
              </div>
            </label>
            <div className={styles.editToggleGrid}>
              <label className={styles.editToggleField}>
                <input
                  aria-label={`Show title on ${card.id}`}
                  checked={showTitleDraft}
                  type="checkbox"
                  onChange={(event) => {
                    const nextValue = event.currentTarget.checked

                    setShowTitleDraft(nextValue)
                    onUpdate(card.id, { showTitle: nextValue })
                  }}
                />
                <span>Show title</span>
              </label>
              <label className={styles.editToggleField}>
                <input
                  aria-label={`Show image on ${card.id}`}
                  checked={showImageDraft}
                  type="checkbox"
                  onChange={(event) => {
                    const nextValue = event.currentTarget.checked

                    setShowImageDraft(nextValue)
                    onUpdate(card.id, { showImage: nextValue })
                  }}
                />
                <span>Show image</span>
              </label>
            </div>
            <div className={styles.editEffectGrid}>
              <label className={styles.editField}>
                <span className={styles.editLabel}>Transparency</span>
                <div className={styles.editSliderRow}>
                  <input
                    aria-label={`Edit transparency for ${card.id}`}
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
                      onUpdate(card.id, { surfaceTransparency: nextValue })
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
                  ariaLabel={`Edit shadow for ${card.id}`}
                  className={styles.editSelect}
                  options={SURFACE_SHADOW_STYLE_OPTIONS.map((value) => ({
                    value,
                    label: SURFACE_SHADOW_STYLE_LABELS[value],
                  }))}
                  value={shadowStyleDraft}
                  onChange={(nextValue) => {
                    const nextShadowStyle = nextValue as SurfaceShadowStyle

                    setShadowStyleDraft(nextShadowStyle)
                    onUpdate(card.id, { shadowStyle: nextShadowStyle })
                  }}
                />
              </label>
            </div>
            <div className={styles.editColorSection}>
              <ColorPresetPicker
                allowCustomColor
                colors={activeColorSettings.fillPresets}
                hint="Use one of your five saved fill presets or pick a free color for this card."
                kind="fill"
                label="Fill color"
                onCustomColorChange={(color) =>
                  commitFillSelection(null, color)
                }
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
                hint="Use one of your five saved border presets or pick a free color for this card."
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
            </div>
            {!normalizedUpdateUrl ? (
              <p className={styles.editError}>
                Enter a valid http or https URL.
              </p>
            ) : null}
            {!normalizedCardSize ? (
              <p className={styles.editError}>
                Enter a width and height between {CARD_SIZE_LIMITS.min} and{' '}
                {CARD_SIZE_LIMITS.max} cells.
              </p>
            ) : null}
          </div>,
          document.body,
        )
      : null

  const urlTooltip =
    !isEditMode &&
    isUrlTooltipVisible &&
    urlTooltipStyle &&
    typeof document !== 'undefined'
      ? createPortal(
          <span
            className={styles.urlTooltip}
            data-testid="card-url-tooltip"
            role="tooltip"
            style={urlTooltipStyle}
          >
            {displayUrl}
          </span>,
          document.body,
        )
      : null

  return (
    <>
      <article
        ref={articleRef}
        className={
          isEditMode
            ? `${styles.card} ${styles.cardEdit} ${isSelected ? styles.cardSelected : ''}`
            : `${styles.card} ${styles.cardView}`
        }
        data-circular-shape={String(resolvedCornerRadius >= 48)}
        data-card-image-layout={cardImageLayout}
        data-entity-id={card.id}
        data-entity-kind="card"
        data-mode={interactionMode}
        data-selected={isSelected}
        data-shadow-style={resolvedShadowStyle}
        data-surface-transparency={String(resolvedSurfaceTransparency)}
        data-testid={`link-card-${card.id}`}
        data-title-overlay={String(showCardImage && showCardTitle)}
        onBlur={hideUrlTooltip}
        onFocus={scheduleUrlTooltip}
        onPointerEnter={scheduleUrlTooltip}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return
          }

          if (isEditMode && !isEditing) {
            const additive = event.metaKey || event.ctrlKey

            if (additive) {
              onSelect(card.id, true)
              event.preventDefault()
              event.stopPropagation()
              return
            }

            if (!isSelected) {
              onSelect(card.id, false)
            }
          }

          handlePointerDown(event)
        }}
        onPointerLeave={hideUrlTooltip}
        style={cardStyle}
      >
        {isEditMode ? (
          <>
            {resizeHandles.map((direction) => (
              <button
                aria-label={`Resize ${direction}`}
                className={`${styles.resizeHandle} ${resizeHandleClassNameByDirection[direction]}`}
                data-role="resize-handle"
                key={direction}
                onPointerDown={createResizePointerDown(direction)}
                tabIndex={-1}
                type="button"
              />
            ))}
            <div className={linkClassName} data-layout={cardLayout}>
              {content}
            </div>
            <div className={styles.actionBar} data-role="action-bar">
              <button
                aria-label="Update"
                className={styles.actionButton}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  handleOpenEditor()
                }}
                title="Update"
                type="button"
              >
                <span aria-hidden="true" className={styles.actionIcon}>
                  <EditIcon className={styles.actionSvg} />
                </span>
              </button>
              <button
                aria-label="Delete"
                className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onRemove(card.id)
                }}
                title="Delete"
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
          </>
        ) : (
          <a
            className={linkClassName}
            data-layout={cardLayout}
            href={card.url}
            onAuxClick={(event) => {
              if (!event.defaultPrevented && event.button === 1) {
                handleRecordLinkOpen()
              }
            }}
            onClick={(event) => {
              if (!event.defaultPrevented && event.button === 0) {
                handleRecordLinkOpen()
              }
            }}
            rel={openLinkInNewTab ? 'noreferrer' : undefined}
            target={openLinkInNewTab ? '_blank' : undefined}
          >
            {content}
          </a>
        )}
      </article>
      {editPanel}
      {urlTooltip}
    </>
  )
})
