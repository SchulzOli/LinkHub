import type { CardSize, LinkCard } from '../../contracts/linkCard'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'
import { createId } from '../../utils/id'
import { createFaviconUrl, normalizeUrl } from './urlValidation'

export function createLinkCard(input: {
  url: string
  position: { x: number; y: number }
  size: CardSize
  title?: string
  cornerRadius?: number
  showTitle?: boolean
  showImage?: boolean
  fillPresetIndex?: number
  borderPresetIndex?: number
  fillColor?: string
  borderColor?: string
  surfaceTransparency?: SurfaceTransparency
  shadowStyle?: SurfaceShadowStyle
}): LinkCard | null {
  const normalizedUrl = normalizeUrl(input.url)

  if (!normalizedUrl) {
    return null
  }

  const now = new Date().toISOString()

  return {
    id: createId(),
    url: normalizedUrl,
    title: input.title?.trim() ?? '',
    faviconUrl: createFaviconUrl(normalizedUrl),
    positionX: input.position.x,
    positionY: input.position.y,
    size: input.size,
    cornerRadius: input.cornerRadius,
    showTitle: input.showTitle,
    showImage: input.showImage,
    fillPresetIndex: input.fillPresetIndex,
    borderPresetIndex: input.borderPresetIndex,
    fillColor: input.fillColor,
    borderColor: input.borderColor,
    surfaceTransparency: input.surfaceTransparency,
    shadowStyle: input.shadowStyle,
    createdAt: now,
    updatedAt: now,
  }
}
