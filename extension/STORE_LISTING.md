# Store Listing — Firefox / Chrome / Edge

---

## Table of Contents

- [Summary](#summary)
- [Search Terms](#search-terms)
- [Store Assets](#store-assets)
- [Description](#description)
- [Notes to Reviewer](#notes-to-reviewer)
- [Privacy Policy](#privacy-policy)

---

## Summary

> max 250 characters

Your personal link canvas as a new tab page. Organize bookmarks, links, images, themes, and reusable layouts on an infinite drag-and-drop board with multiple workspaces and local-first storage.

---

## Search Terms

> max 7 terms, max 30 characters each, 21 words total

- new tab page
- visual bookmark manager
- start page organizer
- link dashboard
- infinite canvas
- workspace bookmarks
- bookmark groups

---

## Store Assets

### Screenshots

- extension/screenshots/01-canvas-overview.png — Overview of a large grouped link collection with five groups and fifty visible nodes across the infinite canvas.
- extension/screenshots/02-groups-organization.png — A prominent Development group with five visible link nodes plus a secondary Social group to show grouped canvas organization.
- extension/screenshots/03-themes-customization.png — Themes panel open with the canvas visible behind it to highlight appearance customization and multiple built-in themes.
- extension/screenshots/04-card-edit-styling.png — Card edit panel open with styling controls for color, size, shadow, transparency, and per-card adjustments.
- extension/screenshots/05-multiple-workspaces.png — Workspace sidebar pinned open with multiple boards available for switching between separate setups.
- extension/screenshots/06-template-library.png — Templates panel showing a reusable grouped layout with preview, insertion, duplication, and local image preservation.

### Edge Promotional Assets

- extension/store-assets/edge-small-promotional-tile-440x280.png
- extension/store-assets/edge-large-promotional-tile-1400x560.png

### Chrome Promotional Assets

- extension/store-assets/chrome-small-promotional-tile-440x280.png
- extension/store-assets/chrome-marquee-promotional-tile-1400x560.png

---

## Description

LinkHub replaces your browser new tab page with a visual link canvas.

Drag, group, resize, and style your link cards on a zoomable infinite board. Every link has a place — no folders, no clutter, just a clean spatial layout you design yourself.

**Canvas**
Pan, zoom, and navigate freely. Snap-to-grid keeps everything aligned. Multi-select, copy, paste, undo, and format painter let you work fast.

**Link Cards**
Create cards from any URL. Favicons are fetched automatically. Resize cards from 2×2 up to 12×12 grid cells. Toggle title and image visibility. Override favicons with custom images. Style each card with fill color, border color, corner radius, transparency, and shadow.

**Groups**
Nest cards inside collapsible groups for organization. Groups support the same styling controls as cards. Nest groups inside groups for deeper hierarchy.

**Pictures**
Drop images directly onto the canvas, keep them as picture nodes, and manage reusable assets in a built-in gallery.

**Appearance**
Choose from six built-in themes: Excalidraw, Blueprint, Minimal, Nord, Sunset, and Neon. Save the current setup as a custom theme, import `.linkhub-theme.json`, and tune workspace defaults plus surface effects.

**Templates**
Save selected cards, groups, and pictures as reusable templates with preview thumbnails. Duplicate them locally or download template exports as `.template.json` files.

**Import & Export**
Export the current workspace as a `.linkhub.zip` bundle together with your local image gallery, saved templates, and saved custom themes. Import can either replace the current canvas or create a new workspace from the bundle.

**Multiple Workspaces**
Create, rename, reorder, pin, and switch between multiple workspaces via a sidebar rail.

**Privacy**
All content and local usage insights stay in your browser storage. No account required. No cloud sync. No third-party analytics. No ads.

---

## Notes to Reviewer

LinkHub is a new-tab override extension. It replaces the browser new tab page with a local-first link canvas application.

The extension stores all user data locally in IndexedDB plus localStorage fallback snapshots, including workspaces, workspace names, link cards, groups, picture nodes, gallery images, templates, themes, appearance preferences, and local usage statistics used by the in-app Statistics view. No user account, sign-in, or remote sync service is involved.

The extension does not make any network requests except for fetching favicon images from Google's public favicon service (https://www.google.com/s2/favicons) when the user creates a new link card from a URL.

### Build environment

- OS: Windows, macOS, or Linux
- Node.js: v22 or later (https://nodejs.org/)
- npm: v10 or later (ships with Node.js)

### Build tools

- Vite (with Rolldown) — JavaScript/CSS bundler and minifier
- TypeScript (tsc) — transpiles .ts/.tsx to JavaScript
- CSS Modules — scoped CSS class names, processed by Vite

All tools are installed automatically via npm install. No source files are pre-transpiled or machine-generated. All application source code is in `src/`.

### Steps to reproduce the build

```
npm install
npm run build:extension
```

The built extension output is in `dist-extension/`. To create the ZIP:

```
cd dist-extension && zip -r ../linkhub-extension.zip . && cd ..
```

### Linter warnings

The AMO linter warnings about innerHTML (React DOM, html-to-image) and Function constructor (Zod, JSZip) are standard patterns from established third-party libraries. The extension's Content Security Policy (`script-src 'self'`) prevents actual eval execution at runtime.

### Notes for Certification (Edge)

LinkHub is a new-tab override extension. After installation, open a new tab to launch the app.

How to test:

1. Open a new tab.
2. Create a link card with the Add link button.
3. Optionally create a group, switch themes, save a template, or create a second workspace from the options menu.
4. Export a bundle or import a previous bundle to validate local transport behavior.
5. Close and reopen the browser or open another new tab to confirm local persistence.

Important behavior:

- No account or sign-in is required.
- All user data is stored locally in browser storage.
- Local usage statistics remain on device and are not sent to third-party analytics systems.
- The extension does not upload workspace data, templates, themes, or images to external servers.
- The only network request during normal use is favicon lookup from Google's public favicon service when a user creates a link card from a URL.
- The extension does not inject scripts into websites and does not require elevated browsing permissions.

If the reviewer wants to validate the packaged build, use:

```bash
npm install
npm run build:extension
```

---

## Privacy Policy

This policy applies to the LinkHub browser extension and to hosted web builds of LinkHub that use the same local-first storage model.

### What LinkHub stores

LinkHub may store the content you create or import directly inside your browser so the app can function between sessions.

- Workspaces and workspace names
- Link cards, groups, picture nodes, layout positions, and board settings
- Uploaded images and image gallery items
- Templates, custom themes, and appearance preferences
- Local usage statistics such as canvas opens and link opens
- Import and export metadata needed to restore your data correctly

### Where that data is stored

LinkHub stores data locally in browser-managed storage on the current device, including browser storage mechanisms such as IndexedDB and local storage when required for the product to work.

Your LinkHub data stays isolated to the browser profile and device where you use it, unless you explicitly export it yourself.

### What LinkHub does not do

- It does not require an account or sign-in.
- It does not upload your workspace content or local usage statistics to LinkHub servers.
- It does not include third-party advertising.
- It does not use third-party analytics or behavioral tracking.
- It does not sell or share your workspace data with external parties.

### External requests

When you create a link card, LinkHub may request a favicon from Google's public favicon service using the target domain so the card can show a site icon.

That request does not upload your canvas content, templates, themes, imported files, or gallery images.

### Imports and exports

If you choose to export data, LinkHub creates files on your device only when you explicitly trigger the export action. If you choose to import data, LinkHub reads the file you selected so it can restore that content into local browser storage.

These import and export actions are user-initiated. LinkHub does not perform automatic cloud backup or remote synchronization.

### Browser and store providers

Your browser vendor, extension store provider, or hosting provider may collect their own operational, telemetry, or transaction data under their own policies. That data handling is outside the LinkHub application itself.

### Changes to this policy

If LinkHub's data handling changes materially, this page should be updated before or at the same time as the corresponding product release.

### Contact

For privacy-related questions, use the contact information provided in the LinkHub store listing, project repository, or release page where LinkHub is distributed.

Last updated: 2026-04-18
