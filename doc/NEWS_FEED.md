# News feed nodes

A feed node shows the articles of one or more RSS or Atom feeds as one list.
Each article opens in a new browser tab.

## Quick start

```bash
npm run feed:news        # proxy on http://127.0.0.1:8788/rss?url=…
npm run dev
```

1. In the taskbar, select **Add news feed**.
2. Paste a feed URL into the node, for example
   `https://www.tagesschau.de/xml/rss2/`, and select **Add feed**.
3. To add more feeds, open the feed options (slider icon) and go to **Feeds**.

You can also enter a web page URL. If the page links to its feed
(`<link rel="alternate" type="application/rss+xml">`), the node uses that
feed. If the page has no such link, the node shows an error. Then enter the
RSS or Atom URL.

## In the node

| Control         | Function                                                                             |
| --------------- | ------------------------------------------------------------------------------------ |
| Filter articles | Shows articles that contain all typed words in the title, summary, author or source. |
| Sort            | Newest first, oldest first, by source, title A–Z.                                    |
| Time window     | Any time, last 24 h, 3 days, 7 days, 30 days.                                        |
| Source chips    | Hide or show one feed (only when a node has more than one feed).                     |
| Reload          | Fetches all feeds again.                                                             |

Articles without a date go last when you sort by date. The time window hides
them. The same article (same link) from two feeds is shown once.

## Options

- **Feeds**: add or remove feeds (12 at most). A green dot means the feed
  loaded; a red dot means it failed (hover to see the reason).
- **Display**: sort, time window, summaries, images, auto refresh (off, 5, 15,
  30 or 60 minutes).
- **Node**: title (default: the feed title, or "News" for more than one feed)
  and the feed proxy URL.

The sort, time window, display settings and hidden sources are saved with
the node. The text filter is not saved.

## The feed proxy

Most news sites do not send CORS headers, so a browser page cannot read
their feeds. The proxy (`server/news-feed/`) fetches a feed and returns it
unchanged with `access-control-allow-origin: *`. LinkHub parses the XML in
the browser.

```
GET /rss?url=<feed url>   → feed body with the original content type
GET /health               → {"ok": true}
```

Errors are JSON: `{"error": "…"}` with status 400 (invalid URL), 403
(blocked address), 413 (too large), 502 (upstream error) or 504 (timeout).

Limits of the proxy:

- Only `http://` and `https://` URLs.
- Private, loopback and link-local addresses are blocked, also after
  redirects. Set `FEED_ALLOW_PRIVATE=1` to allow feeds on your own network.
- At most 5 redirects, 15 s timeout, 5 MB per feed.
- Responses are cached for 60 s.

| Variable             | Default     |
| -------------------- | ----------- |
| `PORT`               | `8788`      |
| `HOST`               | `127.0.0.1` |
| `FEED_TIMEOUT_MS`    | `15000`     |
| `FEED_MAX_BYTES`     | `5242880`   |
| `FEED_CACHE_MS`      | `60000`     |
| `FEED_ALLOW_PRIVATE` | not set     |

A feed that sends CORS headers works without the proxy. To fetch it
directly, clear **Feed proxy** in the node options.

## Security

- Only `http(s)` article links and image URLs are kept. Other schemes, such
  as `javascript:`, are removed.
- Summaries are shown as plain text. Scripts and HTML from the feed are not
  rendered.
- Article links open with `rel="noopener noreferrer"`. Images load with
  `referrerpolicy="no-referrer"`.
