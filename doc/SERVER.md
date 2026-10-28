# Linkhaven server

One small Node.js server for every optional service Linkhaven can use. Each
part can be switched off, and it runs the same on your own computer, a NAS
or a public host.

| Path                       | Service                                                         |
| -------------------------- | --------------------------------------------------------------- |
| `/sync/v1/…`               | Device sync: stores end-to-end encrypted vaults                 |
| `/rss`                     | News feed proxy (RSS/Atom feeds without CORS), see NEWS_FEED.md |
| `/feed`, `/sse`, `/search` | Chart feed (live market data), see CHART_FEED.md                |
| `/health`                  | Which services are on                                           |

## Run it locally

```bash
npm run server          # http://127.0.0.1:8790, data in ./data
```

In Linkhaven: Menu → Privacy → **Device sync** on, then in the **Sync** tab
enter `http://127.0.0.1:8790` as the server address. News feed and chart
nodes can point at the same server (`http://127.0.0.1:8790/rss`,
`ws://127.0.0.1:8790/feed`).

The separate `npm run feed:news` and `npm run feed:charts` scripts still
work as before.

## Run the public instance

Requirements: a small Linux server (e.g. 1 vCPU, 1 GB RAM), Docker with the
Compose plugin, and a domain name whose DNS points at the server (an `A`
record such as `sync.example.com`).

```bash
git clone https://github.com/SchulzOli/Linkhaven.git
cd Linkhaven
LINKHAVEN_DOMAIN=sync.example.com docker compose -f server/docker-compose.yml up -d --build
```

[Caddy](https://caddyserver.com) gets and renews the HTTPS certificate
automatically. The public setup runs **sync only**; set `NEWS_PROXY=on`
and/or `CHARTS=on` to offer those too (every user's feeds and charts then
go through your server).

Updates: `git pull` and the same `docker compose … up -d --build` again.
Vaults live in the `linkhaven-data` Docker volume; back it up like any
volume. Everything in it is encrypted, so a backup holds nothing readable.

### Make it the app's default

Set the repository variable **SYNC_SERVER_URL** (Settings → Secrets and
variables → Actions → Variables) to `https://sync.example.com`. The web app
and the next extension release then offer it in the Sync tab; users can
still enter another server.

## Configuration

| Variable                    | Default          | Meaning                                                        |
| --------------------------- | ---------------- | -------------------------------------------------------------- |
| `PORT` / `HOST`             | 8790 / 127.0.0.1 | Where to listen (the Docker image uses 0.0.0.0)                |
| `SYNC`                      | on               | Device sync API                                                |
| `SYNC_DATA_DIR`             | ./data           | Where vaults are stored                                        |
| `SYNC_MAX_VAULT_MB`         | 100              | Space per vault (all devices of one sync together)             |
| `SYNC_MAX_FILE_MB`          | 25               | Largest single file (one image)                                |
| `SYNC_IDLE_DAYS`            | 365              | Delete vaults no device used for this long (0 = never)         |
| `NEWS_PROXY` / `CHARTS`     | on               | The other services (the Compose file turns them off)           |
| `LINKHAVEN_ALLOWED_ORIGINS` | –                | Extra web app origins, comma-separated                         |
| `TRUST_PROXY`               | off              | Read the client IP from `X-Forwarded-For` (behind Caddy/nginx) |

Browsers may only use the server from Linkhaven itself: the extension, the
web app on `https://schulzoli.github.io` and pages on localhost. Add your own
web app address with `LINKHAVEN_ALLOWED_ORIGINS`.

## How sync works

There are no accounts. Everything is encrypted on the devices; the server
stores files it can't read and tokens it only knows as SHA-256 hashes.

**Creating and joining.** The first device creates a **sync code**
(`lh2-XXXX-…`, also shown as a QR code): the vault id plus a random join
secret. From the join secret, HKDF derives a **join token** and a **join
key**. The join token lets a device register with the server and read one
file, the join keyring, and nothing else. The join key opens that keyring,
which holds the data keys.

**Every device has its own access.** A joining device makes its own random
**device token** and its own **ECDH key pair** (P-256; the private key
can't be exported). It registers both with the server, together with its
name encrypted with a shared label key. From then on it uses its device
token, and its keyring on the server is sealed to its own public key, so
only that device can open it.

**Data keys have epochs.** Files are encrypted with AES-GCM under the
current data key, and every file names its epoch.

**Removing a device** (Sync tab → Devices → Remove), done on any other
device:

1. The server deletes the device's token and keyring: from then on it gets
   403 for everything.
2. A new data key (epoch + 1) and a new join secret, so a **new sync code**,
   are made and sealed to each remaining device's public key. The old code
   stops working.
3. The state and every image are re-encrypted with the new key.

The removed device keeps its own local copy, but it can't reach the vault,
can't rejoin with the old code, and even with a copy of the server's files
its old key opens nothing written after the removal. The other devices pick
up the new key and code on their next sync.

**What the server keeps** per vault in `vault.json`: the hashes of the join
token and of each device token, each device's public key, encrypted name,
and created and last-seen time (to the hour), and the size and ETag of each
encrypted file. It writes no access logs. Limits protect a public instance:
900 requests per 10 minutes and 20 new syncs per hour per IP address, at
most 20 devices per sync, plus the size limits above.

"Disconnect" removes only this device from the sync. "Disconnect and delete
server data" deletes the vault for all devices; each device keeps its own
data.

### API

```
GET    /sync/v1/info
POST   /sync/v1/vaults/<vaultId>/devices             join token: add a device ({ create } for a new sync)
GET    /sync/v1/vaults/<vaultId>/devices             the device list
DELETE /sync/v1/vaults/<vaultId>/devices/<deviceId>  remove a device
PUT    /sync/v1/vaults/<vaultId>/join-token          the new code's join token
GET    /sync/v1/vaults/<vaultId>/files/<path>        → 200 + ETag | 404
PUT    /sync/v1/vaults/<vaultId>/files/<path>        If-Match / If-None-Match: *  → 201 | 204 | 412
DELETE /sync/v1/vaults/<vaultId>/files/<path>
DELETE /sync/v1/vaults/<vaultId>
Authorization: Bearer <device token | join token>
```

The file routes are the same small subset of WebDAV the app already uses
(GET, PUT, DELETE with ETags), so one sync engine serves both.
