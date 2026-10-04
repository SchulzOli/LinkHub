import {
  memo,
  useMemo,
  type FocusEventHandler,
  type MouseEventHandler,
  type PointerEventHandler,
  type RefObject,
} from 'react'

import styles from './LinkCard.module.css'

import type { LinkCard as LinkCardModel } from '../../contracts/linkCard'
import type { SurfaceShadowStyle } from '../../contracts/surfaceEffects'
import {
  createPlaceholderDataUrl,
  getFaviconPlaceholderLetter,
} from '../../features/favicon/faviconCache'
import type { ResizeDirection } from '../../features/placement/useResizePlacement'
import type { InteractionMode } from '../../state/useWorkspaceStore'
import {
  NodeActionBar,
  NodeActionButton,
  NodeResizeHandles,
} from '../nodes/NodeChrome'
import { NODE_CHROME_HOST } from '../nodes/nodeClasses'
import type { LinkCardViewModel } from './useLinkCardViewModel'

type LinkCardViewProps = {
  articleRef: RefObject<HTMLElement | null>
  card: LinkCardModel
  faviconsOfflineOnly: boolean
  interactionMode: InteractionMode
  isEditMode: boolean
  isSelected: boolean
  linkStatus: 'ok' | 'broken' | 'unknown'
  viewModel: LinkCardViewModel
  createResizePointerDown: (
    direction: ResizeDirection,
  ) => PointerEventHandler<HTMLButtonElement>
  onCardBlur: FocusEventHandler<HTMLElement>
  onCardFocus: FocusEventHandler<HTMLElement>
  onCardPointerDown: PointerEventHandler<HTMLElement>
  onCardPointerEnter: PointerEventHandler<HTMLElement>
  onCardPointerLeave: PointerEventHandler<HTMLElement>
  onDelete: MouseEventHandler<HTMLButtonElement>
  onOpenEditor: MouseEventHandler<HTMLButtonElement>
  onViewAuxClick: MouseEventHandler<HTMLAnchorElement>
  onViewClick: MouseEventHandler<HTMLAnchorElement>
}

function toLinkClassName(className: string) {
  return className
    .split(' ')
    .map((token) => styles[token as keyof typeof styles] ?? token)
    .join(' ')
}

export const LinkCardView = memo(function LinkCardView({
  articleRef,
  card,
  faviconsOfflineOnly,
  interactionMode,
  isEditMode,
  isSelected,
  linkStatus,
  viewModel,
  createResizePointerDown,
  onCardBlur,
  onCardFocus,
  onCardPointerDown,
  onCardPointerEnter,
  onCardPointerLeave,
  onDelete,
  onOpenEditor,
  onViewAuxClick,
  onViewClick,
}: LinkCardViewProps) {
  const linkClassName = toLinkClassName(viewModel.linkClassName)

  const placeholderLetter = useMemo(
    () => getFaviconPlaceholderLetter(card.url),
    [card.url],
  )
  const placeholderDataUrl = useMemo(
    () => createPlaceholderDataUrl(placeholderLetter),
    [placeholderLetter],
  )

  const content = (
    <>
      {viewModel.showCardImage ? (
        <div className={styles.cardHeader}>
          <div className={styles.faviconShell}>
            {viewModel.resolvedCardImageUrl ? (
              <img
                alt=""
                className={`${styles.favicon} ${viewModel.usesEdgeToEdgeCardImage ? styles.faviconImageSource : styles.faviconIconSource}`}
                data-testid="card-image"
                draggable={false}
                loading="lazy"
                src={viewModel.resolvedCardImageUrl}
                onDragStart={(event) => {
                  event.preventDefault()
                }}
                onError={(event) => {
                  const image = event.currentTarget as HTMLImageElement

                  if (viewModel.usesEdgeToEdgeCardImage) {
                    image.style.visibility = 'hidden'
                    return
                  }

                  const attempt = Number(image.dataset.fallbackAttempt ?? 0)

                  if (attempt >= 2) {
                    // All fallbacks exhausted – show placeholder initial chip
                    if (placeholderDataUrl) {
                      image.src = placeholderDataUrl
                    } else {
                      image.style.visibility = 'hidden'
                    }
                    return
                  }

                  image.dataset.fallbackAttempt = String(attempt + 1)

                  try {
                    const origin = new URL(card.url).origin

                    if (attempt === 0) {
                      // First fallback: host's own favicon.ico
                      image.src = `${origin}/favicon.ico`
                      return
                    }

                    if (attempt === 1 && !faviconsOfflineOnly) {
                      // Second fallback: Google service
                      const hostname = new URL(card.url).hostname
                      image.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`
                      return
                    }
                  } catch {
                    // URL parse error – show placeholder
                    if (placeholderDataUrl) {
                      image.src = placeholderDataUrl
                    } else {
                      image.style.visibility = 'hidden'
                    }
                  }
                }}
              />
            ) : (
              <div
                className={styles.placeholder}
                data-testid="card-image-placeholder"
              >
                {placeholderLetter}
              </div>
            )}
            {viewModel.showCardTitle ? (
              <div className={styles.titleOverlay}>
                <h2
                  className={`${styles.title} ${styles.overlayTitle}`}
                  data-testid="card-title"
                >
                  {viewModel.titleFallbackText}
                </h2>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {viewModel.showCardTitle && !viewModel.showCardImage ? (
        <div className={styles.textOnlyFrame}>
          <h2 className={styles.title} data-testid="card-title">
            {viewModel.titleFallbackText}
          </h2>
        </div>
      ) : null}
    </>
  )

  return (
    <article
      ref={articleRef}
      className={
        isEditMode
          ? `${styles.card} ${NODE_CHROME_HOST} ${styles.cardEdit} ${isSelected ? styles.cardSelected : ''}`
          : `${styles.card} ${NODE_CHROME_HOST} ${styles.cardView}`
      }
      data-circular-shape={String(viewModel.isCircularShape)}
      data-card-image-layout={viewModel.cardImageLayout}
      data-entity-id={card.id}
      data-entity-kind="card"
      data-mode={interactionMode}
      data-selected={isSelected}
      data-shadow-style={viewModel.resolvedShadowStyle as SurfaceShadowStyle}
      data-surface-transparency={String(viewModel.resolvedSurfaceTransparency)}
      data-testid={`link-card-${card.id}`}
      data-title-overlay={String(
        viewModel.showCardImage && viewModel.showCardTitle,
      )}
      onBlur={onCardBlur}
      onFocus={onCardFocus}
      onPointerDown={onCardPointerDown}
      onPointerEnter={onCardPointerEnter}
      onPointerLeave={onCardPointerLeave}
      style={viewModel.cardStyle}
    >
      {isEditMode ? (
        <>
          <NodeResizeHandles
            label={(direction) => `Resize ${direction}`}
            onPointerDown={createResizePointerDown}
          />
          <div className={linkClassName} data-layout={viewModel.cardLayout}>
            {content}
          </div>
          <NodeActionBar>
            <NodeActionButton
              kind="edit"
              label="Update"
              onClick={onOpenEditor}
            />
            <NodeActionButton kind="delete" label="Delete" onClick={onDelete} />
          </NodeActionBar>
        </>
      ) : (
        <a
          className={linkClassName}
          data-layout={viewModel.cardLayout}
          href={card.url}
          rel={viewModel.openLinkInNewTab ? 'noreferrer' : undefined}
          target={viewModel.openLinkInNewTab ? '_blank' : undefined}
          onAuxClick={onViewAuxClick}
          onClick={onViewClick}
        >
          {content}
        </a>
      )}
      {linkStatus === 'broken' ? (
        <div
          aria-label="Broken link"
          className={styles.brokenLinkBadge}
          title="This link could not be reached"
        >
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />
          </svg>
        </div>
      ) : null}
    </article>
  )
})
