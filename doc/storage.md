# Storage Overview

## Purpose

This document describes how LinkHub persists multi-workspace state, gallery images, templates, custom themes, and local usage statistics in the browser today.

The implementation deliberately separates structured records from binary payloads:

- Workspace state is stored as JSON documents.
- Image assets are stored as metadata plus blob payloads.
- Templates and themes are stored independently from workspace records.
- Workspace, template, and card records reference images by id instead of embedding image bytes.

That keeps workspace documents compact, allows fast local snapshots, and avoids duplicating the same image across multiple references.

## Storage Backends

LinkHub currently uses two browser-local persistence layers.

### IndexedDB

IndexedDB is the primary persistent store.

- Database name: `linkhub`
- Version: `5`
- Stores:
  - `workspace`
  - `workspace_metadata`
  - `image_assets`
  - `image_blobs`
  - `templates`
  - `template_image_assets`
  - `template_image_blobs`
  - `themes`

Implementation:

- [../src/storage/db.ts](../src/storage/db.ts)
- [../src/storage/storageBackend.ts](../src/storage/storageBackend.ts)

### localStorage

localStorage is the snapshot and fallback layer for workspace state and workspace-directory metadata. It is not used for binary assets.

Current keys:

- `linkhub.workspace` for the last active workspace snapshot
- `linkhub.workspace-directory` for workspace-directory metadata
- `linkhub.workspace.<workspaceId>` for per-workspace JSON snapshots

Images, template blobs, and theme assets are never written to localStorage.

Implementation:

- [../src/storage/workspaceRepository.ts](../src/storage/workspaceRepository.ts)

## Workspace Model

### Workspace records

Each workspace record is validated through the Zod workspace schema.

Relevant fields include:

- `id`
- `name`
- `appearance`
- `analytics`
- `placementGuide`
- `viewport`
- `groups`
- `cards`
- `pictures`
- `createdAt`
- `updatedAt`

Implementation:

- [../src/contracts/workspace.ts](../src/contracts/workspace.ts)

### Workspace directory

LinkHub no longer persists a single default board only. It keeps a workspace directory that tracks:

- `activeWorkspaceId`
- `interactionMode`
- `workspaceRailPinned`
- workspace summaries used by the rail UI

Each full workspace record is stored separately, while the directory keeps the list and UI session metadata.

Implementation:

- [../src/contracts/workspaceDirectory.ts](../src/contracts/workspaceDirectory.ts)
- [../src/storage/workspaceRepository.ts](../src/storage/workspaceRepository.ts)

## Load And Save Lifecycle

### Load flow

On application startup:

1. `AppProviders` loads a workspace session, not just a single workspace record.
2. The repository loads the workspace directory and resolves the active workspace.
3. IndexedDB is preferred; localStorage snapshots are used as fallback.
4. Loaded workspace documents are normalized through migrations before hydration.
5. After hydration, LinkHub records a local canvas-open event for the Statistics view.

Load orchestration:

- [../src/app/providers/AppProviders.tsx](../src/app/providers/AppProviders.tsx)
- [../src/storage/workspaceRepository.ts](../src/storage/workspaceRepository.ts)
- [../src/storage/storageMigrations.ts](../src/storage/storageMigrations.ts)

### Save flow

After the workspace is hydrated and the store is ready:

1. A localStorage snapshot is scheduled after `100 ms`.
2. An IndexedDB save is scheduled after `300 ms`.
3. The current workspace is flushed on `pagehide` and when the document becomes hidden.
4. Workspace-directory changes such as interaction mode and workspace rail pinning are persisted separately.

This gives fast crash resilience without making every UI update wait on IndexedDB.

Save orchestration:

- [../src/app/providers/AppProviders.tsx](../src/app/providers/AppProviders.tsx)

### Local analytics

Workspace records contain a local analytics section that powers the Statistics tab.

Current examples:

- canvas opens
- link opens per card
- time-bucketed history used for charts

These metrics stay local to the current browser profile. They are reset from exported workspace JSON so canvas bundles do not transport local usage history by default.

Implementation:

- [../src/contracts/workspaceAnalytics.ts](../src/contracts/workspaceAnalytics.ts)
- [../src/features/analytics/workspaceAnalytics.ts](../src/features/analytics/workspaceAnalytics.ts)
- [../src/features/importExport/canvasBundle.ts](../src/features/importExport/canvasBundle.ts)

## Images And Picture Nodes

### Workspace references

Picture nodes live inside the workspace JSON because they are part of the canvas layout, but they only store references to image assets.

Current reference points:

- `pictures[].imageId` for standalone picture nodes
- `cards[].faviconOverrideImageId` for custom card images

The actual image bytes remain app-wide records outside the workspace document.

Implementation:

- [../src/contracts/pictureNode.ts](../src/contracts/pictureNode.ts)
- [../src/contracts/linkCard.ts](../src/contracts/linkCard.ts)

### Image stores

Image storage is split into two stores:

- `image_assets` stores metadata such as name, file size, dimensions, mime type, and timestamps.
- `image_blobs` stores the matching binary payload keyed by the same asset id.

The same stored image can be reused by multiple cards, pictures, templates, or imported bundles.

Implementation:

- [../src/contracts/imageAsset.ts](../src/contracts/imageAsset.ts)
- [../src/storage/imageRepository.ts](../src/storage/imageRepository.ts)

### Supported formats

Current supported formats:

- APNG
- AVIF
- GIF
- JPEG
- PNG
- SVG
- WebP

Format resolution:

- [../src/contracts/imageAsset.ts](../src/contracts/imageAsset.ts)

### Deletion flow

Image deletion is usage-aware.

Before deletion, LinkHub checks whether an image is still referenced by:

- picture nodes
- link-card image overrides

If the user confirms deletion:

- dependent picture nodes are removed
- dependent card overrides are cleared
- metadata and blob entries are deleted from IndexedDB

Usage logic:

- [../src/features/images/imageUsage.ts](../src/features/images/imageUsage.ts)

## Templates

Templates are stored separately from workspaces.

- `templates` stores the serialized `TemplateDocument`
- `template_image_assets` stores image metadata keyed by `<templateId>:<imageId>`
- `template_image_blobs` stores the corresponding binary payloads

Template records can include preview thumbnails and copied image references so a template remains portable even if the original workspace changes later.

There are two template-related formats in the app:

- The on-disk template document format is `linkhub.template`
- Downloaded template exports use `.template.json` and embed image data URLs for transport

Implementation:

- [../src/contracts/template.ts](../src/contracts/template.ts)
- [../src/storage/templateRepository.ts](../src/storage/templateRepository.ts)
- [../src/features/templates/templateLibrary.ts](../src/features/templates/templateLibrary.ts)
- [../src/components/taskbar/OptionsMenu.tsx](../src/components/taskbar/OptionsMenu.tsx)

## Themes

Themes are also stored independently from workspaces.

- Built-in themes are shipped in code
- Saved or imported custom themes are persisted in the `themes` store

Current built-in theme set:

- Excalidraw
- Blueprint
- Minimal
- Nord
- Sunset
- Neon

Custom theme exports use `.linkhub-theme.json`.

Implementation:

- [../src/contracts/theme.ts](../src/contracts/theme.ts)
- [../src/features/themes/builtinThemes.ts](../src/features/themes/builtinThemes.ts)
- [../src/features/themes/themeImportExport.ts](../src/features/themes/themeImportExport.ts)
- [../src/storage/themeRepository.ts](../src/storage/themeRepository.ts)

## Canvas Bundle Import And Export

LinkHub can export and import the current canvas as a ZIP bundle.

### Bundle structure

The current bundle layout contains:

- `manifest.json`
- `workspace.json`
- `templates.json`
- `themes.json`
- `images/*`
- `template-images/<templateId>/*`

Current bundle file extension:

- `.linkhub.zip`

### Export behavior

Export is started from the Data tab and currently includes:

- the current workspace structure
- cards, groups, picture nodes, viewport, and appearance settings
- the whole local image gallery
- all saved templates plus copied template image files
- all saved custom themes

Workspace analytics are stripped from the exported workspace JSON before serialization.

Implementation:

- [../src/components/taskbar/OptionsDataSection.tsx](../src/components/taskbar/OptionsDataSection.tsx)
- [../src/components/taskbar/OptionsMenu.tsx](../src/components/taskbar/OptionsMenu.tsx)
- [../src/features/importExport/canvasBundle.ts](../src/features/importExport/canvasBundle.ts)

### Import behavior

Import supports two flows:

- replace the current canvas
- import the bundle as a brand-new workspace

During import:

- bundled images are reconciled against existing stored images
- image ids may be remapped to avoid collisions
- bundled templates are restored into the local template library
- bundled custom themes are restored into the local theme library
- unrelated gallery images, templates, and themes already on the device are kept

If a bundle is missing an image file that is referenced by the workspace payload, import fails instead of restoring incomplete data.

Implementation:

- [../src/features/importExport/canvasBundle.ts](../src/features/importExport/canvasBundle.ts)
- [../src/features/images/storedImageRecords.ts](../src/features/images/storedImageRecords.ts)

## Storage Statistics

The Statistics tab computes logical storage buckets for:

- groups
- cards
- pictures plus referenced workspace image assets
- gallery-only images
- templates
- themes

It also reports:

- the approximate current-board payload size
- the size of the localStorage snapshot
- the practical localStorage budget (`5 MiB`)
- browser-reported origin usage and quota when `navigator.storage.estimate()` is available

Implementation:

- [../src/features/analytics/workspaceStorage.ts](../src/features/analytics/workspaceStorage.ts)
- [../src/components/taskbar/StatisticsPanel.tsx](../src/components/taskbar/StatisticsPanel.tsx)

## Migration And Recovery

Workspace reads always pass through a migration layer.

Current migration responsibilities include:

- recovering malformed or partial workspace documents
- normalizing appearance fields from older shapes
- coercing card data into current schema
- coercing picture nodes into the current pictures array
- preserving safe defaults when fields are missing

Implementation: [../src/storage/storageMigrations.ts](../src/storage/storageMigrations.ts)

If a workspace cannot be loaded cleanly, LinkHub falls back to a fresh default
workspace rather than crashing.

## Store-Level Responsibilities

### Zustand Store

The workspace store owns in-memory editing state and mutations for:

- cards
- groups
- pictures
- selection
- undo history
- viewport and appearance

The store updates workspace timestamps through the workspace replacement helpers.

Implementation: [../src/state/useWorkspaceStore.ts](../src/state/useWorkspaceStore.ts)

### Repositories

Repository responsibilities are intentionally narrow.

- workspaceRepository handles loading and saving the default workspace record
- imageRepository handles image metadata and blob persistence

This separation keeps canvas editing logic out of persistence primitives.

## Repository Pattern

All four repositories follow the same structural convention.

### Common Operations

| Operation | workspace                 | image                     | template                         | theme           |
| --------- | ------------------------- | ------------------------- | -------------------------------- | --------------- |
| list      | loadWorkspaceDirectory()  | listImageAssets()         | listTemplates()                  | listThemes()    |
| get       | loadWorkspace(id)         | getImageAsset(id)         | getTemplate(id)                  | getTheme(id)    |
| put       | saveWorkspace(ws)         | saveImageAsset({file, …}) | putTemplate({template, records}) | putTheme(theme) |
| delete    | deleteWorkspaceRecord(id) | deleteImageAsset(id)      | deleteTemplate(id)               | deleteTheme(id) |

### Conventions

- Each repository is a module of plain async functions, not a class.
- All data access goes through `openLinkHubDb()` from `db.ts`.
- Put operations call a `toSerializable<Entity>()` helper to strip
  non-serializable runtime state before writing to IndexedDB.
- List operations validate each stored record through its Zod schema and
  silently drop records that fail validation.
- Delete operations use a single IndexedDB transaction to remove the
  entity and any associated blob stores atomically.
- workspaceRepository is the exception: it additionally writes a
  localStorage fallback snapshot for crash resilience.

### Why No Shared TypeScript Interface

The put signatures are structurally different across repositories
(e.g. image requires a File, template bundles images alongside the
document). A forced generic interface would obscure these differences
without adding safety. The documented pattern above serves as the
contract instead.

## Current Limitations

The current implementation has a few intentional boundaries.

- Only the default workspace is persisted today.
- Images are app-wide in IndexedDB, but multi-workspace management is not exposed yet.
- localStorage fallback covers workspace JSON only, not image blobs.
- Merge-style import is not implemented; importing replaces the current canvas.
- Template export/import and multi-workspace bundle flows are not implemented yet.

## Practical Summary

If you need to reason about storage in LinkHub, use this model:

- Workspace equals canvas structure and settings.
- Image assets equals reusable binary resources plus metadata.
- Workspace references images by id.
- IndexedDB is the source of truth.
- localStorage is only a safety snapshot for the workspace document.
