/**
 * A fixed-window counter per key (an IP address): at most `max` hits per
 * `windowMs`. Old windows are dropped as they expire, so memory stays
 * bounded by the number of active clients.
 */
export function createRateLimiter({ max, windowMs, now = () => Date.now() }) {
  const windows = new Map()
  let lastSweep = now()

  const sweep = (time) => {
    if (time - lastSweep < windowMs) {
      return
    }

    lastSweep = time

    for (const [key, entry] of windows) {
      if (entry.until <= time) {
        windows.delete(key)
      }
    }
  }

  return {
    /** Counts a hit; false once the key is over its limit. */
    take(key) {
      const time = now()

      sweep(time)

      const entry = windows.get(key)

      if (!entry || entry.until <= time) {
        windows.set(key, { count: 1, until: time + windowMs })
        return true
      }

      entry.count += 1

      return entry.count <= max
    },
  }
}
