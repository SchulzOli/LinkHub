import type { AppearanceProfile } from '../../contracts/appearanceProfile'
import {
  getGroupChromeMetrics,
  getGroupLayoutSize,
} from '../../contracts/cardGroup'
import {
  sanitizeTemplateDescription,
  sanitizeTemplateName,
  type TemplateDocument,
} from '../../contracts/template'
import type { StoredImageAssetRecord } from '../../storage/imageRepository'
import { createId } from '../../utils/id'
import { resolveCardColors } from '../appearance/cardColorPalette'
import { mixHexColors, withAlpha } from '../appearance/colorMath'
import { getAppearanceStyleTokens } from '../appearance/stylePresets'
import { getCardPixelDimensions } from '../appearance/themeTokens'
import {
  duplicateCanvasEntityBundle,
  getCanvasEntityBundlePixelBounds,
  normalizeCanvasEntityBundle,
  type CanvasEntityBundle,
} from '../canvas/entityBundle'
import { reconcileStoredImageRecords } from '../images/storedImageRecords'
import {
  captureTemplatePreviewDataUrl,
  TEMPLATE_PREVIEW_GRID_SIZE,
  TEMPLATE_PREVIEW_HEIGHT,
  TEMPLATE_PREVIEW_PADDING,
  TEMPLATE_PREVIEW_WIDTH,
  type TemplatePreviewAppearance,
} from './templatePreviewCapture'

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const clampedRadius = Math.max(0, Math.min(radius, width / 2, height / 2))

  context.beginPath()
  context.moveTo(x + clampedRadius, y)
  context.arcTo(x + width, y, x + width, y + height, clampedRadius)
  context.arcTo(x + width, y + height, x, y + height, clampedRadius)
  context.arcTo(x, y + height, x, y, clampedRadius)
  context.arcTo(x, y, x + width, y, clampedRadius)
  context.closePath()
}

function clipRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  roundRect(context, x, y, width, height, radius)
  context.clip()
}

function truncatePreviewText(value: string, maxLength: number) {
  const normalized = value.trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

async function loadPreviewImage(blob: Blob): Promise<CanvasImageSource | null> {
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      return await window.createImageBitmap(blob)
    } catch {
      // Fall through to Image-based loading.
    }
  }

  if (typeof Image === 'undefined' || typeof URL === 'undefined') {
    return null
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(null)
    }

    image.src = objectUrl
  })
}

function releasePreviewImage(image: CanvasImageSource | null) {
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) {
    image.close()
  }
}

function getCanvasImageDimensions(image: CanvasImageSource) {
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) {
    return {
      width: image.width,
      height: image.height,
    }
  }

  if (
    typeof HTMLImageElement !== 'undefined' &&
    image instanceof HTMLImageElement
  ) {
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    }
  }

  return null
}

function drawImageCover(input: {
  context: CanvasRenderingContext2D
  image: CanvasImageSource
  x: number
  y: number
  width: number
  height: number
  radius: number
}) {
  const dimensions = getCanvasImageDimensions(input.image)

  if (!dimensions || dimensions.width === 0 || dimensions.height === 0) {
    return
  }

  const scale = Math.max(
    input.width / dimensions.width,
    input.height / dimensions.height,
  )
  const renderedWidth = dimensions.width * scale
  const renderedHeight = dimensions.height * scale
  const offsetX = input.x + (input.width - renderedWidth) / 2
  const offsetY = input.y + (input.height - renderedHeight) / 2

  input.context.save()
  clipRoundedRect(
    input.context,
    input.x,
    input.y,
    input.width,
    input.height,
    input.radius,
  )
  input.context.drawImage(
    input.image,
    offsetX,
    offsetY,
    renderedWidth,
    renderedHeight,
  )
  input.context.restore()
}

function drawTemplateBackground(
  context: CanvasRenderingContext2D,
  appearance: Pick<AppearanceProfile, 'stylePreset' | 'themeMode'>,
) {
  const tokens = getAppearanceStyleTokens(
    appearance.stylePreset,
    appearance.themeMode,
  )
  const gradient = context.createLinearGradient(
    0,
    0,
    TEMPLATE_PREVIEW_WIDTH,
    TEMPLATE_PREVIEW_HEIGHT,
  )

  gradient.addColorStop(0, tokens.bgShell)
  gradient.addColorStop(1, tokens.bgCanvas)
  context.fillStyle = gradient
  context.fillRect(0, 0, TEMPLATE_PREVIEW_WIDTH, TEMPLATE_PREVIEW_HEIGHT)

  context.save()
  context.strokeStyle = withAlpha(tokens.gridColor, 0.6)
  context.lineWidth = 1

  for (let x = 0; x <= TEMPLATE_PREVIEW_WIDTH; x += 18) {
    context.beginPath()
    context.moveTo(x + 0.5, 0)
    context.lineTo(x + 0.5, TEMPLATE_PREVIEW_HEIGHT)
    context.stroke()
  }

  for (let y = 0; y <= TEMPLATE_PREVIEW_HEIGHT; y += 18) {
    context.beginPath()
    context.moveTo(0, y + 0.5)
    context.lineTo(TEMPLATE_PREVIEW_WIDTH, y + 0.5)
    context.stroke()
  }

  context.restore()
}

function createPreviewTransform(bounds: {
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
  }
}

function drawTemplateGroup(input: {
  appearance: Pick<
    AppearanceProfile,
    | 'defaultCardCornerRadius'
    | 'stylePreset'
    | 'themeMode'
    | 'fillPresetsByTheme'
    | 'borderPresetsByTheme'
  >
  context: CanvasRenderingContext2D
  group: CanvasEntityBundle['groups'][number]
  transform: { scale: number; x: number; y: number }
}) {
  const tokens = getAppearanceStyleTokens(
    input.appearance.stylePreset,
    input.appearance.themeMode,
  )
  const groupColors = resolveCardColors(input.group, input.appearance, {
    fillColor: tokens.cardBg,
    borderColor: tokens.cardBorder,
  })
  const size = getCardPixelDimensions(
    getGroupLayoutSize(input.group),
    TEMPLATE_PREVIEW_GRID_SIZE,
  )
  const chrome = getGroupChromeMetrics(
    getGroupLayoutSize(input.group),
    TEMPLATE_PREVIEW_GRID_SIZE,
  )
  const x = input.transform.x + input.group.positionX * input.transform.scale
  const y = input.transform.y + input.group.positionY * input.transform.scale
  const width = size.width * input.transform.scale
  const height = size.height * input.transform.scale
  const radius = Math.max(
    8,
    (Math.min(width, height) *
      (input.group.cornerRadius ?? input.appearance.defaultCardCornerRadius)) /
      100,
  )
  const headerHeight = chrome.headerHeight * input.transform.scale

  input.context.save()
  input.context.shadowColor = withAlpha(groupColors.borderColor, 0.22)
  input.context.shadowBlur = 12
  input.context.shadowOffsetY = 8
  roundRect(input.context, x, y, width, height, radius)
  input.context.fillStyle = withAlpha(groupColors.fillColor, 0.18)
  input.context.fill()
  input.context.shadowColor = 'transparent'
  input.context.lineWidth = Math.max(1.2, input.transform.scale * 1.4)
  input.context.strokeStyle = withAlpha(groupColors.borderColor, 0.9)
  input.context.stroke()
  input.context.restore()

  input.context.save()
  clipRoundedRect(input.context, x, y, width, height, radius)
  input.context.fillStyle = mixHexColors(
    groupColors.fillColor,
    tokens.accent,
    0.18,
  )
  input.context.fillRect(x, y, width, Math.min(height, headerHeight + 4))
  input.context.restore()

  if ((input.group.showTitle ?? true) && width >= 64 && height >= 24) {
    input.context.save()
    input.context.fillStyle = tokens.textPrimary
    input.context.font = `700 ${Math.max(10, Math.min(13, headerHeight * 0.5))}px ${tokens.uiFont}`
    input.context.textBaseline = 'middle'
    input.context.fillText(
      truncatePreviewText(
        input.group.name,
        Math.max(6, Math.floor(width / 11)),
      ),
      x + 10,
      y + Math.min(height - 8, headerHeight / 2 + 1),
      Math.max(0, width - 20),
    )
    input.context.restore()
  }
}

function drawTemplateCard(input: {
  appearance: Pick<
    AppearanceProfile,
    | 'defaultCardCornerRadius'
    | 'defaultCardShowImage'
    | 'defaultCardShowTitle'
    | 'stylePreset'
    | 'themeMode'
    | 'fillPresetsByTheme'
    | 'borderPresetsByTheme'
  >
  context: CanvasRenderingContext2D
  card: CanvasEntityBundle['cards'][number]
  imageById: Map<string, CanvasImageSource>
  transform: { scale: number; x: number; y: number }
}) {
  const tokens = getAppearanceStyleTokens(
    input.appearance.stylePreset,
    input.appearance.themeMode,
  )
  const colors = resolveCardColors(input.card, input.appearance, {
    fillColor: tokens.cardBg,
    borderColor: tokens.cardBorder,
  })
  const size = getCardPixelDimensions(
    input.card.size,
    TEMPLATE_PREVIEW_GRID_SIZE,
  )
  const x = input.transform.x + input.card.positionX * input.transform.scale
  const y = input.transform.y + input.card.positionY * input.transform.scale
  const width = size.width * input.transform.scale
  const height = size.height * input.transform.scale
  const radius = Math.max(
    7,
    (Math.min(width, height) *
      (input.card.cornerRadius ?? input.appearance.defaultCardCornerRadius)) /
      100,
  )
  const showImage =
    input.card.showImage ?? input.appearance.defaultCardShowImage
  const showTitle =
    input.card.showTitle ?? input.appearance.defaultCardShowTitle
  const previewImage = input.card.faviconOverrideImageId
    ? (input.imageById.get(input.card.faviconOverrideImageId) ?? null)
    : null

  input.context.save()
  input.context.shadowColor = withAlpha(colors.borderColor, 0.16)
  input.context.shadowBlur = 10
  input.context.shadowOffsetY = 6
  roundRect(input.context, x, y, width, height, radius)
  input.context.fillStyle = colors.fillColor
  input.context.fill()
  input.context.shadowColor = 'transparent'
  input.context.lineWidth = Math.max(1.2, input.transform.scale * 1.25)
  input.context.strokeStyle = colors.borderColor
  input.context.stroke()
  input.context.restore()

  if (showImage) {
    const imageSize = Math.max(
      16,
      Math.min(width * 0.54, height * (showTitle ? 0.42 : 0.58)),
    )
    const imageX = x + (width - imageSize) / 2
    const imageY = y + Math.max(10, height * 0.12)

    if (previewImage) {
      drawImageCover({
        context: input.context,
        image: previewImage,
        x: imageX,
        y: imageY,
        width: imageSize,
        height: imageSize,
        radius: imageSize / 2,
      })
    } else {
      input.context.save()
      roundRect(
        input.context,
        imageX,
        imageY,
        imageSize,
        imageSize,
        imageSize / 2,
      )
      input.context.fillStyle = withAlpha(tokens.textPrimary, 0.12)
      input.context.fill()
      input.context.lineWidth = 1
      input.context.strokeStyle = withAlpha(tokens.textPrimary, 0.2)
      input.context.stroke()
      input.context.restore()
    }
  }

  if (showTitle && width >= 48) {
    input.context.save()
    input.context.fillStyle = tokens.textPrimary
    input.context.font = `600 ${Math.max(10, Math.min(16, width * 0.12))}px ${tokens.uiFont}`
    input.context.textAlign = 'center'
    input.context.textBaseline = 'alphabetic'
    input.context.fillText(
      truncatePreviewText(
        input.card.title,
        Math.max(5, Math.floor(width / 10)),
      ),
      x + width / 2,
      y + height - 10,
      Math.max(0, width - 16),
    )
    input.context.restore()
  }
}

function drawTemplatePicture(input: {
  appearance: Pick<AppearanceProfile, 'stylePreset' | 'themeMode'>
  context: CanvasRenderingContext2D
  imageById: Map<string, CanvasImageSource>
  picture: CanvasEntityBundle['pictures'][number]
  transform: { scale: number; x: number; y: number }
}) {
  const tokens = getAppearanceStyleTokens(
    input.appearance.stylePreset,
    input.appearance.themeMode,
  )
  const size = getCardPixelDimensions(
    input.picture.size,
    TEMPLATE_PREVIEW_GRID_SIZE,
  )
  const x = input.transform.x + input.picture.positionX * input.transform.scale
  const y = input.transform.y + input.picture.positionY * input.transform.scale
  const width = size.width * input.transform.scale
  const height = size.height * input.transform.scale
  const radius = Math.max(8, Math.min(width, height) * 0.08)
  const image = input.imageById.get(input.picture.imageId) ?? null

  input.context.save()
  roundRect(input.context, x, y, width, height, radius)
  input.context.fillStyle = withAlpha(tokens.inputBg, 0.88)
  input.context.fill()
  input.context.restore()

  if (image) {
    drawImageCover({
      context: input.context,
      image,
      x,
      y,
      width,
      height,
      radius,
    })
  } else {
    input.context.save()
    input.context.fillStyle = withAlpha(tokens.textMuted, 0.2)
    roundRect(
      input.context,
      x + 8,
      y + 8,
      width - 16,
      height - 16,
      Math.max(4, radius - 4),
    )
    input.context.fill()
    input.context.restore()
  }

  input.context.save()
  roundRect(input.context, x, y, width, height, radius)
  input.context.lineWidth = Math.max(1.2, input.transform.scale * 1.2)
  input.context.strokeStyle = withAlpha(tokens.panelBorder, 0.9)
  input.context.stroke()
  input.context.restore()
}

export async function createTemplatePreviewDataUrl(input: {
  appearance: TemplatePreviewAppearance
  bundle: CanvasEntityBundle
  imageRecords: StoredImageAssetRecord[]
}) {
  if (typeof document === 'undefined') {
    return undefined
  }

  const domPreviewDataUrl = await captureTemplatePreviewDataUrl({
    appearance: input.appearance,
    bundle: input.bundle,
    imageRecords: input.imageRecords,
  })

  if (domPreviewDataUrl) {
    return domPreviewDataUrl
  }

  const canvas = document.createElement('canvas')

  canvas.width = TEMPLATE_PREVIEW_WIDTH
  canvas.height = TEMPLATE_PREVIEW_HEIGHT

  const context = canvas.getContext('2d')

  if (!context) {
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

  const transform = createPreviewTransform(bounds)
  const loadedImages = await Promise.all(
    input.imageRecords.map(async (record) => ({
      image: await loadPreviewImage(record.blob),
      imageId: record.asset.id,
    })),
  )
  const imageById = new Map<string, CanvasImageSource>()

  loadedImages.forEach((entry) => {
    if (entry.image) {
      imageById.set(entry.imageId, entry.image)
    }
  })

  try {
    drawTemplateBackground(context, input.appearance)

    normalizedBundle.groups
      .slice()
      .sort(
        (left, right) =>
          getGroupLayoutSize(right).columns * getGroupLayoutSize(right).rows -
          getGroupLayoutSize(left).columns * getGroupLayoutSize(left).rows,
      )
      .forEach((group) => {
        drawTemplateGroup({
          appearance: input.appearance,
          context,
          group,
          transform,
        })
      })

    normalizedBundle.pictures.forEach((picture) => {
      drawTemplatePicture({
        appearance: input.appearance,
        context,
        imageById,
        picture,
        transform,
      })
    })

    normalizedBundle.cards.forEach((card) => {
      drawTemplateCard({
        appearance: input.appearance,
        card,
        context,
        imageById,
        transform,
      })
    })

    return canvas.toDataURL('image/png')
  } finally {
    loadedImages.forEach((entry) => releasePreviewImage(entry.image))
  }
}

export function collectBundleImageIds(bundle: CanvasEntityBundle) {
  return [
    ...new Set([
      ...bundle.cards.flatMap((card) =>
        card.faviconOverrideImageId ? [card.faviconOverrideImageId] : [],
      ),
      ...bundle.pictures.map((picture) => picture.imageId),
    ]),
  ]
}

export function createTemplateDocument(input: {
  bundle: CanvasEntityBundle
  description: string
  imageRecords: StoredImageAssetRecord[]
  name: string
  previewDataUrl?: string
  templateId?: string
  timestamps?: {
    createdAt: string
    updatedAt: string
  }
}) {
  const normalizedBundle = normalizeCanvasEntityBundle(input.bundle).bundle
  const name = sanitizeTemplateName(input.name)

  if (!name) {
    throw new Error('Template name is required.')
  }

  const timestamps = input.timestamps ?? {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  return {
    format: 'linkhub.template',
    version: 1,
    id: input.templateId ?? createId(),
    name,
    description: sanitizeTemplateDescription(input.description),
    previewDataUrl: input.previewDataUrl,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    content: {
      cards: normalizedBundle.cards,
      groups: normalizedBundle.groups,
      pictures: normalizedBundle.pictures,
      images: input.imageRecords.map((record) => ({
        asset: record.asset,
        sourceImageId: record.asset.id,
      })),
    },
  } satisfies TemplateDocument
}

export async function materializeTemplateDocument(input: {
  imageRecords: StoredImageAssetRecord[]
  resolveExistingImage: (
    imageId: string,
  ) => Promise<StoredImageAssetRecord | null>
  template: TemplateDocument
}) {
  const { imageIdMap, recordsToStore } = await reconcileStoredImageRecords({
    records: input.imageRecords,
    resolveExistingImage: input.resolveExistingImage,
  })

  return {
    bundle: duplicateCanvasEntityBundle({
      bundle: {
        cards: input.template.content.cards,
        groups: input.template.content.groups,
        pictures: input.template.content.pictures,
      },
      imageIdMap,
    }),
    imagesToStore: recordsToStore,
  }
}

export function duplicateTemplateDocument(input: {
  template: TemplateDocument
}) {
  const now = new Date().toISOString()
  const copyLabel = input.template.name.toLowerCase().endsWith(' copy')
    ? input.template.name
    : `${input.template.name} copy`

  return {
    ...input.template,
    id: createId(),
    name: copyLabel,
    createdAt: now,
    updatedAt: now,
  } satisfies TemplateDocument
}
