import {
  memo,
  type FocusEventHandler,
  type MouseEventHandler,
  type PointerEventHandler,
  type RefObject,
} from 'react'

import styles from './LinkCard.module.css'

import type { LinkCard as LinkCardModel } from '../../contracts/linkCard'
import type { SurfaceShadowStyle } from '../../contracts/surfaceEffects'
import { type ResizeDirection } from '../../features/placement/useResizePlacement'
import type { InteractionMode } from '../../state/useWorkspaceStore'
import type { LinkCardViewModel } from './useLinkCardViewModel'

const RESIZE_HANDLES: ResizeDirection[] = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
]

const resizeHandleClassNameByDirection: Record<ResizeDirection, string> = {
  n: styles.resizeHandleN,
  s: styles.resizeHandleS,
  e: styles.resizeHandleE,
  w: styles.resizeHandleW,
  ne: styles.resizeHandleNE,
  nw: styles.resizeHandleNW,
  se: styles.resizeHandleSE,
  sw: styles.resizeHandleSW,
}

type LinkCardViewProps = {
  articleRef: RefObject<HTMLElement | null>
  card: LinkCardModel
  interactionMode: InteractionMode
  isEditMode: boolean
  isSelected: boolean
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
  interactionMode,
  isEditMode,
  isSelected,
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

                  if (image.dataset.fallbackApplied === 'true') {
                    image.style.visibility = 'hidden'
                    return
                  }

                  try {
                    image.dataset.fallbackApplied = 'true'
                    image.src = `${new URL(card.url).origin}/favicon.ico`
                  } catch {
                    image.style.visibility = 'hidden'
                  }
                }}
              />
            ) : (
              <div className={styles.placeholder}>Image unavailable</div>
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
          ? `${styles.card} ${styles.cardEdit} ${isSelected ? styles.cardSelected : ''}`
          : `${styles.card} ${styles.cardView}`
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
          {RESIZE_HANDLES.map((direction) => (
            <button
              aria-label={`Resize ${direction}`}
              className={`${styles.resizeHandle} ${resizeHandleClassNameByDirection[direction]}`}
              data-role="resize-handle"
              key={direction}
              onPointerDown={createResizePointerDown(direction)}
              tabIndex={-1}
              type="button"
            />
          ))}
          <div className={linkClassName} data-layout={viewModel.cardLayout}>
            {content}
          </div>
          <div className={styles.actionBar} data-role="action-bar">
            <button
              aria-label="Update"
              className={styles.actionButton}
              title="Update"
              type="button"
              onClick={onOpenEditor}
            >
              <span aria-hidden="true" className={styles.actionIcon}>
                <svg
                  viewBox="0 0 24 24"
                  focusable="false"
                  className={styles.actionSvg}
                >
                  <path
                    d="M5 19.02h3.75L19.81 7.96l-3.75-3.75L5 15.27v3.75Zm2.92-1.5H6.5V16.1l9.56-9.56 1.42 1.42-9.56 9.56ZM20.71 7.06a1 1 0 0 0 0-1.41l-2.36-2.36a1 1 0 1 0-1.41 1.41l2.36 2.36a1 1 0 0 0 1.41 0Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
            </button>
            <button
              aria-label="Delete"
              className={`${styles.actionButton} ${styles.actionButtonDanger}`}
              title="Delete"
              type="button"
              onClick={onDelete}
            >
              <span aria-hidden="true" className={styles.actionIcon}>
                <svg
                  viewBox="0 0 24 24"
                  focusable="false"
                  className={styles.actionSvg}
                >
                  <path
                    d="M6.7 5.3a1 1 0 0 1 1.4 0L12 9.17l3.9-3.88a1 1 0 1 1 1.4 1.42L13.4 10.6l3.88 3.9a1 1 0 0 1-1.42 1.4L12 12l-3.9 3.9a1 1 0 0 1-1.4-1.42l3.88-3.88-3.9-3.9a1 1 0 0 1 0-1.4Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
            </button>
          </div>
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
    </article>
  )
})
