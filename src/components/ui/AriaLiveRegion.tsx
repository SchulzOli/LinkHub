import { useAnnouncerStore } from '../../state/useAnnouncerStore'

/**
 * Visually hidden, polite live region for canvas announcements (paste,
 * undo, blocked snap, etc.). Mounted once in the workspace shell.
 */
export function AriaLiveRegion() {
  const message = useAnnouncerStore((state) => state.message)
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="srOnly"
      data-testid="aria-live-region"
      role="status"
    >
      {message}
    </div>
  )
}
