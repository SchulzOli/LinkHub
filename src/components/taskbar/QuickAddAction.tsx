import { useMemo } from 'react'

import { useQuickAddLink } from '../../features/links/useQuickAddLink'
import { AddLinkIcon, CloseIcon } from './TaskbarIcons'

type QuickAddActionProps = {
  open: boolean
  onToggle: () => void
  onSubmit: (url: string, title: string) => void
}

export function QuickAddAction({
  open,
  onToggle,
  onSubmit,
}: QuickAddActionProps) {
  const { submit, title, setTitle, url, setUrl } = useQuickAddLink(onSubmit)

  const canSubmit = useMemo(() => url.trim().length > 0, [url])

  return (
    <div className="quickAddShell">
      <button
        aria-label={open ? 'Close quick add' : 'Add link'}
        className="quickAddToggleButton"
        name="quick-add-toggle"
        onClick={onToggle}
        title={open ? 'Close' : 'Add link'}
        type="button"
      >
        <span aria-hidden="true" className="quickAddToggleIcon">
          {open ? <CloseIcon /> : <AddLinkIcon />}
        </span>
      </button>
      {open ? (
        <form
          className="quickAddForm"
          onSubmit={(event) => {
            event.preventDefault()
            if (!canSubmit) {
              return
            }

            submit()
          }}
        >
          <input
            aria-label="Link URL"
            placeholder="Paste URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <input
            aria-label="Link title"
            placeholder="Optional title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button disabled={!canSubmit} type="submit">
            Create
          </button>
        </form>
      ) : null}
    </div>
  )
}
