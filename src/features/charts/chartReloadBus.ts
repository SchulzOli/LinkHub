/**
 * Fire-and-forget "reload these charts" signal, so a group action can
 * reconnect all member charts without lifting feed state into the store.
 */
const target = new EventTarget()
const EVENT = 'linkhub:chart-reload'

export function requestChartReload(chartIds: string[]) {
  target.dispatchEvent(new CustomEvent(EVENT, { detail: chartIds }))
}

export function onChartReload(chartId: string, listener: () => void) {
  const handler = (event: Event) => {
    const ids = (event as CustomEvent<string[]>).detail

    if (ids.includes(chartId)) {
      listener()
    }
  }

  target.addEventListener(EVENT, handler)

  return () => target.removeEventListener(EVENT, handler)
}
