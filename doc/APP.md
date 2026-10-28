# Web app and device sync

Linkhaven comes in two forms that share one codebase:

- the **browser extension** (Chrome, Edge, Firefox) makes Linkhaven your new
  tab page
- the **web app** (PWA) installs on phones, tablets and computers from
  [schulzoli.github.io/Linkhaven/app/](https://schulzoli.github.io/Linkhaven/app/)

Both keep everything on the device and work offline. Each one stores its
own data; [device sync](#device-sync) keeps them in step.

## Web app (PWA)

Open the address above, then install it:

- **Android (Chrome):** menu → _Install app_
- **iPhone and iPad (Safari):** Share → _Add to Home Screen_
- **Windows, macOS, Linux (Chrome or Edge):** the install icon in the
  address bar

After the first visit a service worker keeps the app's files on the device,
so it opens without a network. It only answers for Linkhaven's own files;
everything else goes to the network as usual. A new version downloads in
the background and is used from the next start on.

Differences to the extension: the web app is not the new tab page, and the
Auto dashboard can't read browser history or top sites (only link opens on
your own cards).

### Build it yourself

```bash
npm run build:pwa   # into dist-pwa/, served from any folder over HTTPS
```

The [Docs and web app workflow](../.github/workflows/pages.yml) publishes it
to GitHub Pages under `app/` on every push to `main`. To run it from your
own server together with sync, feeds and charts, see
[SELF_HOSTING.md](SELF_HOSTING.md).

## Device sync

Device sync is off by default. Turn it on under **Menu → Privacy → Device
sync**, then set it up in the **Sync** tab. There are two ways:

### Through a Linkhaven server (no account)

On the first device choose **Create sync**. Linkhaven shows a **sync code**
(`lh2-…`) and a QR code under "Add a device"; enter it on each other device
with **Join**. Choose the server in the Sync tab: **Public server**, or
**Self-hosted** for your own (see [SELF_HOSTING.md](SELF_HOSTING.md)). A web
app opened from your own server uses it by itself (**This server**).
Everything is encrypted on the device; the server stores only data it
can't read.

**Devices** lists every device in the sync and when it last synced. Each
device has its own access, so you can **Remove** a lost or old one: it is
locked out at once, your data is re-encrypted with a new key it doesn't
have, and the sync gets a new code (the old one stops working). Your other
devices carry on by themselves.

Keep the code safe: whoever has it can add a device to your sync. If you
lose every device and the code, the data can't be recovered.

### Through your own WebDAV folder

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

A WebDAV folder holds `linkhaven-sync.json` (the salt and a check value, not
secret), `state.bin` (everything else, encrypted) and `images/` (one
encrypted file per image).

### In the extension

The extension asks for access to the sync server's or folder's address when you press
Connect, and gives it back when you disconnect. No server setup is needed.

### WebDAV in the web app: allow it on the server (CORS)

A web page may only talk to another server when that server allows it.
WebDAV servers don't by default, so the web app needs this once on the
server, for the origin `https://schulzoli.github.io`:

- **Nextcloud / ownCloud:** install the _WebAppPassword_ app and add
  `https://schulzoli.github.io` under Settings → Security → WebAppPassword
  → allowed origins.
- **Behind a reverse proxy** (nginx, Caddy, Traefik): answer `OPTIONS`
  requests and add these headers for that origin:

  ```
  Access-Control-Allow-Origin: https://schulzoli.github.io
  Access-Control-Allow-Methods: GET, PUT, DELETE, MKCOL, OPTIONS
  Access-Control-Allow-Headers: Authorization, Content-Type, If-Match, If-None-Match
  Access-Control-Expose-Headers: ETag
  ```

Without it, Connect reports that the server could not be reached.
