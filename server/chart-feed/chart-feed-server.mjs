#!/usr/bin/env node
/**
 * LinkHub chart feed server.
 *
 * Streams real market data to LinkHub chart nodes using the LinkHub chart
 * feed protocol (doc/CHART_FEED.md) over both transports:
 *   WebSocket  ws://127.0.0.1:8787/feed
 *   SSE        http://127.0.0.1:8787/sse?symbol=AAPL&range=1Y&live=1
 *
 *   npm run feed:charts            (PORT / HOST env vars override defaults)
 */
import { createServer } from 'node:http'

import { WebSocketServer } from 'ws'

import { fetchSeries, isValidSymbol, SUPPORTED_RANGES } from './yahooSource.mjs'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '127.0.0.1'
const LIVE_POLL_MS = Number(process.env.LIVE_POLL_MS ?? 15000)
const SNAPSHOT_CACHE_MS = 60000

const snapshotCache = new Map()

async function getSnapshot(symbol, range) {
  const key = `${symbol}:${range}`
  const cached = snapshotCache.get(key)

  if (cached && Date.now() - cached.at < SNAPSHOT_CACHE_MS) {
    return cached.value
  }

  const value = await fetchSeries(symbol, range)

  snapshotCache.set(key, { at: Date.now(), value })

  return value
}

/**
 * One poller per symbol while anyone listens live. Emits a tick whenever the
 * latest regular-market price/time changes.
 */
const livePollers = new Map()

function addLiveListener(symbol, listener) {
  let poller = livePollers.get(symbol)

  if (!poller) {
    poller = { listeners: new Set(), last: null, timer: null }
    livePollers.set(symbol, poller)

    const poll = async () => {
      try {
        const { latest } = await fetchSeries(symbol, '1D')

        if (
          latest &&
          (!poller.last ||
            latest[0] !== poller.last[0] ||
            latest[1] !== poller.last[1])
        ) {
          poller.last = latest

          for (const notify of poller.listeners) {
            notify(latest)
          }
        }
      } catch (error) {
        console.warn(`[feed] live poll ${symbol}: ${error.message}`)
      }
    }

    poller.timer = setInterval(poll, LIVE_POLL_MS)
    void poll()
  }

  poller.listeners.add(listener)

  return () => {
    poller.listeners.delete(listener)

    if (poller.listeners.size === 0) {
      clearInterval(poller.timer)
      livePollers.delete(symbol)
    }
  }
}

function validateRequest(symbol, range) {
  if (!isValidSymbol(symbol)) {
    return 'Invalid symbol'
  }

  if (!SUPPORTED_RANGES.includes(range)) {
    return `Unsupported range. Use one of ${SUPPORTED_RANGES.join(', ')}`
  }

  return null
}

/** Sends snapshot, then ticks while live. Returns a stop function. */
function startStream({ symbol, range, live, send }) {
  let stopped = false
  let stopLive = () => undefined

  getSnapshot(symbol, range)
    .then((snapshot) => {
      if (stopped) {
        return
      }

      send({
        type: 'snapshot',
        symbol,
        range,
        points: snapshot.points,
        currency: snapshot.currency,
        name: snapshot.name,
      })

      if (live) {
        stopLive = addLiveListener(symbol, (point) => {
          if (!stopped) {
            send({ type: 'tick', symbol, point })
          }
        })
      }
    })
    .catch((error) => {
      if (!stopped) {
        send({ type: 'error', message: `${symbol}: ${error.message}` })
      }
    })

  return () => {
    stopped = true
    stopLive()
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

  response.setHeader('access-control-allow-origin', '*')

  if (url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ ok: true, ranges: SUPPORTED_RANGES }))
    return
  }

  if (url.pathname !== '/sse') {
    response.writeHead(404, { 'content-type': 'text/plain' })
    response.end('Use /sse?symbol=…&range=… or a WebSocket on /feed')
    return
  }

  const symbol = url.searchParams.get('symbol')?.trim().toUpperCase() ?? ''
  const range = url.searchParams.get('range') ?? '1Y'
  const live = url.searchParams.get('live') !== '0'

  response.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })

  const send = (message) => {
    response.write(`data: ${JSON.stringify(message)}\n\n`)
  }
  const invalid = validateRequest(symbol, range)

  if (invalid) {
    send({ type: 'error', message: invalid })
    response.end()
    return
  }

  const stop = startStream({ symbol, range, live, send })
  const keepAlive = setInterval(() => response.write(': ping\n\n'), 25000)

  request.on('close', () => {
    clearInterval(keepAlive)
    stop()
  })
})

const wss = new WebSocketServer({ server, path: '/feed' })

wss.on('connection', (socket) => {
  const streams = new Map()

  const sendFor = (id) => (message) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify({ ...message, id }))
    }
  }

  socket.on('message', (raw) => {
    let message

    try {
      message = JSON.parse(String(raw))
    } catch {
      return
    }

    if (message?.type === 'unsubscribe' && typeof message.id === 'string') {
      streams.get(message.id)?.()
      streams.delete(message.id)
      return
    }

    if (message?.type !== 'subscribe' || typeof message.id !== 'string') {
      return
    }

    const symbol = String(message.symbol ?? '')
      .trim()
      .toUpperCase()
    const range = String(message.range ?? '1Y')
    const send = sendFor(message.id)
    const invalid = validateRequest(symbol, range)

    streams.get(message.id)?.()

    if (invalid) {
      send({ type: 'error', message: invalid })
      return
    }

    streams.set(
      message.id,
      startStream({ symbol, range, live: message.live !== false, send }),
    )
  })

  socket.on('close', () => {
    for (const stop of streams.values()) {
      stop()
    }

    streams.clear()
  })
})

server.listen(PORT, HOST, () => {
  console.log(`LinkHub chart feed on ws://${HOST}:${PORT}/feed`)
  console.log(`                  and http://${HOST}:${PORT}/sse`)
})
