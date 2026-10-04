# LinkHub

[![CI](https://github.com/SchulzOli/LinkHub/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SchulzOli/LinkHub/actions/workflows/ci.yml)
[![Release](https://github.com/SchulzOli/LinkHub/actions/workflows/release.yml/badge.svg)](https://github.com/SchulzOli/LinkHub/actions/workflows/release.yml)
[![Docs](https://github.com/SchulzOli/LinkHub/actions/workflows/pages.yml/badge.svg?branch=main)](https://schulzoli.github.io/LinkHub/)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/linkhub/dpbgplhiaobnegcbfedihimnoamlpgmd)
[![Edge Add-ons](https://img.shields.io/badge/Edge-Add--ons-0A7FEA?style=for-the-badge&logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/linkhub/gkcpbfphinbaoplepknkinjfkdhljghp)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox-Add--ons-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/link-hub/)

LinkHub is a local-first infinite canvas for bookmarks, images, live charts, news feeds, themes, and reusable layouts. It turns a blank tab into a spatial board where every link has a place, and the same React app powers both the hosted web build and the browser-extension new-tab experience for Chrome, Edge, and Firefox.

**Documentation:** [schulzoli.github.io/LinkHub](https://schulzoli.github.io/LinkHub/)

![LinkHub canvas overview](extension/screenshots/01-canvas-overview.png)

## Why LinkHub

- Infinite canvas with pan, zoom, snap-to-grid placement, marquee multi-select, copy/cut/paste, undo, and format painter
- Link cards, collapsible nested groups, pictures, live charts, and RSS/Atom news feeds on the same board
- Multiple workspaces with a pinned or auto-hiding workspace rail
- Six built-in themes plus saved or imported custom themes and token-level customization
- Reusable templates with preview thumbnails and bundled local images
- Local statistics for link opens, canvas opens, and storage footprint
- No account, mandatory backend, or remote sync requirement

## Feature Overview

### Canvas and editing

- Pan with right-click drag and zoom with the mouse wheel
- Snap-to-grid placement with configurable snapping behavior
- Marquee select across cards, groups, and picture nodes
- Copy, cut, paste, duplicate, and undo workspace edits
- Keyboard shortcuts and an in-app help panel for fast editing

### Content and organization

- Create link cards from URLs with automatic favicon lookup
- Resize cards from 2x2 up to 12x12 grid cells
- Override favicons with uploaded gallery images
- Organize content inside collapsible groups and nested groups
- Drop images onto the canvas as standalone picture nodes
- Collapsing a group hides every node inside it, including charts and feeds

### Charts and news feeds

- Chart nodes plot a time series from a WebSocket or SSE feed: ranges from 1D to Max, price or % change, moving averages, log scale, CSV export
- Charts inside a group follow the group's settings; any chart can keep its own value
- News feed nodes merge several RSS or Atom feeds into one list with filter, sort, time window, and per-source toggles; each article opens in a new tab
- Optional local servers ship with the repository: `npm run feed:charts` (market data) and `npm run feed:news` (feed proxy). See [doc/CHART_FEED.md](doc/CHART_FEED.md) and [doc/NEWS_FEED.md](doc/NEWS_FEED.md)

### Themes, templates, and workspaces

- Built-in themes: Excalidraw, Blueprint, Minimal, Nord, Sunset, and Neon
- Save the current appearance as a custom theme, export it, or import `.linkhub-theme.json`
- Save selected canvas content as reusable templates with preview thumbnails
- Download template exports as `.template.json` files
- Create, rename, reorder, delete, and switch between multiple workspaces

### Data portability and local insights

- Export the current canvas as a `.linkhub.zip` bundle
- Bundle exports can include the current workspace, gallery images, saved templates, and saved custom themes
- Import can either replace the current canvas or create a new workspace
- Statistics stay local and cover card counts, group counts, link opens, canvas opens, and storage usage

## Screenshots

### Groups and layout organization

![LinkHub groups and layout organization](extension/screenshots/02-groups-organization.png)

### Theme and appearance customization

![LinkHub theme customization](extension/screenshots/03-themes-customization.png)

### Card editing and styling controls

![LinkHub card editing and styling](extension/screenshots/04-card-edit-styling.png)

### Multiple workspaces

![LinkHub multiple workspaces](extension/screenshots/05-multiple-workspaces.png)

### Template library

![LinkHub template library](extension/screenshots/06-template-library.png)

### Charts and news feeds

![LinkHub charts and news feeds](extension/screenshots/07-charts-and-news.png)

### Local statistics

![LinkHub local statistics](extension/screenshots/08-local-statistics.png)

## Quick Start

### Prerequisites

- Windows, macOS, or Linux
- Node.js 22 or later
- npm 10 or later

### Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build for production

```bash
npm run build
```

## Scripts

| Command                   | Description                               |
| ------------------------- | ----------------------------------------- |
| `npm run dev`             | Start the Vite development server         |
| `npm run build`           | Type-check and build the production app   |
| `npm run preview`         | Preview the production build locally      |
| `npm run feed:charts`     | Start the reference chart feed server     |
| `npm run feed:news`       | Start the RSS/Atom feed proxy             |
| `npm run docs:build`      | Build the documentation site into `site/` |
| `npm run lint`            | Run ESLint with zero warnings allowed     |
| `npm run format`          | Format the repository with Prettier       |
| `npm run test`            | Run Vitest with coverage                  |
| `npm run test:watch`      | Run Vitest in watch mode                  |
| `npm run test:e2e`        | Run Playwright end-to-end tests           |
| `npm run build:extension` | Build the browser extension package       |
| `npm run deploy`          | Run the extension deployment script       |
| `npm run deploy:chrome`   | Publish only the Chrome build             |
| `npm run deploy:edge`     | Publish only the Edge build               |
| `npm run deploy:firefox`  | Publish only the Firefox build            |
| `npm run deploy:dry`      | Dry-run the extension deployment flow     |

## Browser Extension

LinkHub can be packaged as a browser-extension new-tab experience for Chrome, Edge, and Firefox.

### Build the extension

```bash
npm run build:extension
```

This creates `dist-extension/` with the bundled app, manifest, icons, and privacy page.

### Load the extension locally

Chrome and Edge:

1. Open `chrome://extensions` or `edge://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select `dist-extension/`

Firefox:

1. Open `about:debugging#/runtime/this-firefox`
2. Click Load Temporary Add-on
3. Select `dist-extension/manifest.json`

To release, run **Actions → Release** with the new version and the stores to publish to; details in [extension/EXTENSION.md](extension/EXTENSION.md#releasing).

## Storage and Privacy

LinkHub is local-first.

- IndexedDB is the primary persistence layer for workspaces, templates, themes, image metadata, and image blobs
- localStorage is used as a lightweight snapshot and fallback layer for workspace state and workspace-directory metadata
- Local usage insights stay on the current device and power the in-app Statistics view only
- Creating a link card fetches the site's favicon once (from the site itself, then Google's public favicon service as a fallback) and caches it locally; **Favicons offline-only** skips the Google fallback
- Chart nodes connect only to the feed server URL set on the node (by default the optional local server on `127.0.0.1`)
- News feed nodes load the feeds you add through the feed proxy set on the node (by default the optional local proxy on `127.0.0.1`), or directly when the proxy is cleared; article images load from the news sites (can be turned off per node)
- **Check Links** in the Data tab sends a `HEAD` request to each link card's URL, only when you start it
- No account, remote sync requirement, or third-party analytics or behavioral tracking is built into the app

For deeper persistence details, see [doc/STORAGE.md](doc/STORAGE.md). The privacy policy is published at [schulzoli.github.io/LinkHub/privacy/](https://schulzoli.github.io/LinkHub/privacy/) and ships in the app at [public/privacy/index.html](public/privacy/index.html).

## Documentation

- [Documentation website](https://schulzoli.github.io/LinkHub/), built from `doc/` by `npm run docs:build`
- [doc/STORAGE.md](doc/STORAGE.md) for persistence, bundle, and migration details
- [doc/CHART_FEED.md](doc/CHART_FEED.md) for chart nodes and the feed protocol
- [doc/NEWS_FEED.md](doc/NEWS_FEED.md) for news feed nodes and the feed proxy
- [doc/CANVAS_ENGINE.md](doc/CANVAS_ENGINE.md) for the canvas engine and optional card effects
- [extension/EXTENSION.md](extension/EXTENSION.md) for extension packaging and release workflow
- [extension/STORE_LISTING.md](extension/STORE_LISTING.md) for store-copy and reviewer notes
- [public/privacy/index.html](public/privacy/index.html) for the standalone privacy page
- [CONTRIBUTING.md](CONTRIBUTING.md) for contribution workflow

## Support LinkHub

If LinkHub is useful to you and you want to support more polish, testing, and store-release work, you can do that here:

- [Buy Me a Coffee](https://www.buymeacoffee.com/SchulzOli)
