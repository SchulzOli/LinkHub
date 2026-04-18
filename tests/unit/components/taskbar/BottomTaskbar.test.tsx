import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BottomTaskbar } from '../../../../src/components/taskbar/BottomTaskbar'
import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import { createWorkspaceSummary } from '../../../../src/contracts/workspaceDirectory'
import { useWorkspaceStore } from '../../../../src/state/useWorkspaceStore'

describe('BottomTaskbar', () => {
  it('renders quick add, mode toggle, and the options menu', async () => {
    const workspace = createDefaultWorkspace()

    useWorkspaceStore.getState().hydrateWorkspace(workspace)
    userEvent.setup()

    render(
      <BottomTaskbar
        activeWorkspaceId={workspace.id}
        cardCount={0}
        interactionMode="edit"
        optionsMenuOpen={true}
        quickAddOpen={false}
        onCreateGroup={() => undefined}
        onCreateWorkspace={() => undefined}
        onCloseOptionsMenu={() => undefined}
        onOpenImageGallery={() => undefined}
        onSelectWorkspace={() => undefined}
        onToggleInteractionMode={() => undefined}
        onToggleQuickAdd={() => undefined}
        onToggleOptionsMenu={() => undefined}
        onToggleWorkspaceRail={() => undefined}
        onToggleWorkspaceRailPinned={() => undefined}
        onSubmitQuickAdd={() => undefined}
        onUploadImage={() => undefined}
        workspaceRailOpen={false}
        workspaceRailPinned={false}
        workspaceSummaries={[createWorkspaceSummary(workspace)]}
      />,
    )

    expect(screen.getByTestId('bottom-taskbar')).toBeInTheDocument()
    expect(screen.getByTestId('workspace-rail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add link' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Toggle interaction mode' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Open menu' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Options' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Themes' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Templates' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Statistics' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Data' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Style')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Color mode')).toBeInTheDocument()
    expect(screen.getByLabelText('Default width')).toBeInTheDocument()
    expect(screen.getByLabelText('Default height')).toBeInTheDocument()
    expect(screen.queryByText('Top 20 cards')).not.toBeInTheDocument()
    expect(screen.queryByText('Timeline')).not.toBeInTheDocument()
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('workspace-rail-pin')).toHaveAttribute(
      'data-state',
      'auto-hide',
    )
    expect(screen.getByTestId('workspace-rail-pin')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('auto-hides the workspace rail on outside pointer down when unpinned', () => {
    const workspace = createDefaultWorkspace()
    const onToggleWorkspaceRail = vi.fn()

    render(
      <BottomTaskbar
        activeWorkspaceId={workspace.id}
        cardCount={0}
        interactionMode="edit"
        optionsMenuOpen={false}
        quickAddOpen={false}
        onCreateGroup={() => undefined}
        onCreateWorkspace={() => undefined}
        onCloseOptionsMenu={() => undefined}
        onOpenImageGallery={() => undefined}
        onSelectWorkspace={() => undefined}
        onToggleInteractionMode={() => undefined}
        onToggleQuickAdd={() => undefined}
        onToggleOptionsMenu={() => undefined}
        onToggleWorkspaceRail={onToggleWorkspaceRail}
        onToggleWorkspaceRailPinned={() => undefined}
        onSubmitQuickAdd={() => undefined}
        onUploadImage={() => undefined}
        workspaceRailOpen={true}
        workspaceRailPinned={false}
        workspaceSummaries={[createWorkspaceSummary(workspace)]}
      />,
    )

    fireEvent.pointerDown(document.body)

    expect(onToggleWorkspaceRail).toHaveBeenCalledWith(false)
  })

  it('keeps the workspace rail open on outside pointer down when pinned', () => {
    const workspace = createDefaultWorkspace()
    const onToggleWorkspaceRail = vi.fn()

    render(
      <BottomTaskbar
        activeWorkspaceId={workspace.id}
        cardCount={0}
        interactionMode="edit"
        optionsMenuOpen={false}
        quickAddOpen={false}
        onCreateGroup={() => undefined}
        onCreateWorkspace={() => undefined}
        onCloseOptionsMenu={() => undefined}
        onOpenImageGallery={() => undefined}
        onSelectWorkspace={() => undefined}
        onToggleInteractionMode={() => undefined}
        onToggleQuickAdd={() => undefined}
        onToggleOptionsMenu={() => undefined}
        onToggleWorkspaceRail={onToggleWorkspaceRail}
        onToggleWorkspaceRailPinned={() => undefined}
        onSubmitQuickAdd={() => undefined}
        onUploadImage={() => undefined}
        workspaceRailOpen={true}
        workspaceRailPinned={true}
        workspaceSummaries={[createWorkspaceSummary(workspace)]}
      />,
    )

    fireEvent.pointerDown(document.body)

    expect(onToggleWorkspaceRail).not.toHaveBeenCalled()
    expect(screen.getByTestId('workspace-rail-pin')).toHaveAttribute(
      'data-state',
      'pinned',
    )
  })

  it('hides secondary create actions while quick add is open', () => {
    const workspace = createDefaultWorkspace()

    render(
      <BottomTaskbar
        activeWorkspaceId={workspace.id}
        cardCount={0}
        interactionMode="edit"
        optionsMenuOpen={false}
        quickAddOpen={true}
        onCreateGroup={() => undefined}
        onCreateWorkspace={() => undefined}
        onCloseOptionsMenu={() => undefined}
        onOpenImageGallery={() => undefined}
        onSelectWorkspace={() => undefined}
        onToggleInteractionMode={() => undefined}
        onToggleQuickAdd={() => undefined}
        onToggleOptionsMenu={() => undefined}
        onToggleWorkspaceRail={() => undefined}
        onToggleWorkspaceRailPinned={() => undefined}
        onSubmitQuickAdd={() => undefined}
        onUploadImage={() => undefined}
        workspaceRailOpen={false}
        workspaceRailPinned={false}
        workspaceSummaries={[createWorkspaceSummary(workspace)]}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Close quick add' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Link URL')).toBeInTheDocument()
    expect(screen.getByLabelText('Link title')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add group' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Upload image' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Open image gallery' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Toggle interaction mode' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Open menu' }),
    ).toBeInTheDocument()
  })
})
