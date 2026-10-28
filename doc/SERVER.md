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

There are no accounts. The first device creates a **sync code**: 32 random
bytes shown as `lh1-XXXX-…` (and as a QR code). Every device derives three
things from it with HKDF:

- the **vault id**, under which the server files the data
- an **access token**, which the server checks on every request (it stores
  only its SHA-256 hash)
- the **encryption key** (AES-GCM), which never leaves the device

The server only ever sees the vault id, the token and encrypted files. It
can't read workspaces, link addresses, titles or images, and it can't tell
who a vault belongs to. Without the code, the data can't be recovered.

Per vault the server keeps `vault.json` (token hash, file sizes, ETags,
created and last-used time) and the encrypted files. It writes no access
logs. Limits protect a public instance: 900 requests per 10 minutes and 20
new vaults per hour per IP address, plus the size limits above.

"Disconnect and delete server data" in the Sync tab deletes the vault for
all devices; each device keeps its own data.

### API

```
GET    /sync/v1/info
GET    /sync/v1/vaults/<vaultId>/files/<path>   → 200 + ETag | 404
PUT    /sync/v1/vaults/<vaultId>/files/<path>   If-Match / If-None-Match: *  → 201 | 204 | 412
DELETE /sync/v1/vaults/<vaultId>/files/<path>
DELETE /sync/v1/vaults/<vaultId>
Authorization: Bearer <access token>
```

The API is the same small subset of WebDAV the app already uses (GET, PUT,
DELETE with ETags), so one sync engine serves both.
