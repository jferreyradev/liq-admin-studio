import { useHostStore } from '@/stores/hostStore'

function buildUrl(path, queryParams = {}) {
  const hostStore = useHostStore()
  const base = hostStore.bridgeUrl.replace(/\/+$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  
  const url = new URL(`${base}${cleanPath}`)
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
    }
  })
  return url.toString()
}

export const api = {
  async get(path, params = {}) {
    const hostStore = useHostStore()
    const url = buildUrl(path, params)
    const start = performance.now()

    const res = await fetch(url, {
      method: 'GET',
      headers: hostStore.requestHeaders
    })

    const durationMs = Math.round(performance.now() - start)
    const isJson = (res.headers.get('content-type') || '').includes('application/json')
    const data = isJson ? await res.json() : await res.text()

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        hostStore.logout()
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
      }
      const err = new Error(data?.error || `HTTP ${res.status}: ${res.statusText}`)
      err.status = res.status
      err.data = data
      err.durationMs = durationMs
      throw err
    }

    return {
      status: res.status,
      data,
      durationMs
    }
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

    const durationMs = Math.round(performance.now() - start)
    const isJson = (res.headers.get('content-type') || '').includes('application/json')
    const data = isJson ? await res.json() : await res.text()

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        hostStore.logout()
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
      }
      const err = new Error(data?.error || `HTTP ${res.status}: ${res.statusText}`)
      err.status = res.status
      err.data = data
      err.durationMs = durationMs
      throw err
    }

    return {
      status: res.status,
      data,
      durationMs
    }
  },

  async delete(path, params = {}) {
    const hostStore = useHostStore()
    const url = buildUrl(path, params)
    const start = performance.now()

    const res = await fetch(url, {
      method: 'DELETE',
      headers: hostStore.requestHeaders
    })

    const durationMs = Math.round(performance.now() - start)
    const isJson = (res.headers.get('content-type') || '').includes('application/json')
    const data = isJson ? await res.json() : await res.text()

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        hostStore.logout()
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
      }
      const err = new Error(data?.error || `HTTP ${res.status}: ${res.statusText}`)
      err.status = res.status
      err.data = data
      err.durationMs = durationMs
      throw err
    }

    return {
      status: res.status,
      data,
      durationMs
    }
  }
}
