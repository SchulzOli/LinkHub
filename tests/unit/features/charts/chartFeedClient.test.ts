import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { subscribeChartFeed } from '../../../../src/features/charts/chartFeedClient'
import type { ChartServerMessage } from '../../../../src/features/charts/chartFeedProtocol'

type Listener = (event: { data?: unknown }) => void

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []

  readonly url: string
  readyState = FakeWebSocket.CONNECTING
  sent: Array<Record<string, unknown>> = []
  private listeners = new Map<string, Listener[]>()

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
  }

  emit(type: string, event: { data?: unknown } = {}) {
    if (type === 'open') {
      this.readyState = FakeWebSocket.OPEN
    }

    if (type === 'close') {
      this.readyState = FakeWebSocket.CLOSED
    }

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
}

function handlers() {
  const messages: ChartServerMessage[] = []
  const statuses: string[] = []

  return {
    messages,
    statuses,
    onMessage: (message: ChartServerMessage) => messages.push(message),
    onStatus: (status: string) => statuses.push(status),
  }
}

describe('chart feed client (WebSocket)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shares one socket per URL and routes messages by subscription id', () => {
    const first = handlers()
    const second = handlers()
    const url = 'ws://feed.test/feed'
    const stopFirst = subscribeChartFeed(
      { url, symbol: 'AAPL', range: '1Y', live: true },
      first,
    )

    subscribeChartFeed(
      { url, symbol: 'MSFT', range: '1D', live: false },
      second,
    )

    expect(FakeWebSocket.instances).toHaveLength(1)

    const socket = FakeWebSocket.instances[0]

    socket.emit('open')

    const subscribes = socket.sent.filter(
      (message) => message.type === 'subscribe',
    )

    expect(subscribes.map((message) => message.symbol)).toEqual([
      'AAPL',
      'MSFT',
    ])
    expect(subscribes[1]).toMatchObject({ range: '1D', live: false })

    socket.emit('message', {
      data: JSON.stringify({
        type: 'tick',
        id: subscribes[0].id,
        symbol: 'AAPL',
        point: [1, 2],
      }),
    })

    expect(first.messages).toHaveLength(1)
    expect(second.messages).toHaveLength(0)

    stopFirst()

    expect(socket.sent.at(-1)).toEqual({
      type: 'unsubscribe',
      id: subscribes[0].id,
    })
  })

  it('reconnects with backoff and re-sends active subscriptions', () => {
    const sub = handlers()

    subscribeChartFeed(
      { url: 'ws://feed.test/re', symbol: 'AAPL', range: '5Y', live: true },
      sub,
    )
    FakeWebSocket.instances[0].emit('open')
    FakeWebSocket.instances[0].emit('close')

    expect(sub.statuses).toContain('closed')

    vi.advanceTimersByTime(1000)

    const reconnected = FakeWebSocket.instances[1]

    expect(reconnected).toBeDefined()

    reconnected.emit('open')

    expect(reconnected.sent).toEqual([
      expect.objectContaining({
        type: 'subscribe',
        symbol: 'AAPL',
        range: '5Y',
      }),
    ])
  })

  it('closes an idle socket after a grace period, reusing it before that', () => {
    const url = 'ws://feed.test/idle'
    const stop = subscribeChartFeed(
      { url, symbol: 'AAPL', range: '1Y', live: true },
      handlers(),
    )

    FakeWebSocket.instances[0].emit('open')
    stop()
    // A quick re-subscribe (e.g. range change) reuses the socket.
    const stopAgain = subscribeChartFeed(
      { url, symbol: 'AAPL', range: '1D', live: true },
      handlers(),
    )

    expect(FakeWebSocket.instances).toHaveLength(1)

    stopAgain()
    vi.advanceTimersByTime(3000)

    expect(FakeWebSocket.instances[0].readyState).toBe(FakeWebSocket.CLOSED)
  })

  it('rejects unsupported URL schemes', () => {
    const sub = handlers()

    subscribeChartFeed(
      { url: 'ftp://x', symbol: 'A', range: '1Y', live: true },
      sub,
    )

    expect(sub.messages[0]).toMatchObject({ type: 'error' })
    expect(sub.statuses).toEqual(['error'])
  })
})

describe('chart feed client (SSE)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens one EventSource with query parameters and parses messages', () => {
    const sources: Array<{
      url: string
      listeners: Map<string, Listener>
      closed: boolean
    }> = []

    class FakeEventSource {
      static readonly CLOSED = 2
      readyState = 1
      listeners = new Map<string, Listener>()
      closed = false
      url: string

      constructor(url: string) {
        this.url = url
        sources.push(this)
      }

      addEventListener(type: string, listener: Listener) {
        this.listeners.set(type, listener)
      }

      close() {
        this.closed = true
      }
    }

    vi.stubGlobal('EventSource', FakeEventSource)

    const sub = handlers()
    const stop = subscribeChartFeed(
      { url: 'https://feed.test/sse', symbol: 'AAPL', range: '3Y', live: true },
      sub,
    )

    expect(sources[0].url).toBe(
      'https://feed.test/sse?symbol=AAPL&range=3Y&live=1',
    )

    sources[0].listeners.get('message')?.({
      data: JSON.stringify({
        type: 'snapshot',
        symbol: 'AAPL',
        range: '3Y',
        points: [[1, 2]],
      }),
    })

    expect(sub.messages[0]).toMatchObject({
      type: 'snapshot',
      points: [[1, 2]],
    })

    stop()

    expect(sources[0].closed).toBe(true)
  })
})
