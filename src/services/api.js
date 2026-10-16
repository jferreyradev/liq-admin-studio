import { useHostStore } from '@/stores/hostStore'

export function buildUrl(path, queryParams = {}) {
  const hostStore = useHostStore()
  const base = hostStore.baseUrl
  const cleanPath = path.startsWith('/') ? path : `/${path}`

  const url = new URL(`${base}${cleanPath}`)
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
    }
  })
  return url.toString()
}

export function buildCurl({ method = 'GET', path = '/api/view/list', queryParams = {}, body = null, includeAdminKey = true }) {
  const hostStore = useHostStore()
  const fullUrl = buildUrl(path, queryParams)
  const host = hostStore.activeHost

  let cmd = `curl -X ${method.toUpperCase()} "${fullUrl}"`
  if (!host.directUrl) {
    cmd += ` \\\n  -H "x-project-key: ${host.projectKey}" \\\n  -H "x-project-port: ${host.projectPort}"`
  }
  if (includeAdminKey && hostStore.adminKey) {
    cmd += ` \\\n  -H "X-Admin-Key: ${hostStore.adminKey}"`
  }
  if (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT') {
    cmd += ` \\\n  -H "Content-Type: application/json"`
    if (body !== null && body !== undefined && body !== '') {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
      if (bodyStr.trim()) {
        cmd += ` \\\n  -d '${bodyStr.replace(/'/g, "'\\''")}'`
      }
    }
  }
  return cmd
}

async function handleResponse(res, start) {
  const hostStore = useHostStore()
  const durationMs = Math.round(performance.now() - start)
  const text = await res.text()
  const sizeKb = (text.length / 1024).toFixed(1)

  let data = text
  try {
    data = JSON.parse(text)
  } catch (_) {}

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      hostStore.logout()
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    const errMsg = (typeof data === 'object' && data !== null && (data.error || data.message))
      ? (data.error || data.message)
      : `HTTP ${res.status}: ${res.statusText || 'Error'}`
    const err = new Error(errMsg)
    err.status = res.status
    err.data = data
    err.durationMs = durationMs
    err.sizeKb = sizeKb
    throw err
  }

  return {
    status: res.status,
    statusText: res.statusText || 'OK',
    data,
    durationMs,
    sizeKb
  }
}

export const api = {
  buildUrl,
  buildCurl,

  async get(path, params = {}) {
    const hostStore = useHostStore()
    const url = buildUrl(path, params)
    const start = performance.now()

    const res = await fetch(url, {
      method: 'GET',
      headers: hostStore.requestHeaders
    })

    return handleResponse(res, start)
  },

  async post(path, body = {}, params = {}) {
    const hostStore = useHostStore()
    const url = buildUrl(path, params)
    const start = performance.now()

    const res = await fetch(url, {
      method: 'POST',
      headers: hostStore.requestHeaders,
      body: JSON.stringify(body)
    })

    return handleResponse(res, start)
  },

  async put(path, body = {}, params = {}) {
    const hostStore = useHostStore()
    const url = buildUrl(path, params)
    const start = performance.now()

    const res = await fetch(url, {
      method: 'PUT',
      headers: hostStore.requestHeaders,
      body: JSON.stringify(body)
    })

    return handleResponse(res, start)
  },

  async delete(path, params = {}) {
    const hostStore = useHostStore()
    const url = buildUrl(path, params)
    const start = performance.now()

    const res = await fetch(url, {
      method: 'DELETE',
      headers: hostStore.requestHeaders
    })

    return handleResponse(res, start)
  },

  async postBinary(path, arrayBuffer, params = {}, extraHeaders = {}) {
    const hostStore = useHostStore()
    const url = buildUrl(path, params)
    const start = performance.now()

    const headers = {
      ...hostStore.requestHeaders,
      'Content-Type': 'application/octet-stream',
      ...extraHeaders
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: arrayBuffer
    })

    return handleResponse(res, start)
  }
}
