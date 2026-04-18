import { useWorkspaceStore } from './useWorkspaceStore'

export function usePlacementStore() {
  const placementGuide = useWorkspaceStore(
    (state) => state.workspace.placementGuide,
  )
  const viewport = useWorkspaceStore((state) => state.workspace.viewport)
  const setPlacementGuide = useWorkspaceStore(
    (state) => state.setPlacementGuide,
  )
  const setViewport = useWorkspaceStore((state) => state.setViewport)

  return {
    placementGuide,
    viewport,
    setPlacementGuide,
    setViewport,
  }
}
