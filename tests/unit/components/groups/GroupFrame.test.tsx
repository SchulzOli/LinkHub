import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CanvasActionsProvider } from '../../../../src/components/canvas/CanvasActionsContext'
import { GroupFrameContainer as GroupFrame } from '../../../../src/components/groups/GroupFrameContainer'
import { defaultAppearanceProfile } from '../../../../src/contracts/appearanceProfile'
import type { CardGroup } from '../../../../src/contracts/cardGroup'
import type { PlacementGuide } from '../../../../src/contracts/placementGuide'
import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import { useWorkspaceStore } from '../../../../src/state/useWorkspaceStore'

const selectionActions = {
  autoEditTarget: null,
  onClearAutoEditTarget: () => undefined,
  onSelectCard: () => undefined,
  onSelectGroup: () => undefined,
  onSelectPicture: () => undefined,
}

const editActions = {
  onRecordLinkOpen: () => undefined,
  onRemoveCard: () => undefined,
  onRemoveGroup: () => undefined,
  onRemovePicture: () => undefined,
  onRequestCardImageOverridePicker: () => undefined,
  onRequestPictureImagePicker: () => undefined,
  onUpdateCard: () => undefined,
  onUpdateGroup: () => undefined,
  onUpdatePicture: () => undefined,
}

const placementActions = {
  onMoveCard: () => undefined,
  onMoveGroup: () => undefined,
  onMovePicture: () => undefined,
  onPreviewChange: () => undefined,
}

const guide: PlacementGuide = {
  columns: 48,
  gridSize: 24,
  rows: 32,
}

function createGroup(overrides: Partial<CardGroup> = {}): CardGroup {
  return {
    id: 'group-1',
    name: 'Projekt Alpha',
    positionX: 4,
    positionY: 6,
    size: {
      columns: 8,
      rows: 6,
    },
    createdAt: '2026-04-13T00:00:00.000Z',
    updatedAt: '2026-04-13T00:00:00.000Z',
    showTitle: false,
    ...overrides,
  }
}

describe('GroupFrame', () => {
  it('shows the actual group name in the header even when show title is disabled', () => {
    const workspace = createDefaultWorkspace()

    useWorkspaceStore.getState().hydrateWorkspace({
      ...workspace,
      appearance: defaultAppearanceProfile,
    })

    render(
      <CanvasActionsProvider
        selection={selectionActions}
        edit={editActions}
        placement={placementActions}
      >
        <GroupFrame
          group={createGroup()}
          groups={[createGroup()]}
          guide={guide}
          interactionMode="view"
          isSelected={false}
          pictures={[]}
          viewport={{ x: 0, y: 0, zoom: 1 }}
        />
      </CanvasActionsProvider>,
    )

    expect(screen.getByText('Projekt Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Group')).not.toBeInTheDocument()
  })
})
