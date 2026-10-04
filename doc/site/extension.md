---
title: Browser extension
description: Build, load, package and publish the LinkHub extension.
order: 7
section: Develop
---

# Browser extension

The extension is the same app as the web build, packaged as a new-tab
override (Manifest V3). It requests no permissions and has no content
scripts.

## Build and load

```bash
npm run build:extension      # writes dist-extension/
```

- **Chrome / Edge:** open `chrome://extensions` or `edge://extensions`, turn
  on Developer mode, select **Load unpacked** and pick `dist-extension/`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, select **Load
  Temporary Add-on** and pick `dist-extension/manifest.json`.

## Package

```bash
npm run deploy:dry           # writes dist-extension.zip, files at the archive root
```

The ZIP is built in-process; no shell, PowerShell or `zip` binary is needed.

## Store screenshots

```bash
npx playwright test tests/e2e/screenshots.spec.ts --project=chromium
```

This regenerates the eight 1280×800 screenshots and the four promotional
tiles from the current app, with fixed demo data for charts and feeds.

## Publish

`npm run deploy` (or `deploy:chrome`, `deploy:edge`, `deploy:firefox`)
uploads the ZIP with the credentials in `chrome.env`, `edge.env` and
`firefox.env`, or from CI secrets. The full release guide, including the
one-time store setup, is in
[extension/EXTENSION.md](https://github.com/SchulzOli/LinkHub/blob/main/extension/EXTENSION.md).
Store copy and reviewer notes:
[extension/STORE_LISTING.md](https://github.com/SchulzOli/LinkHub/blob/main/extension/STORE_LISTING.md).
