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
STORE_SCREENSHOTS=1 npx playwright test tests/e2e/screenshots.spec.ts --project=chromium
```

This regenerates the eight 1280×800 screenshots and the four promotional
tiles from the current app, with fixed demo data for charts and feeds (link cards load the real site favicons).

## Publish

Releases run in one manual workflow: **Actions → Release → Run workflow**.
Enter the new version (`X.Y.Z`, higher than both the latest
`v*` tag and the version in `package.json` on `main`) and pick
the stores. The workflow sets the version, builds, pushes tag `vX.Y.Z` (main
itself is not changed),
creates the GitHub Release, and then publishes the same build to each selected
store in parallel. A failed store can be retried with **Re-run failed jobs**.

Locally, `npm run deploy` (or `deploy:chrome`, `deploy:edge`, `deploy:firefox`)
uploads the ZIP with the credentials in `chrome.env`, `edge.env` and
`firefox.env`. The full release guide, including the one-time store setup and
the required secrets, is in
[extension/EXTENSION.md](https://github.com/SchulzOli/LinkHub/blob/main/extension/EXTENSION.md).
Store copy and reviewer notes:
[extension/STORE_LISTING.md](https://github.com/SchulzOli/LinkHub/blob/main/extension/STORE_LISTING.md).
