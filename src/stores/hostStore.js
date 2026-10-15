import { defineStore } from 'pinia'
import { HOSTS, DEFAULT_BRIDGE_URL, DEFAULT_ADMIN_KEY } from '@/config/hosts'

export const useHostStore = defineStore('host', {
  state: () => ({
    hosts: HOSTS,
    activeHostId: localStorage.getItem('liq_active_host') || 'trancas',
    customProjectKey: localStorage.getItem('liq_custom_key') || '',
    customPort: localStorage.getItem('liq_custom_port') || '3005',
    bridgeUrl: localStorage.getItem('liq_bridge_url') || DEFAULT_BRIDGE_URL,
    adminKey: localStorage.getItem('liq_admin_key') || DEFAULT_ADMIN_KEY,
    dbStatus: {
      connected: null,
      message: 'Sin verificar',
      user: 'Oracle',
      loading: false
    }
  }),

  getters: {
    activeHost(state) {
      if (state.activeHostId === 'custom') {
        return {
          id: 'custom',
          name: 'Host Personalizado',
          shortName: state.customProjectKey || 'Custom',
          projectKey: state.customProjectKey || 'ServerTrancas',
          projectPort: state.customPort || '3005',
          color: '#475569',
          badgeText: `Custom :${state.customPort || '3005'}`
        }
      }
      return state.hosts.find(h => h.id === state.activeHostId) || state.hosts[0]
    },

    requestHeaders(state) {
      const host = this.activeHost
      return {
        'Content-Type': 'application/json',
        'x-project-key': host.projectKey,
        'x-project-port': String(host.projectPort),
        'X-Admin-Key': state.adminKey
      }
    }
  },

  actions: {
    setHost(hostId) {
      this.activeHostId = hostId
      localStorage.setItem('liq_active_host', hostId)
      // Actualizar variable CSS de color primario en runtime
      document.documentElement.style.setProperty('--color-primary', this.activeHost.color)
      this.checkDbHealth()
    },

    setAdminKey(key) {
      this.adminKey = key
      localStorage.setItem('liq_admin_key', key)
    },

    setBridgeUrl(url) {
      this.bridgeUrl = url
      localStorage.setItem('liq_bridge_url', url)
    },

    setCustomHost(key, port) {
      this.customProjectKey = key
      this.customPort = port
      localStorage.setItem('liq_custom_key', key)
      localStorage.setItem('liq_custom_port', port)
    },

    async checkDbHealth() {
      this.dbStatus.loading = true
      try {
        const res = await fetch(`${this.bridgeUrl}/api/admin/health?testDb=true`, {
          headers: this.requestHeaders
        })
        if (res.ok) {
          const data = await res.json()
          this.dbStatus.connected = !!data.database?.connected
          this.dbStatus.message = data.database?.message || (this.dbStatus.connected ? 'Oracle OK' : 'Error BD')
          this.dbStatus.user = data.database?.user || 'Oracle'
        } else {
          this.dbStatus.connected = false
          this.dbStatus.message = `HTTP ${res.status}`
        }
      } catch (err) {
        this.dbStatus.connected = false
        this.dbStatus.message = 'Sin conexión'
      } finally {
        this.dbStatus.loading = false
      }
    }
  }
})
