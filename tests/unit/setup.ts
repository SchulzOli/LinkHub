import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// Node >= 25 ships an experimental global `localStorage` that is undefined
// without `--localstorage-file` and shadows jsdom's implementation. Install
// an in-memory Storage so tests behave the same on every Node version.
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>()

  return {
    get length() {
      return entries.size
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => {
      entries.delete(key)
    },
    setItem: (key, value) => {
      entries.set(key, String(value))
    },
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  let usable = false
  try {
    usable = typeof window[name]?.clear === 'function'
  } catch {
    usable = false
  }

  if (!usable) {
    const storage = createMemoryStorage()
    Object.defineProperty(window, name, { configurable: true, value: storage })
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: storage,
    })
  }
}
