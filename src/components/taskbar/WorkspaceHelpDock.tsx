import { useState } from 'react'

import type { InteractionMode } from '../../state/useWorkspaceStore'
import { DialogFrame } from '../ui/DialogFrame'
import styles from './WorkspaceHelpDock.module.css'

type WorkspaceHelpDockProps = {
  interactionMode: InteractionMode
}

type ActivePanel = 'help' | 'privacy' | null

type ShortcutRow = {
  action: string
  combo: readonly string[]
}

type PrivacySection = {
  bullets?: readonly string[]
  paragraphs: readonly string[]
  title: string
}

const REPOSITORY_URL = 'https://github.com/SchulzOli/LinkHub'
const FEEDBACK_URL = 'https://github.com/SchulzOli/LinkHub/issues'

const keyboardShortcuts: readonly ShortcutRow[] = [
  {
    action: 'Paste a URL, text snippet, or copied selection onto the canvas',
    combo: ['Ctrl / Cmd', 'V'],
  },
  {
    action: 'Copy the current selection',
    combo: ['Ctrl / Cmd', 'C'],
  },
  {
    action: 'Copy the format of one selected card or group for repeated apply',
    combo: ['Ctrl / Cmd', 'Shift', 'C'],
  },
  {
    action: 'Cut the current selection',
    combo: ['Ctrl / Cmd', 'X'],
  },
  {
    action: 'Undo the last workspace change',
    combo: ['Ctrl / Cmd', 'Z'],
  },
  {
    action: 'Delete the current selection',
    combo: ['Delete'],
  },
  {
    action: 'Nudge selected cards, groups, or pictures on the grid',
    combo: ['Arrow keys'],
  },
  {
    action: 'Add or remove an item from the current selection',
    combo: ['Ctrl / Cmd', 'Click'],
  },
] as const

const canvasGestures: readonly ShortcutRow[] = [
  {
    action: 'Pan the canvas',
    combo: ['Right click', 'Drag'],
  },
  {
    action: 'Zoom the canvas',
    combo: ['Wheel'],
  },
  {
    action: 'Pan horizontally',
    combo: ['Alt', 'Wheel'],
  },
  {
    action: 'Create a marquee selection in edit mode',
    combo: ['Drag on empty canvas'],
  },
] as const

const privacySections: readonly PrivacySection[] = [
  {
    paragraphs: [
      'LinkHub is a local-first application. It stores your workspace data in your browser on the current device so workspaces, themes, templates, images, imported bundles, and local usage insights remain available between sessions.',
    ],
    title: 'What LinkHub stores',
  },
  {
    bullets: [
      'Workspaces and workspace names',
      'Link cards, groups, picture nodes, layout positions, and board settings',
      'Uploaded images and gallery items',
      'Themes, templates, and appearance preferences',
      'Local usage statistics such as canvas opens and link opens',
      'Import and export metadata required to restore your data correctly',
    ],
    paragraphs: [
      'Depending on the features you use, LinkHub may store the following content locally in browser-managed storage such as IndexedDB and local storage:',
    ],
    title: 'Data categories',
  },
  {
    bullets: [
      'No account or sign-in is required',
      'No workspace content is uploaded to LinkHub servers',
      'No third-party advertising is included',
      'No behavioral tracking or third-party analytics are used; local usage stats stay on device',
      'No workspace data is sold or shared with outside parties',
    ],
    paragraphs: [
      'LinkHub does not perform cloud sync or remote backup by itself. Imports and exports only happen when you explicitly trigger them.',
    ],
    title: 'What LinkHub does not do',
  },
  {
    paragraphs: [
      "When you create a link card, LinkHub may request a favicon from Google's public favicon service using the target hostname so the card can show a site icon.",
      'That request does not upload your canvas content, templates, themes, imported bundles, or gallery images.',
    ],
    title: 'External requests',
  },
  {
    paragraphs: [
      'Browser vendors, extension stores, and any hosting platform you choose may collect their own operational or transaction data under their own policies. That handling is outside the LinkHub application itself.',
    ],
    title: 'Store and browser providers',
  },
] as const

function LinkSymbol() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path
        d="M9.55 14.45a1 1 0 0 1 0-1.41l3.49-3.49a3.35 3.35 0 0 1 4.74 4.74l-1.92 1.91a3.35 3.35 0 0 1-4.73 0 1 1 0 1 1 1.41-1.41 1.35 1.35 0 0 0 1.91 0l1.92-1.91a1.35 1.35 0 1 0-1.91-1.91l-3.49 3.49a1 1 0 0 1-1.42 0Zm-4.33.96 1.92-1.92a3.35 3.35 0 0 1 4.73 0 1 1 0 0 1-1.41 1.42 1.35 1.35 0 0 0-1.91 0l-1.92 1.91a1.35 1.35 0 0 0 1.91 1.91l3.49-3.49a1 1 0 1 1 1.42 1.41l-3.49 3.5a3.35 3.35 0 0 1-4.74-4.74Z"
        fill="currentColor"
      />
    </svg>
  )
}

function ComboDisplay({ combo }: { combo: readonly string[] }) {
  return (
    <div className={styles.comboCell}>
      {combo.map((segment, index) => (
        <span
          className={styles.comboSegment}
          key={`${combo.join('-')}-${segment}`}
        >
          {index > 0 ? <span className={styles.comboJoin}>+</span> : null}
          <kbd>{segment}</kbd>
        </span>
      ))}
    </div>
  )
}

function ShortcutTable({
  label,
  rows,
}: {
  label: string
  rows: readonly ShortcutRow[]
}) {
  return (
    <section className={styles.sectionBlock}>
      <p className={styles.sectionLabel}>{label}</p>
      <div className={styles.tableWrap}>
        <table className={styles.shortcutTable}>
          <thead>
            <tr>
              <th scope="col">Combination</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${label}-${row.combo.join('-')}-${row.action}`}>
                <th scope="row">
                  <ComboDisplay combo={row.combo} />
                </th>
                <td>{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function WorkspaceHelpDock({ interactionMode }: WorkspaceHelpDockProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const isOpen = activePanel !== null
  const isPrivacyOpen = activePanel === 'privacy'

  const title = isPrivacyOpen ? 'Privacy policy' : 'LinkHub help'
  const eyebrow = isPrivacyOpen ? 'Privacy' : 'Help'
  const description = isPrivacyOpen
    ? 'This in-app policy summary matches the local-first storage model used by LinkHub.'
    : 'Shortcuts, canvas controls, feedback links, and privacy information in one responsive window.'

  return (
    <div className={styles.shell}>
      <DialogFrame
        closeLabel={
          isPrivacyOpen ? 'Close privacy dialog' : 'Close help dialog'
        }
        description={description}
        eyebrow={eyebrow}
        headerActions={
          isPrivacyOpen ? (
            <button
              className={styles.backButton}
              onClick={() => setActivePanel('help')}
              type="button"
            >
              Back to help
            </button>
          ) : undefined
        }
        onRequestClose={() => setActivePanel(null)}
        open={isOpen}
        size="wide"
        title={title}
      >
        {isPrivacyOpen ? (
          <div
            className={styles.privacyBody}
            data-testid="workspace-privacy-dialog"
          >
            <div className={styles.privacySectionList}>
              {privacySections.map((section) => (
                <section className={styles.privacySection} key={section.title}>
                  <h3>{section.title}</h3>
                  {section.paragraphs.map((paragraph) => (
                    <p key={`${section.title}-${paragraph}`}>{paragraph}</p>
                  ))}
                  {section.bullets ? (
                    <ul>
                      {section.bullets.map((bullet) => (
                        <li key={`${section.title}-${bullet}`}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.helpBody} data-testid="workspace-help-dialog">
            <div className={styles.helpLead}>
              <span className={styles.modeBadge} data-mode={interactionMode}>
                {interactionMode === 'edit' ? 'Edit mode' : 'View mode'}
              </span>
              <p>
                Keyboard shortcuts are active while LinkHub is in edit mode.
                Canvas gestures remain available regardless of mode.
              </p>
            </div>

            <div className={styles.helpGrid}>
              <ShortcutTable
                label="Keyboard shortcuts"
                rows={keyboardShortcuts}
              />
              <div className={styles.sideColumn}>
                <ShortcutTable label="Canvas controls" rows={canvasGestures} />

                <section className={styles.sectionBlock}>
                  <p className={styles.sectionLabel}>Links</p>
                  <div className={styles.linkList}>
                    <a
                      className={styles.linkRow}
                      href={FEEDBACK_URL}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span>Give feedback</span>
                      <span className={styles.linkIcon}>
                        <LinkSymbol />
                      </span>
                    </a>
                    <a
                      className={styles.linkRow}
                      href={REPOSITORY_URL}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span>View repository</span>
                      <span className={styles.linkIcon}>
                        <LinkSymbol />
                      </span>
                    </a>
                    <button
                      className={styles.linkRowButton}
                      onClick={() => setActivePanel('privacy')}
                      type="button"
                    >
                      <span>Privacy policy</span>
                      <span className={styles.linkIcon}>
                        <LinkSymbol />
                      </span>
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </DialogFrame>

      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={isOpen ? 'Close help panel' : 'Open help panel'}
        className={styles.toggle}
        data-testid="workspace-help-toggle"
        onClick={() => setActivePanel((current) => (current ? null : 'help'))}
        type="button"
      >
        <span aria-hidden="true" className={styles.toggleGlyph}>
          ?
        </span>
      </button>
    </div>
  )
}
