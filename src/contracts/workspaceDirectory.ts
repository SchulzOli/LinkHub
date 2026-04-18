import { z } from 'zod'

import { DEFAULT_WORKSPACE_ID, type Workspace } from './workspace'

export const WorkspaceSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})

export const WorkspaceDirectorySchema = z.object({
  activeWorkspaceId: z.string().min(1),
  interactionMode: z.enum(['edit', 'view']).default('edit'),
  workspaceRailPinned: z.boolean().default(false),
  workspaces: z.array(WorkspaceSummarySchema),
})

export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>
export type WorkspaceDirectory = z.infer<typeof WorkspaceDirectorySchema>

export function createWorkspaceSummary(
  workspace: Pick<Workspace, 'id' | 'name'>,
): WorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name.trim() || 'Workspace',
  }
}

export function createDefaultWorkspaceDirectory(
  workspace: Pick<Workspace, 'id' | 'name'> = {
    id: DEFAULT_WORKSPACE_ID,
    name: 'Home',
  },
): WorkspaceDirectory {
  return {
    activeWorkspaceId: workspace.id,
    interactionMode: 'edit',
    workspaceRailPinned: false,
    workspaces: [createWorkspaceSummary(workspace)],
  }
}
