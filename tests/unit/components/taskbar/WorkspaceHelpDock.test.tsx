import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { WorkspaceHelpDock } from '../../../../src/components/taskbar/WorkspaceHelpDock'

describe('WorkspaceHelpDock', () => {
  it('opens the centered help dialog with shortcut tables and links', async () => {
    const user = userEvent.setup()

    render(<WorkspaceHelpDock interactionMode="edit" />)

    await user.click(screen.getByRole('button', { name: 'Open help panel' }))

    expect(
      screen.getByRole('dialog', { name: 'LinkHub help' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('workspace-help-dialog')).toBeInTheDocument()
    expect(screen.getByText('Edit mode')).toBeInTheDocument()
    expect(screen.getAllByText('Combination')).toHaveLength(2)
    expect(
      screen.getByText(
        'Paste a URL, text snippet, or copied selection onto the canvas',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Give feedback' })).toHaveAttribute(
      'href',
      'https://github.com/SchulzOli/LinkHub/issues',
    )
    expect(
      screen.getByRole('link', { name: 'View repository' }),
    ).toHaveAttribute('href', 'https://github.com/SchulzOli/LinkHub')
    expect(
      screen.getByRole('button', { name: 'Privacy policy' }),
    ).toBeInTheDocument()
  })

  it('opens the centered privacy dialog from the help dialog', async () => {
    const user = userEvent.setup()

    render(<WorkspaceHelpDock interactionMode="view" />)

    await user.click(screen.getByRole('button', { name: 'Open help panel' }))
    await user.click(screen.getByRole('button', { name: 'Privacy policy' }))

    expect(
      screen.getByRole('dialog', { name: 'Privacy policy' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('workspace-privacy-dialog')).toBeInTheDocument()
    expect(screen.getByText('What LinkHub stores')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Open standalone policy page' }),
    ).not.toBeInTheDocument()
  })
})
