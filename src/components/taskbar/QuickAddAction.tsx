import { useMemo } from 'react'

import { useQuickAddLink } from '../../features/links/useQuickAddLink'

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
          {open ? (
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M6.7 5.3a1 1 0 0 1 1.4 0L12 9.17l3.9-3.88a1 1 0 1 1 1.4 1.42L13.4 10.6l3.88 3.9a1 1 0 0 1-1.42 1.4L12 12l-3.9 3.9a1 1 0 0 1-1.4-1.42l3.88-3.88-3.9-3.9a1 1 0 0 1 0-1.4Z"
                fill="currentColor"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5Z"
                fill="currentColor"
              />
            </svg>
          )}
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
