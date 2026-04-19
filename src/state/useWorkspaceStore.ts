import { create } from 'zustand'

import { createWorkspaceAppearanceSlice } from './slices/createWorkspaceAppearanceSlice'
import { createWorkspaceDataSlice } from './slices/createWorkspaceDataSlice'
import { createWorkspaceManagementSlice } from './slices/createWorkspaceManagementSlice'
import { createWorkspaceSelectionSlice } from './slices/createWorkspaceSelectionSlice'
import { createWorkspaceUISlice } from './slices/createWorkspaceUISlice'
import type { InteractionMode, WorkspaceState } from './workspaceStoreTypes'

export const useWorkspaceStore = create<WorkspaceState>((set, get, api) => ({
  ...createWorkspaceUISlice(set, get, api),
  ...createWorkspaceManagementSlice(set, get, api),
  ...createWorkspaceSelectionSlice(set, get, api),
  ...createWorkspaceAppearanceSlice(set, get, api),
  ...createWorkspaceDataSlice(set, get, api),
}))

export type { InteractionMode }
