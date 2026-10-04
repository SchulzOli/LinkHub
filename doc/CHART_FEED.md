# Chart nodes and the chart feed

Chart nodes plot an external time series, for example a stock price. The data
comes from a feed server over **WebSocket** or **Server-Sent Events (SSE)**.
LinkHub ships a reference server that streams real market data.

## Quick start

```bash
npm run feed:charts      # ws://127.0.0.1:8787/feed and http://127.0.0.1:8787/sse
npm run dev
```

In the taskbar, select **Add chart**. A new chart uses the symbol `AAPL` and
the URL `ws://127.0.0.1:8787/feed`. To change them, open the chart options
(slider icon) and go to **Data source**.

## Interactions

| Kind    | Options                                                  |
| ------- | -------------------------------------------------------- |
| Range   | 1D, 5D, 1M, 6M, YTD, 1Y, 3Y, 5Y, Max (longest available) |
| Values  | Price, % change over the range                           |
| Style   | Area, Line                                               |
| Average | Off, SMA 20, SMA 50, SMA 200                             |
| Scale   | Linear, Log (linear in % mode)                           |
| Live    | On, Paused                                               |
| Actions | Reload, Export CSV, Follow group (charts inside a group) |

## Groups

A group detects the charts inside its body. The group header then shows a
chart button with the number of charts. The group panel sets every
interaction for all member charts.

Settings cascade in this order:

1. Defaults.
2. The outermost group, then each nested group down to the innermost group.
3. The chart itself.

Each level stores only the keys that you set on that level. This gives the
following behaviour:

- When you change a value on one chart, only that chart changes. The chart
  shows an **Own value ×** badge. Select the badge to follow the group again.
- When you then change the same key on the group, the other charts follow.
  The chart with its own value keeps it.
- The group shows how many charts keep their own value, for example
  **1 own · apply to all**. Select the badge to apply the group value to
  those charts too.
- **Reset all to group** clears every own value of the member charts in one
  undo step. **Reload all** reconnects every member chart.

The cascade is implemented in `src/features/charts/chartInheritance.ts`.

## Protocol (v1)

All messages are JSON. A point is `[epochMillis, value]`. The transport
follows the URL scheme: `ws://` and `wss://` use WebSocket, `http://` and
`https://` use SSE.

### WebSocket

One socket per feed URL is shared by all charts on that feed. Each chart
subscribes with its own `id`.

Client to server:

```json
{ "type": "subscribe", "id": "c1", "symbol": "AAPL", "range": "1Y", "live": true }
{ "type": "unsubscribe", "id": "c1" }
```

Server to client:

```json
{ "type": "snapshot", "id": "c1", "symbol": "AAPL", "range": "1Y",
  "currency": "USD", "name": "Apple Inc.", "points": [[1696291200000, 173.75]] }
{ "type": "tick", "id": "c1", "symbol": "AAPL", "point": [1790971201000, 333.69] }
{ "type": "error", "id": "c1", "message": "AAPL: No data for this symbol" }
```

The client behaves as follows:

- After a disconnect, it reconnects with exponential backoff (1 s to 15 s) and
  sends all active subscriptions again.
- An idle socket stays open for 3 s, so a range change reuses it.

### Server-Sent Events

The client sends a `GET` request:

```
GET <url>?symbol=AAPL&range=1Y&live=1
```

Each `data:` line carries one of the server messages above. Every chart opens
its own stream. The `id` field is optional. A snapshot replaces the series, and
a tick appends a point to it. A tick with the same timestamp replaces the last
point.

## Reference server

The reference server is `server/chart-feed/`. It uses Node and the `ws`
package.

- **Source:** the public Yahoo Finance chart API, which needs no API key. The
  server fetches the data, so browser CORS rules do not apply.
- **Snapshots:** cached for 60 s per symbol and range.
- **Live updates:** the server checks the latest price of each watched symbol
  every 15 s (`LIVE_POLL_MS`). It sends a tick when the price changes.
- **Ranges:** Yahoo has no `3y` keyword, so 3Y uses `period1` and `period2`.
- **Configuration:** set `PORT` and `HOST` to change the address. The default
  is `127.0.0.1:8787`.

To use another data provider, implement the same message format.
