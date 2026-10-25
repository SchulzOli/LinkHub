# Linkhaven app (Tauri)

Besides the browser extension, Linkhaven ships as a native app for
Windows, macOS, Linux, Android and iOS, built with [Tauri 2](https://tauri.app).
It is the same web app in the system web view; data stays on the device
like in the extension, and [device sync](#device-sync) connects the two.

The extension stays the way to get Linkhaven as the browser's new tab.
The app is for phones and for using Linkhaven as its own window.

## What is different in the app

- Links open in the system's default browser; the app window never
  navigates away from Linkhaven.
- Device sync uses Tauri's HTTP plugin, so a WebDAV server needs no CORS
  setup.
- Browser data for the Auto dashboard (history, top sites) only exists in
  the extension. In the app, the Auto dashboard uses link opens on your
  own cards.

## Desktop

Requirements: Node.js 22, Rust (stable, via [rustup](https://rustup.rs)) and
the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your
system (on Linux: `libwebkit2gtk-4.1-dev librsvg2-dev
libayatana-appindicator3-dev`).

```bash
npm ci
npm run app:dev     # app window with hot reload
npm run app:build   # installers in src-tauri/target/release/bundle/
```

The [Desktop app workflow](../.github/workflows/app.yml) builds installers
for all three systems on demand and for tags like `app-v1.2.0`. They are
unsigned: Windows SmartScreen and macOS Gatekeeper warn until signing is set
up ([Windows](https://tauri.app/distribute/sign/windows/),
[macOS](https://tauri.app/distribute/sign/macos/)).

## Android and iOS

The mobile projects are generated once on a machine with the platform SDKs
and then committed:

```bash
# Android: Android Studio with SDK, NDK and a JDK 17
npx tauri android init
npx tauri android dev      # emulator or a connected phone
npx tauri android build    # APK/AAB in src-tauri/gen/android/app/build/outputs/

# iOS: a Mac with Xcode
npx tauri ios init
npx tauri ios dev
npx tauri ios build
```

Store releases need a Google Play developer account and an Apple Developer
Program membership; see Tauri's guides for
[Google Play](https://tauri.app/distribute/google-play/) and the
[App Store](https://tauri.app/distribute/app-store/).

The app icons for every platform come from `src-tauri/app-icon.svg`:

```bash
npx tauri icon src-tauri/app-icon.svg -o src-tauri/icons
```

## Device sync

Device sync is off by default. Turn it on under **Menu → Privacy → Device
sync**, then set it up in the **Sync** tab with:

- **WebDAV folder address**: a folder you own. In Nextcloud: Files →
  Settings (bottom left) → WebDAV shows the address; add a folder name such
  as `Linkhaven/` at the end. A NAS, ownCloud, or any other WebDAV server
  works the same way.
- **User name and app password**: create an app password for Linkhaven
  (Nextcloud: Settings → Security → Devices & sessions) instead of using
  your main password.
- **Sync passphrase**: encrypts everything on the device before upload
  (AES-GCM; the key is derived with PBKDF2-SHA-256, 600,000 rounds). Use
  the same passphrase on every device. It is never stored or uploaded and
  can't be recovered.

What syncs: workspaces, their order, custom themes and uploaded images.
What stays on each device: the view position, usage statistics, the Auto
dashboard, and all settings in Menu → Privacy.

Linkhaven syncs when it opens or comes back to the front, a few seconds
after a change, and every five minutes while it is open. When two devices
change the same workspace before syncing, the newer change wins and the
other one is kept as a workspace named "… (conflict)".

The folder holds `linkhaven-sync.json` (the salt and a check value, not
secret), `state.bin` (everything else, encrypted) and `images/` (one
encrypted file per image).

### In the browser extension

The extension asks for access to the sync server's address when you press
Connect, and gives it back when you disconnect.

### In a plain browser tab

Opened as a website (for example `npm run dev`), the browser only lets
Linkhaven reach a WebDAV server that allows it (CORS). Nextcloud doesn't by
default; use the extension or the app there.
