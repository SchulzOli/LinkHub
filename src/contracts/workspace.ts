import { z } from 'zod'

import {
  AppearanceProfileSchema,
  defaultAppearanceProfile,
  type AppearanceProfile,
} from './appearanceProfile'
import { CardGroupSchema, type CardGroup } from './cardGroup'
import { LinkCardSchema, type LinkCard } from './linkCard'
import { PictureNodeSchema, type PictureNode } from './pictureNode'
import {
  defaultPlacementGuide,
  PlacementGuideSchema,
  type PlacementGuide,
} from './placementGuide'
import {
  createDefaultWorkspaceAnalytics,
  WorkspaceAnalyticsSchema,
  type WorkspaceAnalytics,
} from './workspaceAnalytics'

export const DEFAULT_WORKSPACE_ID = 'default'

/**
 * Current Workspace-Record-Schema-Version. Wird bei jedem erfolgreichen
 * Migrations-Durchlauf in den Record eingetragen, damit spätere Reads den
 * Coercer überspringen können. Bei jedem Breaking-Change an Unter-Contracts
 * (Cards, Groups, Pictures, Appearance, Analytics) um 1 erhöhen.
 */
export const LATEST_WORKSPACE_SCHEMA_VERSION = 1

export const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
})

export const WorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  schemaVersion: z.number().int().nonnegative().optional(),
  appearance: AppearanceProfileSchema,
  analytics: WorkspaceAnalyticsSchema,
  placementGuide: PlacementGuideSchema,
  viewport: ViewportSchema,
  groups: z.array(CardGroupSchema),
  cards: z.array(LinkCardSchema),
  pictures: z.array(PictureNodeSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Viewport = z.infer<typeof ViewportSchema>
export type Workspace = z.infer<typeof WorkspaceSchema>

export function createDefaultWorkspace(
  overrides?: Partial<Workspace>,
): Workspace {
  const now = new Date().toISOString()

  return {
    id: DEFAULT_WORKSPACE_ID,
    name: 'Home',
    schemaVersion: LATEST_WORKSPACE_SCHEMA_VERSION,
    appearance: defaultAppearanceProfile,
    analytics: createDefaultWorkspaceAnalytics(),
    placementGuide: defaultPlacementGuide,
    viewport: { x: 0, y: 0, zoom: 1 },
    groups: [],
    cards: [],
    pictures: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function updateWorkspaceTimestamp(workspace: Workspace): Workspace {
  return { ...workspace, updatedAt: new Date().toISOString() }
}

export function replaceCards(
  workspace: Workspace,
  cards: LinkCard[],
): Workspace {
  return updateWorkspaceTimestamp({ ...workspace, cards })
}

export function replaceGroups(
  workspace: Workspace,
  groups: CardGroup[],
): Workspace {
  return updateWorkspaceTimestamp({ ...workspace, groups })
}

export function replacePictures(
  workspace: Workspace,
  pictures: PictureNode[],
): Workspace {
  return updateWorkspaceTimestamp({ ...workspace, pictures })
}

export function replaceAppearance(
  workspace: Workspace,
  appearance: AppearanceProfile,
): Workspace {
  return updateWorkspaceTimestamp({ ...workspace, appearance })
}

export function replaceAnalytics(
  workspace: Workspace,
  analytics: WorkspaceAnalytics,
): Workspace {
  return updateWorkspaceTimestamp({ ...workspace, analytics })
}

export function replacePlacementGuide(
  workspace: Workspace,
  placementGuide: PlacementGuide,
): Workspace {
  return updateWorkspaceTimestamp({ ...workspace, placementGuide })
}

export function replaceViewport(
  workspace: Workspace,
  viewport: Viewport,
): Workspace {
  return updateWorkspaceTimestamp({ ...workspace, viewport })
}
