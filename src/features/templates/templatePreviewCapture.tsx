import type { toPng as toPngType } from 'html-to-image'
import type { CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'

import type { AppearanceProfile } from '../../contracts/appearanceProfile'
import {
  getGroupChromeMetrics,
  getGroupLayoutSize,
  type CardGroup,
} from '../../contracts/cardGroup'
import type { LinkCard } from '../../contracts/linkCard'
import type { PictureNode } from '../../contracts/pictureNode'
import type { StoredImageAssetRecord } from '../../storage/imageRepository'
import { resolveCardColors } from '../appearance/cardColorPalette'
import { mixHexColors, withAlpha } from '../appearance/colorMath'
import { getAppearanceStyleTokens } from '../appearance/stylePresets'
import {
  getSurfaceLayerColor,
  getSurfaceShadow,
} from '../appearance/surfaceEffects'
import { getCardPixelDimensions } from '../appearance/themeTokens'
import {
  getCanvasEntityBundlePixelBounds,
  normalizeCanvasEntityBundle,
  type CanvasEntityBundle,
} from '../canvas/entityBundle'

export const TEMPLATE_PREVIEW_WIDTH = 320
export const TEMPLATE_PREVIEW_HEIGHT = 120
export const TEMPLATE_PREVIEW_PADDING = 10
export const TEMPLATE_PREVIEW_GRID_SIZE = 24
const TRANSPARENT_IMAGE_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA='

let htmlToImageModulePromise: Promise<typeof toPngType> | null = null

async function loadToPng(): Promise<typeof toPngType> {
  htmlToImageModulePromise ??= import('html-to-image').then(
    (module) => module.toPng,
  )

  return htmlToImageModulePromise
}

/**
 * Warms the `html-to-image` chunk without invoking it. Safe to call from
 * idle-callback prefetch paths on initial load.
 */
export function prefetchTemplatePreviewCapture() {
  void loadToPng()
}

export type TemplatePreviewAppearance = Pick<
  AppearanceProfile,
  | 'defaultCardCornerRadius'
  | 'defaultCardShowImage'
  | 'defaultCardShowTitle'
  | 'defaultSurfaceShadowStyle'
  | 'defaultSurfaceTransparency'
  | 'stylePreset'
  | 'themeMode'
  | 'fillPresetsByTheme'
  | 'borderPresetsByTheme'
>

type PreviewTransform = {
  scale: number
  x: number
  y: number
}

function getPreviewTransform(bounds: {
  height: number
  left: number
  top: number
  width: number
}) {
  const innerWidth = TEMPLATE_PREVIEW_WIDTH - TEMPLATE_PREVIEW_PADDING * 2
  const innerHeight = TEMPLATE_PREVIEW_HEIGHT - TEMPLATE_PREVIEW_PADDING * 2
  const scale = Math.min(
    innerWidth / bounds.width,
    innerHeight / bounds.height,
    1,
  )
  const offsetX =
    TEMPLATE_PREVIEW_PADDING + (innerWidth - bounds.width * scale) / 2
  const offsetY =
    TEMPLATE_PREVIEW_PADDING + (innerHeight - bounds.height * scale) / 2

  return {
    scale,
    x: offsetX - bounds.left * scale,
    y: offsetY - bounds.top * scale,
  } satisfies PreviewTransform
}

function normalizeDisplayUrl(url: string) {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname
    return `${parsed.hostname.replace(/^www\./, '')}${pathname}${parsed.search}${parsed.hash}`
  } catch {
    return url.replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '')
  }
}

function resolvePreviewImageUrl(imageUrl: string | null) {
  if (!imageUrl) {
    return null
  }

  if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
    return imageUrl
  }

  try {
    const resolvedUrl = new URL(imageUrl, window.location.href)

    return resolvedUrl.origin === window.location.origin
      ? resolvedUrl.toString()
      : null
  } catch {
    return null
  }
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
  })
}

async function waitForImages(container: HTMLElement) {
  const images = [...container.querySelectorAll('img')]

  await Promise.all(
    images.map(async (image) => {
      if (image.complete) {
        return
      }

      if (typeof image.decode === 'function') {
        try {
          await image.decode()
          return
        } catch {
          // Fall back to load/error listeners.
        }
      }

      await new Promise<void>((resolve) => {
        const cleanup = () => {
          image.removeEventListener('load', handleLoad)
          image.removeEventListener('error', handleLoad)
          resolve()
        }
        const handleLoad = () => cleanup()

        image.addEventListener('load', handleLoad, { once: true })
        image.addEventListener('error', handleLoad, { once: true })
      })
    }),
  )
}

function createObjectUrlMap(records: StoredImageAssetRecord[]) {
  const imageUrlById = new Map<string, string>()

  records.forEach((record) => {
    imageUrlById.set(record.asset.id, URL.createObjectURL(record.blob))
  })

  return {
    imageUrlById,
    release: () => {
      imageUrlById.forEach((url) => {
        URL.revokeObjectURL(url)
      })
    },
  }
}

function PreviewGroup(props: {
  appearance: TemplatePreviewAppearance
  group: CardGroup
  transform: PreviewTransform
}) {
  const { appearance, group, transform } = props
  const tokens = getAppearanceStyleTokens(
    appearance.stylePreset,
    appearance.themeMode,
  )
  const colors = resolveCardColors(group, appearance, {
    fillColor: tokens.cardBg,
    borderColor: tokens.cardBorder,
  })
  const layoutSize = getGroupLayoutSize(group)
  const metrics = getGroupChromeMetrics(layoutSize, TEMPLATE_PREVIEW_GRID_SIZE)
  const surfaceTransparency =
    group.surfaceTransparency ?? appearance.defaultSurfaceTransparency
  const shadowStyle = group.shadowStyle ?? appearance.defaultSurfaceShadowStyle
  const width = metrics.pixelWidth * transform.scale
  const height = metrics.pixelHeight * transform.scale
  const compactDimension = Math.min(width, height)
  const radius = Math.max(
    8,
    Math.round(
      (compactDimension *
        (group.cornerRadius ?? appearance.defaultCardCornerRadius)) /
        100,
    ),
  )
  const headerHeight = metrics.headerHeight * transform.scale
  const left = transform.x + group.positionX * transform.scale
  const top = transform.y + group.positionY * transform.scale
  const titleVisible = (group.showTitle ?? true) && group.name.trim().length > 0
  const shellStyle: CSSProperties = {
    position: 'absolute',
    left,
    top,
    width,
    height,
    overflow: 'hidden',
    borderRadius: radius,
    border: `1px solid ${withAlpha(colors.borderColor, 0.88)}`,
    background: withAlpha(colors.fillColor, (100 - surfaceTransparency) / 360),
    boxShadow: getSurfaceShadow(shadowStyle, appearance),
    boxSizing: 'border-box',
  }
  const headerStyle: CSSProperties = {
    position: 'absolute',
    inset: '0 0 auto 0',
    height: Math.min(height, headerHeight + 2),
    background: `linear-gradient(180deg, ${mixHexColors(colors.fillColor, tokens.accent, 0.28)}, ${mixHexColors(colors.fillColor, tokens.accent, 0.14)})`,
    borderBottom: `1px solid ${withAlpha(colors.borderColor, 0.52)}`,
  }
  const titleStyle: CSSProperties = {
    position: 'absolute',
    left: 10,
    right: 10,
    top: Math.max(4, headerHeight * 0.18),
    color: tokens.textPrimary,
    fontFamily: tokens.uiFont,
    fontSize: Math.max(9, Math.min(12, width * 0.06)),
    fontWeight: 700,
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }

  return (
    <div style={shellStyle}>
      <div style={headerStyle} />
      {titleVisible ? <div style={titleStyle}>{group.name.trim()}</div> : null}
    </div>
  )
}

function PreviewPicture(props: {
  appearance: TemplatePreviewAppearance
  imageUrlById: Map<string, string>
  picture: PictureNode
  transform: PreviewTransform
}) {
  const { appearance, imageUrlById, picture, transform } = props
  const tokens = getAppearanceStyleTokens(
    appearance.stylePreset,
    appearance.themeMode,
  )
  const size = getCardPixelDimensions(picture.size, TEMPLATE_PREVIEW_GRID_SIZE)
  const width = size.width * transform.scale
  const height = size.height * transform.scale
  const radius = Math.max(8, Math.round(Math.min(width, height) * 0.08))
  const left = transform.x + picture.positionX * transform.scale
  const top = transform.y + picture.positionY * transform.scale
  const imageUrl = imageUrlById.get(picture.imageId) ?? null
  const shellStyle: CSSProperties = {
    position: 'absolute',
    left,
    top,
    width,
    height,
    overflow: 'hidden',
    borderRadius: radius,
    border: `1px solid ${withAlpha(tokens.panelBorder, 0.88)}`,
    background: withAlpha(tokens.inputBg, 0.94),
    boxShadow: tokens.panelShadow,
    boxSizing: 'border-box',
  }
  const imageStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
  }
  const placeholderStyle: CSSProperties = {
    display: 'grid',
    width: '100%',
    height: '100%',
    placeItems: 'center',
    color: withAlpha(tokens.textMuted, 0.8),
    fontFamily: tokens.uiFont,
    fontSize: Math.max(8, Math.min(11, width * 0.08)),
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }

  return (
    <div style={shellStyle}>
      {imageUrl ? (
        <img alt="" draggable={false} src={imageUrl} style={imageStyle} />
      ) : (
        <div style={placeholderStyle}>Image</div>
      )}
    </div>
  )
}

function PreviewCard(props: {
  appearance: TemplatePreviewAppearance
  card: LinkCard
  imageUrlById: Map<string, string>
  transform: PreviewTransform
}) {
  const { appearance, card, imageUrlById, transform } = props
  const tokens = getAppearanceStyleTokens(
    appearance.stylePreset,
    appearance.themeMode,
  )
  const colors = resolveCardColors(card, appearance, {
    fillColor: tokens.cardBg,
    borderColor: tokens.cardBorder,
  })
  const surfaceTransparency =
    card.surfaceTransparency ?? appearance.defaultSurfaceTransparency
  const shadowStyle = card.shadowStyle ?? appearance.defaultSurfaceShadowStyle
  const size = getCardPixelDimensions(card.size, TEMPLATE_PREVIEW_GRID_SIZE)
  const width = size.width * transform.scale
  const height = size.height * transform.scale
  const compactDimension = Math.min(width, height)
  const left = transform.x + card.positionX * transform.scale
  const top = transform.y + card.positionY * transform.scale
  const cornerRadius = Math.max(
    8,
    Math.round(
      (compactDimension *
        (card.cornerRadius ?? appearance.defaultCardCornerRadius)) /
        100,
    ),
  )
  const showImage = card.showImage ?? appearance.defaultCardShowImage
  const displayUrl = normalizeDisplayUrl(card.url).trim()
  const titleText = card.title.trim() || displayUrl
  const showTitle =
    (card.showTitle ?? appearance.defaultCardShowTitle) && titleText.length > 0
  const resolvedCardImageUrl = card.faviconOverrideImageId
    ? (imageUrlById.get(card.faviconOverrideImageId) ?? null)
    : card.faviconUrl || null
  const previewCardImageUrl = resolvePreviewImageUrl(resolvedCardImageUrl)
  const usesFullBleedCardImageSource =
    Boolean(card.faviconOverrideImageId) ||
    (typeof previewCardImageUrl === 'string' &&
      previewCardImageUrl.startsWith('blob:'))
  const isCircularImageCard =
    showImage && (card.cornerRadius ?? appearance.defaultCardCornerRadius) >= 48
  const isCompactCircularImageCard =
    isCircularImageCard && compactDimension <= 104
  const rootStyle: CSSProperties = {
    position: 'absolute',
    left,
    top,
    width,
    height,
    overflow: 'hidden',
    borderRadius: cornerRadius,
    boxSizing: 'border-box',
    background: getSurfaceLayerColor(colors.fillColor, surfaceTransparency),
    border: usesFullBleedCardImageSource
      ? 'none'
      : `1px solid ${colors.borderColor}`,
    boxShadow: getSurfaceShadow(shadowStyle, appearance),
  }

  const renderContainedImage = () => {
    const imageSize = Math.max(26, Math.round(compactDimension * 0.78))
    const imageRadius = Math.round(
      (imageSize * cornerRadius) / compactDimension,
    )
    const imageStyle: CSSProperties = {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: imageSize,
      height: imageSize,
      transform: 'translate(-50%, -50%)',
      objectFit: 'contain',
      objectPosition: 'center center',
      borderRadius: imageRadius,
      filter:
        appearance.themeMode === 'dark'
          ? 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.34)) saturate(1.08)'
          : 'drop-shadow(0 1px 1px rgba(15, 23, 42, 0.16)) saturate(1.03)',
    }

    if (!previewCardImageUrl) {
      const placeholderStyle: CSSProperties = {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: imageSize,
        height: imageSize,
        transform: 'translate(-50%, -50%)',
        display: 'grid',
        placeItems: 'center',
        borderRadius: imageRadius,
        background: withAlpha(
          tokens.textPrimary,
          appearance.themeMode === 'dark' ? 0.1 : 0.08,
        ),
        boxShadow: `inset 0 0 0 1px ${withAlpha(tokens.textPrimary, appearance.themeMode === 'dark' ? 0.16 : 0.12)}`,
        color: tokens.textPrimary,
        fontFamily: tokens.uiFont,
        fontSize: Math.max(11, Math.min(28, imageSize * 0.42)),
        fontWeight: 700,
        textTransform: 'uppercase',
      }
      const placeholderLabel = (displayUrl || titleText || 'L')
        .replace(/^[^a-z0-9]+/i, '')
        .charAt(0)

      return <div style={placeholderStyle}>{placeholderLabel || 'L'}</div>
    }

    return (
      <img
        alt=""
        draggable={false}
        src={previewCardImageUrl}
        style={imageStyle}
      />
    )
  }

  const renderFullBleedImage = () => {
    if (!previewCardImageUrl) {
      return null
    }

    return (
      <img
        alt=""
        draggable={false}
        src={previewCardImageUrl}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center center',
          borderRadius: cornerRadius,
        }}
      />
    )
  }

  const titleFontSize = isCompactCircularImageCard
    ? Math.max(8, Math.min(12, compactDimension * 0.092))
    : Math.max(9, Math.min(15, compactDimension * 0.115))
  const titlePaddingInline = usesFullBleedCardImageSource
    ? isCompactCircularImageCard
      ? Math.max(5, Math.round(compactDimension * 0.055))
      : Math.max(4, Math.round(compactDimension * 0.016))
    : isCompactCircularImageCard
      ? Math.max(7, Math.round(compactDimension * 0.07))
      : Math.max(8, Math.round(compactDimension * 0.06))

  const titleStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    display: 'grid',
    alignContent: 'center',
    justifyItems: 'center',
    minHeight: Math.max(20, Math.round(height * 0.24)),
    padding: `${Math.max(4, Math.round(compactDimension * 0.035))}px ${titlePaddingInline}px`,
    background: usesFullBleedCardImageSource
      ? 'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.24) 50%, rgba(0, 0, 0, 0.72) 100%)'
      : 'transparent',
    color: showImage ? 'rgba(255, 255, 255, 0.98)' : tokens.textPrimary,
    fontFamily: tokens.uiFont,
    fontSize: titleFontSize,
    fontWeight: 700,
    lineHeight: isCompactCircularImageCard
      ? 1.1
      : usesFullBleedCardImageSource
        ? 1.08
        : 1.06,
    textAlign: 'center',
    textShadow: showImage ? '0 1px 2px rgba(0, 0, 0, 0.42)' : 'none',
    overflow: 'hidden',
    boxSizing: 'border-box',
  }
  const textOnlyStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    padding: Math.max(8, Math.round(compactDimension * 0.08)),
    boxSizing: 'border-box',
    color: tokens.textPrimary,
    fontFamily: tokens.uiFont,
    fontSize: Math.max(10, Math.min(18, compactDimension * 0.12)),
    fontWeight: 700,
    lineHeight: 1.1,
    textAlign: 'center',
  }

  return (
    <div style={rootStyle}>
      {showImage
        ? usesFullBleedCardImageSource
          ? renderFullBleedImage()
          : renderContainedImage()
        : null}
      {showImage && showTitle ? (
        <div style={titleStyle}>
          <div
            style={{
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              padding: '0.02em 0.06em 0.08em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {titleText}
          </div>
        </div>
      ) : null}
      {!showImage && showTitle ? (
        <div style={textOnlyStyle}>{titleText}</div>
      ) : null}
    </div>
  )
}

function TemplatePreviewSurface(props: {
  appearance: TemplatePreviewAppearance
  bundle: CanvasEntityBundle
  imageUrlById: Map<string, string>
}) {
  const { appearance, bundle, imageUrlById } = props
  const bounds = getCanvasEntityBundlePixelBounds(
    bundle,
    TEMPLATE_PREVIEW_GRID_SIZE,
  )

  if (!bounds) {
    return null
  }

  const transform = getPreviewTransform(bounds)
  const tokens = getAppearanceStyleTokens(
    appearance.stylePreset,
    appearance.themeMode,
  )
  const rootStyle: CSSProperties = {
    position: 'relative',
    width: TEMPLATE_PREVIEW_WIDTH,
    height: TEMPLATE_PREVIEW_HEIGHT,
    overflow: 'hidden',
    boxSizing: 'border-box',
    background: `radial-gradient(circle at top center, ${tokens.bgShell}, ${tokens.bgCanvas} 48%)`,
    fontFamily: tokens.uiFont,
    color: tokens.textPrimary,
  }
  const canvasGlowStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `linear-gradient(180deg, ${withAlpha(tokens.accent, 0.05)}, transparent 38%, ${withAlpha(tokens.accentStrong, 0.05)})`,
  }

  return (
    <div style={rootStyle}>
      <div style={canvasGlowStyle} />
      {bundle.groups
        .slice()
        .sort(
          (left, right) =>
            getGroupLayoutSize(right).columns * getGroupLayoutSize(right).rows -
            getGroupLayoutSize(left).columns * getGroupLayoutSize(left).rows,
        )
        .map((group) => (
          <PreviewGroup
            appearance={appearance}
            group={group}
            key={group.id}
            transform={transform}
          />
        ))}
      {bundle.pictures.map((picture) => (
        <PreviewPicture
          appearance={appearance}
          imageUrlById={imageUrlById}
          key={picture.id}
          picture={picture}
          transform={transform}
        />
      ))}
      {bundle.cards.map((card) => (
        <PreviewCard
          appearance={appearance}
          card={card}
          imageUrlById={imageUrlById}
          key={card.id}
          transform={transform}
        />
      ))}
    </div>
  )
}

export async function captureTemplatePreviewDataUrl(input: {
  appearance: TemplatePreviewAppearance
  bundle: CanvasEntityBundle
  imageRecords: StoredImageAssetRecord[]
}) {
  if (typeof document === 'undefined') {
    return undefined
  }

  const normalizedBundle = normalizeCanvasEntityBundle(input.bundle).bundle
  const bounds = getCanvasEntityBundlePixelBounds(
    normalizedBundle,
    TEMPLATE_PREVIEW_GRID_SIZE,
  )

  if (!bounds) {
    return undefined
  }

  const host = document.createElement('div')
  let root: Root | null = null
  const { imageUrlById, release } = createObjectUrlMap(input.imageRecords)

  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = `${TEMPLATE_PREVIEW_WIDTH}px`
  host.style.height = `${TEMPLATE_PREVIEW_HEIGHT}px`
  host.style.opacity = '0'
  host.style.pointerEvents = 'none'
  host.style.zIndex = '-1'

  document.body.appendChild(host)

  try {
    root = createRoot(host)
    flushSync(() => {
      root?.render(
        <TemplatePreviewSurface
          appearance={input.appearance}
          bundle={normalizedBundle}
          imageUrlById={imageUrlById}
        />,
      )
    })

    const previewNode = host.firstElementChild as HTMLElement | null

    if (!previewNode) {
      return undefined
    }

    if ('fonts' in document) {
      try {
        await document.fonts.ready
      } catch {
        // Ignore font readiness failures.
      }
    }

    await waitForImages(previewNode)
    await waitForNextPaint()

    try {
      const toPng = await loadToPng()

      return await toPng(previewNode, {
        cacheBust: true,
        canvasHeight: TEMPLATE_PREVIEW_HEIGHT,
        canvasWidth: TEMPLATE_PREVIEW_WIDTH,
        height: TEMPLATE_PREVIEW_HEIGHT,
        imagePlaceholder: TRANSPARENT_IMAGE_PLACEHOLDER,
        pixelRatio: 1,
        skipAutoScale: true,
        width: TEMPLATE_PREVIEW_WIDTH,
      })
    } catch {
      return undefined
    }
  } finally {
    root?.unmount()
    host.remove()
    release()
  }
}
