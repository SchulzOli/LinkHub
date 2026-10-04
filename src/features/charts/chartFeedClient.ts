import { getChartTransport, type ChartRange } from '../../contracts/chartNode'
import { createId } from '../../utils/id'

import {
  buildSseUrl,
  parseChartServerMessage,
  type ChartServerMessage,
  type ChartSubscribeMessage,
} from './chartFeedProtocol'

export type ChartFeedStatus = 'connecting' | 'open' | 'closed' | 'error'

export type ChartFeedRequest = {
  url: string
  symbol: string
  range: ChartRange
  live: boolean
}

export type ChartFeedHandlers = {
  onMessage: (message: ChartServerMessage) => void
  onStatus: (status: ChartFeedStatus) => void
}

type WebSocketSubscription = {
  request: ChartSubscribeMessage
  handlers: ChartFeedHandlers
}

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 15000
/** Keep an idle socket briefly so a re-subscribe (range change) reuses it. */
const IDLE_DISPOSE_MS = 3000

/**
 * One WebSocket per feed URL, shared by every chart on that feed. Each chart
 * subscribes with its own id; the socket reconnects with backoff and
 * re-sends all active subscriptions after reconnecting.
 */
class PooledWebSocket {
  private socket: WebSocket | null = null
  private readonly subscriptions = new Map<string, WebSocketSubscription>()
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false
  private readonly url: string
  private readonly onEmpty: () => void

  constructor(url: string, onEmpty: () => void) {
    this.url = url
    this.onEmpty = onEmpty
    this.connect()
  }

  private connect() {
    if (this.disposed) {
      return
    }

    this.broadcastStatus('connecting')

    let socket: WebSocket

    try {
      socket = new WebSocket(this.url)
    } catch {
      this.broadcastStatus('error')
      this.scheduleReconnect()
      return
    }

    this.socket = socket
    socket.addEventListener('open', () => {
      this.reconnectAttempt = 0
      this.broadcastStatus('open')

      for (const subscription of this.subscriptions.values()) {
        this.send(subscription.request)
      }
    })
    socket.addEventListener('message', (event) => {
      const message = parseChartServerMessage(event.data)

      if (!message) {
        return
      }

      if (message.id) {
        this.subscriptions.get(message.id)?.handlers.onMessage(message)
        return
      }

      // Messages without id go to every subscription on that symbol.
      for (const subscription of this.subscriptions.values()) {
        if (
          message.type === 'error' ||
          subscription.request.symbol === message.symbol
        ) {
          subscription.handlers.onMessage(message)
        }
      }
    })
    socket.addEventListener('error', () => {
      this.broadcastStatus('error')
    })
    socket.addEventListener('close', () => {
      if (this.socket === socket) {
        this.socket = null
      }

      if (!this.disposed) {
        this.broadcastStatus('closed')
        this.scheduleReconnect()
      }
    })
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer) {
      return
    }

    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
    )

    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  private broadcastStatus(status: ChartFeedStatus) {
    for (const subscription of this.subscriptions.values()) {
      subscription.handlers.onStatus(status)
    }
  }

  private send(message: object) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    }
  }

  get isOpen() {
    return this.socket?.readyState === WebSocket.OPEN
  }

  subscribe(
    request: Omit<ChartSubscribeMessage, 'type' | 'id'>,
    handlers: ChartFeedHandlers,
  ) {
    const id = createId()
    const message: ChartSubscribeMessage = { type: 'subscribe', id, ...request }

    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }

    this.subscriptions.set(id, { request: message, handlers })
    handlers.onStatus(this.isOpen ? 'open' : 'connecting')
    this.send(message)

    return () => {
      this.subscriptions.delete(id)
      this.send({ type: 'unsubscribe', id })

      if (this.subscriptions.size === 0 && !this.idleTimer) {
        this.idleTimer = setTimeout(() => {
          this.idleTimer = null

          if (this.subscriptions.size === 0) {
            this.dispose()
            this.onEmpty()
          }
        }, IDLE_DISPOSE_MS)
      }
    }
  }

  dispose() {
    this.disposed = true

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.socket?.close()
    this.socket = null
  }
}

const socketsByUrl = new Map<string, PooledWebSocket>()

function subscribeWebSocket(
  request: ChartFeedRequest,
  handlers: ChartFeedHandlers,
) {
  let pooled = socketsByUrl.get(request.url)

  if (!pooled) {
    pooled = new PooledWebSocket(request.url, () => {
      socketsByUrl.delete(request.url)
    })
    socketsByUrl.set(request.url, pooled)
  }

  return pooled.subscribe(
    { symbol: request.symbol, range: request.range, live: request.live },
    handlers,
  )
}

/** SSE: one EventSource per subscription; the browser handles reconnects. */
function subscribeSse(request: ChartFeedRequest, handlers: ChartFeedHandlers) {
  let source: EventSource

  try {
    source = new EventSource(buildSseUrl(request.url, request))
  } catch {
    handlers.onStatus('error')
    return () => undefined
  }

  handlers.onStatus('connecting')
  source.addEventListener('open', () => handlers.onStatus('open'))
  source.addEventListener('error', () => {
    handlers.onStatus(
      source.readyState === EventSource.CLOSED ? 'closed' : 'connecting',
    )
  })
  source.addEventListener('message', (event) => {
    const message = parseChartServerMessage(event.data)

    if (message) {
      handlers.onMessage(message)
    }
  })

  return () => source.close()
}

/** Subscribes to a feed; the transport follows the URL scheme. */
export function subscribeChartFeed(
  request: ChartFeedRequest,
  handlers: ChartFeedHandlers,
): () => void {
  const transport = getChartTransport(request.url)

  if (transport === 'websocket') {
    return subscribeWebSocket(request, handlers)
  }

  if (transport === 'sse') {
    return subscribeSse(request, handlers)
  }

  handlers.onMessage({
    type: 'error',
    message: 'Feed URL must start with ws://, wss://, http:// or https://',
  })
  handlers.onStatus('error')

  return () => undefined
}
