import type { CardGroup } from '../../contracts/cardGroup'
import type { CardSize } from '../../contracts/linkCard'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../../contracts/surfaceEffects'
import { createId } from '../../utils/id'

export function createCardGroup(input: {
  name?: string
  position: { x: number; y: number }
  size: CardSize
  parentGroupId?: string
  collapsed?: boolean
  cornerRadius?: number
  showTitle?: boolean
  fillPresetIndex?: number
  borderPresetIndex?: number
  fillColor?: string
  borderColor?: string
  surfaceTransparency?: SurfaceTransparency
  shadowStyle?: SurfaceShadowStyle
}): CardGroup {
  const now = new Date().toISOString()

  return {
    id: createId(),
    name: input.name?.trim() || 'Group',
    positionX: input.position.x,
    positionY: input.position.y,
    size: input.size,
    parentGroupId: input.parentGroupId,
    collapsed: input.collapsed ? true : undefined,
    cornerRadius: input.cornerRadius,
    showTitle: input.showTitle,
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
