import type { CardSize } from '../../contracts/linkCard'
import type { PlacementGuide } from '../../contracts/placementGuide'

export type PlaceableItem = {
  id: string
  positionX: number
  positionY: number
  size: CardSize
  collapsed?: boolean
  kind?: 'card' | 'group'
  parentGroupId?: string
}

export type PlacementBlockPredicate = (
  candidate: { position: { x: number; y: number }; size: CardSize },
  occupiedItem: PlaceableItem,
  guide: PlacementGuide,
) => boolean

export type DragPreview = {
  cardId: string
  size: CardSize
  position: { x: number; y: number }
}
