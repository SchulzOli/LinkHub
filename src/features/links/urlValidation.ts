export function normalizeUrl(input: string) {
  const value = input.trim()

  if (!value) {
    return null
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)
    ? value
    : `https://${value}`

  try {
    const url = new URL(candidate)

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

export function createFaviconUrl(urlString: string) {
  const url = new URL(urlString)
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=128`
}
