import { useShallow } from 'zustand/react/shallow'

import { useWorkspaceStore } from './useWorkspaceStore'

export function usePlacementStore() {
  return useWorkspaceStore(
    useShallow((state) => ({
      placementGuide: state.workspace.placementGuide,
      viewport: state.viewport,
      setPlacementGuide: state.setPlacementGuide,
      setViewport: state.setViewport,
    })),
  )
}
