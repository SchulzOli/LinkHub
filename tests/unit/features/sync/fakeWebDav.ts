/** An in-memory WebDAV server, answering like Nextcloud does. */
export function createFakeWebDav(root = 'https://dav.example.test/me/') {
  const files = new Map<string, { data: Uint8Array; etag: string }>()
  const folders = new Set<string>()
  let revision = 0
  const requests: Array<{ method: string; path: string }> = []

  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const path = url.pathname
    const method = init.method ?? 'GET'
    const headers = new Headers(init.headers)

    requests.push({ method, path })

    if (headers.get('Authorization') !== `Basic ${btoa('me:secret')}`) {
      return new Response(null, { status: 401 })
    }

    const file = files.get(path)

    if (method === 'GET') {
      return file
        ? new Response(file.data as BodyInit, {
            status: 200,
            headers: { ETag: file.etag },
          })
        : new Response(null, { status: 404 })
    }

    if (method === 'PUT') {
      const ifMatch = headers.get('If-Match')
      const ifNoneMatch = headers.get('If-None-Match')

      if ((ifMatch && file?.etag !== ifMatch) || (ifNoneMatch && file)) {
        return new Response(null, { status: 412 })
      }

      revision += 1
      files.set(path, {
        data: new Uint8Array(
          await new Response(init.body as BodyInit).arrayBuffer(),
        ),
        etag: `"${revision}"`,
      })

      return new Response(null, { status: file ? 204 : 201 })
    }

    if (method === 'DELETE') {
      files.delete(path)
      return new Response(null, { status: file ? 204 : 404 })
    }

    if (method === 'MKCOL') {
      if (folders.has(path)) {
        return new Response(null, { status: 405 })
      }

      folders.add(path)
      return new Response(null, { status: 201 })
    }

    return new Response(null, { status: 405 })
  }

  return {
    root,
    files,
    requests,
    fetch: fetch as typeof globalThis.fetch,
  }
}
