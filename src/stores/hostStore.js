import { defineStore } from 'pinia'
import { HOSTS, DEFAULT_BRIDGE_URL } from '@/config/hosts'

export const useHostStore = defineStore('host', {
  state: () => ({
    hosts: HOSTS,
    activeHostId: localStorage.getItem('liq_active_host') || 'trancas',
    customProjectKey: localStorage.getItem('liq_custom_key') || '',
    customPort: localStorage.getItem('liq_custom_port') || '3005',
    customDirectUrl: localStorage.getItem('liq_custom_direct_url') || '',
    bridgeUrl: (() => {
      const saved = localStorage.getItem('liq_bridge_url')
      if (saved && !saved.includes('dno-admin-bridge')) return saved
      localStorage.setItem('liq_bridge_url', DEFAULT_BRIDGE_URL)
      return DEFAULT_BRIDGE_URL
    })(),
    adminKey: sessionStorage.getItem('liq_admin_key') || localStorage.getItem('liq_admin_key') || '',
    dbStatus: {
      connected: null,
      message: 'Sin verificar',
      user: 'Oracle',
      connectionString: '',
      loading: false
    },
    toast: {
      visible: false,
      message: '',
      type: 'info',
      timerId: null
    }
  }),

  getters: {
    isAuthenticated: (state) => !!state.adminKey,

    activeHost(state) {
      if (state.activeHostId === 'custom') {
        return {
          id: 'custom',
          name: 'Host Personalizado',
          shortName: state.customProjectKey || 'Custom',
          projectKey: state.customProjectKey || 'ServerTrancas',
          projectPort: state.customPort || '3005',
          directUrl: state.customDirectUrl || '',
          color: '#475569',
          badgeText: `Custom :${state.customPort || '3005'}`
        }
      }
      return state.hosts.find(h => h.id === state.activeHostId) || state.hosts[0]
    },

    baseUrl(state) {
      const host = this.activeHost
      return (host.directUrl || state.bridgeUrl).replace(/\/+$/, '')
    },

    isDirectHost() {
      return Boolean(this.activeHost.directUrl)
    },

    requestHeaders(state) {
      const host = this.activeHost
      const headers = {
        'Content-Type': 'application/json'
      }
      if (!host.directUrl) {
        headers['x-project-key'] = host.projectKey
        headers['x-project-port'] = String(host.projectPort)
      }
      if (state.adminKey) {
        headers['X-Admin-Key'] = state.adminKey
      }
      return headers
    }
  },

  actions: {
    showToast(message, type = 'success', duration = 3500) {
      if (this.toast.timerId) {
        clearTimeout(this.toast.timerId)
      }
      this.toast.message = message
      this.toast.type = type
      this.toast.visible = true
      this.toast.timerId = setTimeout(() => {
        this.toast.visible = false
      }, duration)
    },

    setHost(hostId) {
      this.activeHostId = hostId
      localStorage.setItem('liq_active_host', hostId)
      document.documentElement.style.setProperty('--color-primary', this.activeHost.color)
      if (this.isAuthenticated) {
        this.checkDbHealth()
      }
    },

    async verifyAndLogin(key, remember = false) {
      const cleanKey = String(key || '').trim()
      if (!cleanKey) {
        throw new Error('La clave de acceso es requerida.')
      }

      const host = this.activeHost
      const url = `${this.baseUrl}/api/admin/verify`

      const headers = {
        'Content-Type': 'application/json',
        'X-Admin-Key': cleanKey
      }
      if (!host.directUrl) {
        headers['x-project-key'] = host.projectKey
        headers['x-project-port'] = String(host.projectPort)
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ adminKey: cleanKey })
      })

      if (!res.ok) {
        throw new Error('Clave de acceso incorrecta o no autorizada.')
      }

      this.adminKey = cleanKey
      if (remember) {
        localStorage.setItem('liq_admin_key', cleanKey)
        sessionStorage.removeItem('liq_admin_key')
      } else {
        sessionStorage.setItem('liq_admin_key', cleanKey)
        localStorage.removeItem('liq_admin_key')
      }

      this.checkDbHealth()
      return true
    },

    logout() {
      this.adminKey = ''
      localStorage.removeItem('liq_admin_key')
      sessionStorage.removeItem('liq_admin_key')
      this.dbStatus.connected = null
      this.dbStatus.message = 'Sesión cerrada'
    },

    setAdminKey(key) {
      this.adminKey = key
      localStorage.setItem('liq_admin_key', key)
    },

    setBridgeUrl(url) {
      this.bridgeUrl = url
      localStorage.setItem('liq_bridge_url', url)
    },

    setCustomHost(key, port, directUrl = '') {
      this.customProjectKey = key
      this.customPort = port
      this.customDirectUrl = directUrl
      localStorage.setItem('liq_custom_key', key)
      localStorage.setItem('liq_custom_port', port)
      localStorage.setItem('liq_custom_direct_url', directUrl)
    },

    async checkDbHealth(interactive = false) {
      if (!this.isAuthenticated) return
      this.dbStatus.loading = true
      try {
        const res = await fetch(`${this.baseUrl}/api/admin/health?testDb=true`, {
          headers: this.requestHeaders
        })
        if (res.ok) {
          const data = await res.json()
          this.dbStatus.connected = !!data.database?.connected
          this.dbStatus.user = data.database?.user || 'Oracle'
          this.dbStatus.connectionString = data.database?.connectionString || ''
          this.dbStatus.message = data.database?.message || (this.dbStatus.connected ? 'Oracle OK' : 'Error BD')
          if (interactive) {
            if (this.dbStatus.connected) {
              this.showToast(`Conexión exitosa a Oracle (${this.dbStatus.user}@${this.dbStatus.connectionString || this.activeHost.shortName})`, 'success')
            } else {
              this.showToast(`Fallo de conexión a Oracle: ${this.dbStatus.message}`, 'error')
            }
          }
        } else {
          this.dbStatus.connected = false
          this.dbStatus.message = `HTTP ${res.status}`
          if (interactive) {
            this.showToast(`Error HTTP ${res.status} al verificar salud de BD`, 'error')
          }
        }
      } catch (err) {
        this.dbStatus.connected = false
        this.dbStatus.message = 'Sin conexión'
        if (interactive) {
          this.showToast(`No se pudo conectar con ${this.activeHost.shortName}: ${err.message}`, 'error')
        }
      } finally {
        this.dbStatus.loading = false
      }
    }
  }
})
