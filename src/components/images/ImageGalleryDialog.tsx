import { useEffect, useRef, useState } from 'react'

import styles from './ImageGalleryDialog.module.css'

import type { ImageAsset } from '../../contracts/imageAsset'
import type { ImageUsageSummary } from '../../features/images/imageUsage'
import { useImageAssetUrl } from '../../features/images/useImageAssetUrl'
import { DialogFrame } from '../ui/DialogFrame'
import { EditIcon } from '../ui/EditIcon'

type ImageGalleryMode = 'browse' | 'pick-card-image' | 'pick-picture-image'

type ImageGalleryDialogProps = {
  activeImageId?: string
  assets: ImageAsset[]
  mode: ImageGalleryMode
  open: boolean
  usageByImageId: Record<string, ImageUsageSummary>
  onDeleteAsset: (asset: ImageAsset) => void
  onImportAsset: (file: File) => void
  onRequestClose: () => void
  onRenameAsset: (asset: ImageAsset, name: string) => Promise<void>
  onSelectAsset: (asset: ImageAsset) => void
}

function formatImageDimensions(asset: ImageAsset) {
  if (!asset.width || !asset.height) {
    return 'Unknown dimensions'
  }

  return `${asset.width} x ${asset.height}px`
}

function formatByteSize(byteSize: number) {
  if (byteSize >= 1024 * 1024) {
    return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`
  }

  if (byteSize >= 1024) {
    return `${Math.round(byteSize / 1024)} KB`
  }

  return `${byteSize} B`
}

function GalleryPrimaryActionIcon(props: {
  className?: string
  mode: ImageGalleryMode
}) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" className={props.className}>
      <path
        d="M5.75 4A1.75 1.75 0 0 0 4 5.75v12.5C4 19.22 4.78 20 5.75 20h12.5c.97 0 1.75-.78 1.75-1.75V5.75C20 4.78 19.22 4 18.25 4H5.75Zm0 1.5h12.5c.14 0 .25.11.25.25v8.08l-2.73-2.73a1.25 1.25 0 0 0-1.77 0l-1.59 1.59-3.16-3.16a1.25 1.25 0 0 0-1.77 0L5.5 12.52V5.75c0-.14.11-.25.25-.25Zm12.5 13h-12.5a.25.25 0 0 1-.25-.25v-3.61l2.87-2.87 3.16 3.16a1.25 1.25 0 0 0 1.77 0l1.59-1.59 3.61 3.61v1.3c0 .14-.11.25-.25.25ZM9 7.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
        fill="currentColor"
      />
      {props.mode === 'browse' ? (
        <path
          d="M17.5 13.75a.75.75 0 0 1 .75.75v2h2a.75.75 0 0 1 0 1.5h-2v2a.75.75 0 0 1-1.5 0v-2h-2a.75.75 0 0 1 0-1.5h2v-2a.75.75 0 0 1 .75-.75Z"
          fill="currentColor"
        />
      ) : (
        <path
          d="M15.69 15.78a.75.75 0 0 1 1.06 0l1.04 1.04 2.46-2.46a.75.75 0 1 1 1.06 1.06l-2.99 2.99a.75.75 0 0 1-1.06 0l-1.57-1.57a.75.75 0 0 1 0-1.06Z"
          fill="currentColor"
        />
      )}
    </svg>
  )
}

function SaveIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" className={props.className}>
      <path
        d="M9.6 16.4 5.95 12.75a1 1 0 1 1 1.41-1.41l2.24 2.24 6.98-6.99a1 1 0 0 1 1.42 1.42l-7.69 7.69a1 1 0 0 1-1.41 0Z"
        fill="currentColor"
      />
    </svg>
  )
}

function CloseIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" className={props.className}>
      <path
        d="M6.7 5.3a1 1 0 0 1 1.4 0L12 9.17l3.9-3.88a1 1 0 1 1 1.4 1.42L13.4 10.6l3.88 3.9a1 1 0 0 1-1.42 1.4L12 12l-3.9 3.9a1 1 0 0 1-1.4-1.42l3.88-3.88-3.9-3.9a1 1 0 0 1 0-1.4Z"
        fill="currentColor"
      />
    </svg>
  )
}

function ImageGalleryTile(props: {
  active: boolean
  asset: ImageAsset
  mode: ImageGalleryMode
  usage: ImageUsageSummary | undefined
  onDeleteAsset: (asset: ImageAsset) => void
  onRenameAsset: (asset: ImageAsset, name: string) => Promise<void>
  onSelectAsset: (asset: ImageAsset) => void
}) {
  const imageUrl = useImageAssetUrl(props.asset.id)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const [draftName, setDraftName] = useState(props.asset.name)
  const [isEditing, setIsEditing] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const primaryActionLabel =
    props.mode === 'pick-card-image'
      ? 'Use for card'
      : props.mode === 'pick-picture-image'
        ? 'Use for picture'
        : 'Create picture node'
  const trimmedDraftName = draftName.trim()

  useEffect(() => {
    if (!isEditing) {
      setDraftName(props.asset.name)
    }
  }, [isEditing, props.asset.name])

  useEffect(() => {
    if (!isEditing) {
      return
    }

    renameInputRef.current?.focus()
    renameInputRef.current?.select()
  }, [isEditing])

  const cancelRename = () => {
    if (isRenaming) {
      return
    }

    setDraftName(props.asset.name)
    setIsEditing(false)
  }

  const submitRename = async () => {
    if (!trimmedDraftName) {
      return
    }

    if (trimmedDraftName === props.asset.name) {
      setDraftName(props.asset.name)
      setIsEditing(false)
      return
    }

    setIsRenaming(true)

    try {
      await props.onRenameAsset(props.asset, trimmedDraftName)
      setIsEditing(false)
    } finally {
      setIsRenaming(false)
    }
  }

  return (
    <article
      className={`${styles.card} ${props.active ? styles.cardActive : ''}`}
      data-active={props.active}
    >
      <div className={styles.previewFrame}>
        {imageUrl ? (
          <img
            alt=""
            className={styles.previewImage}
            draggable={false}
            loading="lazy"
            src={imageUrl}
          />
        ) : (
          <div className={styles.previewPlaceholder}>No preview available</div>
        )}
      </div>
      <div className={styles.meta}>
        <div className={styles.nameRow}>
          <h3 className={styles.name}>{props.asset.name}</h3>
          {props.asset.isAnimated ? (
            <span className={styles.badge}>Animated</span>
          ) : null}
          {props.active ? <span className={styles.badge}>Active</span> : null}
        </div>
        {isEditing ? (
          <form
            className={styles.renameForm}
            onSubmit={(event) => {
              event.preventDefault()
              void submitRename()
            }}
            onKeyDown={(event) => {
              event.stopPropagation()

              if (event.key === 'Escape') {
                event.preventDefault()
                cancelRename()
              }
            }}
          >
            <input
              aria-label="Image title"
              className={styles.renameInput}
              disabled={isRenaming}
              placeholder="Image title"
              ref={renameInputRef}
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.currentTarget.value)}
            />
            <div className={styles.renameActions}>
              <button
                aria-label="Save title"
                className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
                disabled={!trimmedDraftName || isRenaming}
                title="Save title"
                type="submit"
              >
                <span aria-hidden="true" className={styles.actionIcon}>
                  <SaveIcon className={styles.actionSvg} />
                </span>
              </button>
              <button
                aria-label="Cancel title edit"
                className={styles.actionButton}
                disabled={isRenaming}
                title="Cancel title edit"
                type="button"
                onClick={cancelRename}
              >
                <span aria-hidden="true" className={styles.actionIcon}>
                  <CloseIcon className={styles.actionSvg} />
                </span>
              </button>
            </div>
          </form>
        ) : null}
        <p className={styles.metaLine}>
          {formatImageDimensions(props.asset)} |{' '}
          {formatByteSize(props.asset.byteSize)}
        </p>
        <p className={styles.metaLine}>
          Used {props.usage?.totalCount ?? 0} time
          {props.usage?.totalCount === 1 ? '' : 's'}
        </p>
      </div>
      <div className={styles.actions}>
        <button
          aria-label={primaryActionLabel}
          className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
          disabled={isEditing || isRenaming}
          title={primaryActionLabel}
          type="button"
          onClick={() => props.onSelectAsset(props.asset)}
        >
          <span aria-hidden="true" className={styles.actionIcon}>
            <GalleryPrimaryActionIcon
              className={styles.actionSvg}
              mode={props.mode}
            />
          </span>
        </button>
        <button
          aria-label="Edit title"
          aria-pressed={isEditing}
          className={`${styles.actionButton} ${isEditing ? styles.actionButtonPrimary : ''}`}
          disabled={isRenaming}
          title="Edit title"
          type="button"
          onClick={() => {
            if (isEditing) {
              cancelRename()
              return
            }

            setDraftName(props.asset.name)
            setIsEditing(true)
          }}
        >
          <span aria-hidden="true" className={styles.actionIcon}>
            <EditIcon className={styles.actionSvg} />
          </span>
        </button>
        <button
          aria-label="Delete"
          className={`${styles.actionButton} ${styles.actionButtonDanger}`}
          disabled={isEditing || isRenaming}
          title="Delete image"
          type="button"
          onClick={() => props.onDeleteAsset(props.asset)}
        >
          <span aria-hidden="true" className={styles.actionIcon}>
            <CloseIcon className={styles.actionSvg} />
          </span>
        </button>
      </div>
    </article>
  )
}

export function ImageGalleryDialog({
  activeImageId,
  assets,
  mode,
  open,
  usageByImageId,
  onDeleteAsset,
  onImportAsset,
  onRequestClose,
  onRenameAsset,
  onSelectAsset,
}: ImageGalleryDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const title =
    mode === 'pick-card-image'
      ? 'Choose Card Image'
      : mode === 'pick-picture-image'
        ? 'Choose Picture Image'
        : 'Image Gallery'
  const description =
    mode === 'pick-card-image'
      ? 'Pick an uploaded image to replace the default favicon on this card.'
      : mode === 'pick-picture-image'
        ? 'Pick an uploaded image to replace the current picture.'
        : 'Browse uploaded images, create picture nodes from them, or remove them from the gallery.'

  return (
    <DialogFrame
      closeLabel="Close image gallery"
      description={description}
      flushContent
      headerActions={
        <>
          <input
            ref={fileInputRef}
            accept="image/*"
            className={styles.hiddenInput}
            type="file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]

              event.currentTarget.value = ''

              if (!file) {
                return
              }

              onImportAsset(file)
            }}
          />
          <button
            aria-label="Import picture"
            className={`${styles.secondaryAction} ${styles.importButton}`}
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Import picture"
          >
            <span aria-hidden="true" className={styles.importIcon}>
              <svg
                viewBox="0 0 24 24"
                focusable="false"
                className={styles.importSvg}
              >
                <path
                  d="M5.75 4A1.75 1.75 0 0 0 4 5.75v12.5C4 19.22 4.78 20 5.75 20h12.5c.97 0 1.75-.78 1.75-1.75V5.75C20 4.78 19.22 4 18.25 4H5.75Zm0 1.5h12.5c.14 0 .25.11.25.25v8.08l-2.73-2.73a1.25 1.25 0 0 0-1.77 0l-1.59 1.59-3.16-3.16a1.25 1.25 0 0 0-1.77 0L5.5 12.52V5.75c0-.14.11-.25.25-.25Zm12.5 13h-12.5a.25.25 0 0 1-.25-.25v-3.61l2.87-2.87 3.16 3.16a1.25 1.25 0 0 0 1.77 0l1.59-1.59 3.61 3.61v1.3c0 .14-.11.25-.25.25ZM9 7.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </button>
        </>
      }
      open={open}
      onRequestClose={onRequestClose}
      size="wide"
      title={title}
    >
      <div className={styles.content}>
        {assets.length === 0 ? (
          <div className={styles.emptyState}>
            Import your first image here, from the taskbar, or drop it on the
            canvas, then reuse it here.
          </div>
        ) : (
          <div className={styles.grid}>
            {assets.map((asset) => (
              <ImageGalleryTile
                key={asset.id}
                active={activeImageId === asset.id}
                asset={asset}
                mode={mode}
                usage={usageByImageId[asset.id]}
                onDeleteAsset={onDeleteAsset}
                onRenameAsset={onRenameAsset}
                onSelectAsset={onSelectAsset}
              />
            ))}
          </div>
        )}
      </div>
    </DialogFrame>
  )
}
