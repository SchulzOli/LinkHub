# Self-hosting

Run all of Linkhaven on your own server: the web app, device sync, the news
feed proxy and live charts, in one Docker container. Nothing goes through
GitHub or the public sync server, and there are no accounts to manage.

When you open the web app from your own server, it uses that server by
itself: the Sync tab offers **This server**, and new news feeds and charts
go through it. The browser extension and the public web app can use it
too: choose **Self-hosted** in the Sync tab and enter its address.

## What you need

- A computer that stays on: a NAS, a home server, a Raspberry Pi 4/5 or a
  small VPS. 512 MB RAM is enough.
- Docker with the Compose plugin.
- For phones and other devices: an **HTTPS** address. Browsers only allow
  encryption, offline mode and installing the app on secure pages, so
  `http://192.168.…` works for nothing but a look. Pick one of the setups
  below.

## With a domain (recommended)

Point a DNS name at the server (an `A` record such as `links.example.com`)
and open ports 80 and 443. Then:

```bash
git clone https://github.com/SchulzOli/Linkhaven.git
cd Linkhaven
printf 'LINKHAVEN_DOMAIN=links.example.com\nSELF_HOSTED=on\n' > server/.env
docker compose -f server/docker-compose.yml up -d --build
```

`server/.env` keeps your settings for later updates; any variable from the
table below can go there too.

[Caddy](https://caddyserver.com) gets and renews the certificate. Open
`https://links.example.com`, install the app (see
[Web app and sync](APP.md)), and turn on **Device sync** under Menu →
Privacy. That's it.

## At home, without a domain

```bash
docker compose -f server/docker-compose.local.yml up -d --build
```

This starts everything on port 8790. On the same computer,
`http://localhost:8790` works as is. For your other devices, give it HTTPS
one of these ways:

- **Tailscale** (no open ports): install Tailscale on the server and your
  devices, then `tailscale serve --bg 8790`. The app is at
  `https://<server>.<tailnet>.ts.net` on every device in your tailnet.
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:8790`
  or a named tunnel to your own domain.
- **Your reverse proxy** (nginx, Traefik, Caddy, Nginx Proxy Manager):
  forward a host name to port 8790 and keep the `Host` header (the
  default). Set `TRUST_PROXY=on` so rate limits see the real addresses.
  For the chart feed, allow WebSocket upgrades on `/feed`.

## Without Docker

With Node.js 22 or later:

```bash
npm install
npm run selfhost        # builds the web app, then serves it on :8790
```

`HOST=0.0.0.0 npm run selfhost` makes it reachable from other devices
(behind HTTPS as above).

## Settings

The full list is in [SERVER.md](SERVER.md#configuration). The ones that
matter at home:

| Variable                    | Default (local file) | Meaning                                          |
| --------------------------- | -------------------- | ------------------------------------------------ |
| `LINKHAVEN_PORT`            | 8790                 | Port on the host (`docker-compose.local.yml`)    |
| `WEB_APP`                   | on                   | Serve the web app                                |
| `NEWS_PROXY` / `CHARTS`     | on                   | News feed proxy and chart feed                   |
| `SYNC_IDLE_DAYS`            | 0 (never)            | Delete syncs no device used for this many days   |
| `LINKHAVEN_ALLOWED_ORIGINS` | –                    | Other web app addresses that may use this server |

## Updates and backups

```bash
git pull
docker compose -f server/docker-compose.yml up -d --build   # or .local.yml
```

Synced data lives in the `linkhaven-data` Docker volume. It is encrypted
on the devices, so a backup of the volume holds nothing readable; to
restore, the devices only need their sync code. Each device also keeps
its own full copy, and Menu → Data → Export saves a bundle any time.
