import type {
  AppearanceProfile,
  StylePreset,
  ThemeMode,
} from '../contracts/appearanceProfile'
import type { CardGroup } from '../contracts/cardGroup'
import type { CardSize, LinkCard } from '../contracts/linkCard'
import type { PictureNode } from '../contracts/pictureNode'
import type { PlacementGuide } from '../contracts/placementGuide'
import type {
  SurfaceShadowStyle,
  SurfaceTransparency,
} from '../contracts/surfaceEffects'
import type { ThemeContent } from '../contracts/theme'
import type { Viewport, Workspace } from '../contracts/workspace'
import type { WorkspaceSummary } from '../contracts/workspaceDirectory'
import type { FormatPainterPayload } from '../features/appearance/formatPainter'
import type { AppearanceStyleTokens } from '../features/appearance/stylePresets'

export type StoreStatus = 'loading' | 'ready' | 'error'
export type InteractionMode = 'edit' | 'view'
export type AutoEditTarget = {
  kind: 'card' | 'group'
  id: string
} | null

export type WorkspaceUndoSnapshot = Omit<
  Workspace,
  'analytics' | 'viewport' | 'updatedAt'
>

export type GroupUpdateFields = Partial<
  Pick<
    CardGroup,
    | 'name'
    | 'size'
    | 'cornerRadius'
    | 'showTitle'
    | 'positionX'
    | 'positionY'
    | 'fillPresetIndex'
    | 'borderPresetIndex'
    | 'fillColor'
    | 'borderColor'
    | 'surfaceTransparency'
    | 'shadowStyle'
  >
>

export type CardUpdateFields = Partial<
  Pick<
    LinkCard,
    | 'title'
    | 'url'
    | 'faviconUrl'
    | 'faviconOverrideImageId'
    | 'size'
    | 'cornerRadius'
    | 'showTitle'
    | 'showImage'
    | 'positionX'
    | 'positionY'
    | 'fillPresetIndex'
    | 'borderPresetIndex'
    | 'fillColor'
    | 'borderColor'
    | 'surfaceTransparency'
    | 'shadowStyle'
  >
>

export type PictureUpdateFields = Partial<
  Pick<PictureNode, 'imageId' | 'positionX' | 'positionY' | 'size'>
>

export type CardBatchUpdate = {
  cardId: string
  updates: CardUpdateFields
}

export type PictureBatchUpdate = {
  pictureId: string
  updates: PictureUpdateFields
}

export type SelectionInput = {
  cardIds: string[]
  groupIds: string[]
  pictureIds: string[]
}

export type AddEntityBundleInput = {
  cards: LinkCard[]
  groups: CardGroup[]
  pictures: PictureNode[]
  selectedCardIds?: string[]
  selectedGroupIds?: string[]
  selectedPictureIds?: string[]
}

export type AddGroupsAndCardsInput = {
  cards: LinkCard[]
  groups: CardGroup[]
  selectedCardIds?: string[]
  selectedGroupIds?: string[]
}

export type WorkspaceUIState = {
  status: StoreStatus
  interactionMode: InteractionMode
  quickAddOpen: boolean
  optionsMenuOpen: boolean
  autoEditTarget: AutoEditTarget
  formatPainter: FormatPainterPayload | null
  setStatus: (status: StoreStatus) => void
  hydrateWorkspace: (workspace: Workspace) => void
  undoWorkspace: () => void
  toggleInteractionMode: (value?: InteractionMode) => void
  toggleQuickAdd: (value?: boolean) => void
  toggleOptionsMenu: (value?: boolean) => void
  setAutoEditTarget: (target: AutoEditTarget) => void
  clearAutoEditTarget: () => void
  startFormatPainter: (payload: FormatPainterPayload) => void
  clearFormatPainter: () => void
}

export type WorkspaceSelectionState = {
  selectedCardIds: string[]
  selectedGroupIds: string[]
  selectedPictureIds: string[]
  setSelectedCardIds: (cardIds: string[]) => void
  setSelectedGroupIds: (groupIds: string[]) => void
  setSelectedPictureIds: (pictureIds: string[]) => void
  setSelection: (selection: SelectionInput) => void
  selectCardExclusive: (cardId: string) => void
  selectGroupExclusive: (groupId: string) => void
  selectPictureExclusive: (pictureId: string) => void
  toggleCardSelection: (cardId: string) => void
  toggleGroupSelection: (groupId: string) => void
  togglePictureSelection: (pictureId: string) => void
  clearSelectedCards: () => void
  clearSelectedGroups: () => void
  clearSelectedPictures: () => void
  clearSelection: () => void
}

export type WorkspaceAppearanceState = {
  viewport: Viewport
  setViewport: (viewport: Viewport) => void
  setThemeMode: (themeMode: ThemeMode) => void
  setDefaultCardSize: (defaultCardSize: CardSize) => void
  setDefaultCardCornerRadius: (defaultCardCornerRadius: number) => void
  setDefaultCardShowTitle: (defaultCardShowTitle: boolean) => void
  setDefaultCardShowImage: (defaultCardShowImage: boolean) => void
  setDefaultCardOpenInNewTab: (defaultCardOpenInNewTab: boolean) => void
  setDefaultSurfaceTransparency: (
    defaultSurfaceTransparency: SurfaceTransparency,
  ) => void
  setDefaultSurfaceShadowStyle: (
    defaultSurfaceShadowStyle: SurfaceShadowStyle,
  ) => void
  setFillPresets: (fillPresets: string[]) => void
  setBorderPresets: (borderPresets: string[]) => void
  setDefaultFillPresetIndex: (defaultFillPresetIndex: number) => void
  setDefaultBorderPresetIndex: (defaultBorderPresetIndex: number) => void
  resetAppearanceOptions: () => void
  setStylePreset: (stylePreset: StylePreset) => void
  setPlacementGuide: (placementGuide: PlacementGuide) => void
  setAppearance: (appearance: AppearanceProfile) => void
  applyTheme: (themeId: string, content: ThemeContent) => void
  setStyleToken: (
    mode: ThemeMode,
    tokenKey: keyof AppearanceStyleTokens,
    value: string,
  ) => void
  resetStyleTokens: () => void
}

export type WorkspaceDataState = {
  undoStack: WorkspaceUndoSnapshot[]
  workspace: Workspace
  addGroup: (group: CardGroup) => void
  addEntityBundle: (input: AddEntityBundleInput) => void
  addGroupsAndCards: (input: AddGroupsAndCardsInput) => void
  updateGroup: (groupId: string, updates: GroupUpdateFields) => void
  removeGroup: (groupId: string) => void
  removeGroups: (groupIds: string[]) => void
  removeSelection: (input: SelectionInput) => void
  moveGroup: (
    groupId: string,
    position: { x: number; y: number },
    pictureIds?: string[],
  ) => void
  toggleGroupCollapsed: (groupId: string) => void
  addCard: (card: LinkCard) => void
  addCards: (cards: LinkCard[]) => void
  addPicture: (picture: PictureNode) => void
  updateCard: (cardId: string, updates: CardUpdateFields) => void
  updateCards: (updates: CardBatchUpdate[]) => void
  updatePicture: (pictureId: string, updates: PictureUpdateFields) => void
  updatePictures: (updates: PictureBatchUpdate[]) => void
  removeCard: (cardId: string) => void
  removeCards: (cardIds: string[]) => void
  removePicture: (pictureId: string) => void
  removePictures: (pictureIds: string[]) => void
  moveCard: (cardId: string, position: { x: number; y: number }) => void
  movePicture: (pictureId: string, position: { x: number; y: number }) => void
  recordCanvasOpen: (source: 'initial' | 'resume') => void
  recordLinkOpen: (cardId: string) => void
}

export type WorkspaceManagementState = {
  activeWorkspaceId: string
  workspaceRailOpen: boolean
  workspaceRailPinned: boolean
  workspaceSummaries: WorkspaceSummary[]
  initializeWorkspaceSession: (input: {
    activeWorkspaceId: string
    interactionMode: InteractionMode
    workspace: Workspace
    workspaceRailPinned: boolean
    workspaceSummaries: WorkspaceSummary[]
  }) => void
  createWorkspace: () => Promise<void>
  deleteWorkspace: (workspaceId: string) => Promise<void>
  importWorkspace: (workspace: Workspace) => Promise<void>
  moveWorkspace: (workspaceId: string, direction: -1 | 1) => Promise<void>
  renameWorkspace: (workspaceId: string, name: string) => Promise<void>
  switchWorkspace: (workspaceId: string) => Promise<void>
  toggleWorkspaceRail: (value?: boolean) => void
  toggleWorkspaceRailPinned: (value?: boolean) => void
}

export type WorkspaceState = WorkspaceUIState &
  WorkspaceManagementState &
  WorkspaceSelectionState &
  WorkspaceAppearanceState &
  WorkspaceDataState
