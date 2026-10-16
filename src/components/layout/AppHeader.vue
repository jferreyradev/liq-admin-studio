<template>
  <header class="app-header" :style="{ backgroundColor: hostStore.activeHost.color }">
    <div class="brand">
      <span class="brand-icon">⚡</span>
      <span class="brand-title">Liquid Studio</span>
      <span class="brand-badge">{{ hostStore.activeHost.badgeText }}</span>
    </div>

    <div class="header-actions">
      <!-- Selector de Municipio / Servidor -->
      <div class="host-selector-container">
        <label class="host-label">🏢 Servidor:</label>
        <select
          class="host-select"
          :value="hostStore.activeHostId"
          @change="onHostChange($event.target.value)"
        >
          <option v-for="h in hostStore.hosts" :key="h.id" :value="h.id">
            {{ h.shortName }} ({{ h.projectPort }})
          </option>
          <option value="custom">⚙️ Servidor Personalizado...</option>
        </select>
      </div>

      <!-- Estado de la Base de Datos Oracle -->
      <div
        class="status-pill cursor-pointer"
        :title="hostStore.dbStatus.message + ' — Clic para probar conexión a Oracle'"
        @click="hostStore.checkDbHealth(true)"
      >
        <span
          class="status-dot"
          :class="{
            'dot-online': hostStore.dbStatus.connected === true,
            'dot-offline': hostStore.dbStatus.connected === false,
            'dot-unknown': hostStore.dbStatus.connected === null,
            'spinning': hostStore.dbStatus.loading
          }"
        ></span>
        <span class="status-text">
          {{ hostStore.dbStatus.loading ? 'Probando Oracle...' : dbStatusLabel }}
        </span>
      </div>

      <!-- Botón Sincronizar mapperViews -->
      <button
        class="header-btn"
        :disabled="isSyncing"
        @click="syncMapperViews"
        title="Sincroniza las consultas de config/mapperViews.js a API_VIEW_MAPPER en Oracle"
      >
        <span>{{ isSyncing ? '⏳ Sincronizando...' : '📥 Sincronizar mapperViews' }}</span>
      </button>

      <!-- Botón Recargar Caché RAM -->
      <button
        class="header-btn"
        :disabled="isRefreshing"
        @click="refreshCache"
        title="Vacía y recarga la memoria RAM de vistas y procedimientos en el servidor"
      >
        <span>{{ isRefreshing ? '⏳ Recargando...' : '🔄 Recargar Caché RAM' }}</span>
      </button>

      <!-- Configuración de Clave Admin y Bridge -->
      <button class="header-btn" @click="openConfigModal" title="Configuración de Pasarela y Clave de Acceso">
        ⚙️ Config
      </button>

      <!-- Acceso rápido al Manual de Uso -->
      <button class="header-btn" @click="$router.push('/help')" title="Abrir Manual de Uso y Documentación">
        📖 Ayuda
      </button>

      <!-- Botón Cerrar Sesión -->
      <button class="header-btn btn-logout" @click="handleLogout" title="Cerrar sesión de administrador">
        🔒 Salir
      </button>
    </div>

    <!-- Modal de Configuración -->
    <div v-if="showConfigModal" class="modal-overlay" @click.self="showConfigModal = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3>⚙️ Configuración de Conexión</h3>
          <button class="btn-close" @click="showConfigModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">URL del Puente / Gateway (Deno Bridge):</label>
            <input
              type="text"
              class="form-control"
              v-model="editBridgeUrl"
              placeholder="https://deno-hono-proxy.jferreyradev.deno.net"
            />
            <span class="field-hint">Se utiliza cuando el servidor seleccionado no tiene conexión directa local.</span>
          </div>

          <div class="form-group" style="margin-top: 12px;">
            <label class="form-label">Clave de Acceso de Administrador (X-Admin-Key):</label>
            <input
              type="password"
              class="form-control"
              v-model="editAdminKey"
              placeholder="admin_liq_2026"
            />
          </div>

          <div v-if="hostStore.activeHostId === 'custom'" style="margin-top: 14px; border-top: 1px dashed var(--border-color); padding-top: 12px;">
            <div class="form-group">
              <label class="form-label">URL Directa Opcional (ej. http://192.168.1.50:3005):</label>
              <input type="text" class="form-control" v-model="editCustomDirectUrl" placeholder="Vacío para usar Deno Bridge" />
            </div>
            <div class="form-group" style="margin-top: 8px;">
              <label class="form-label">Clave del Proyecto en Bridge (x-project-key):</label>
              <input type="text" class="form-control" v-model="editCustomKey" placeholder="ej. ServerTrancas" />
            </div>
            <div class="form-group" style="margin-top: 8px;">
              <label class="form-label">Puerto (x-project-port):</label>
              <input type="text" class="form-control" v-model="editCustomPort" placeholder="3005" />
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-sm" @click="showConfigModal = false">Cancelar</button>
          <button class="btn btn-sm btn-primary" @click="saveConfig">Guardar Cambios</button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useHostStore } from '@/stores/hostStore'
import { useCatalogStore } from '@/stores/catalogStore'
import { api } from '@/services/api'

const router = useRouter()
const hostStore = useHostStore()
const catalogStore = useCatalogStore()

const isSyncing = ref(false)
const isRefreshing = ref(false)
const showConfigModal = ref(false)

const editBridgeUrl = ref(hostStore.bridgeUrl)
const editAdminKey = ref(hostStore.adminKey)
const editCustomKey = ref(hostStore.customProjectKey)
const editCustomPort = ref(hostStore.customPort)
const editCustomDirectUrl = ref(hostStore.customDirectUrl)

const dbStatusLabel = computed(() => {
  if (hostStore.dbStatus.connected === true) {
    const conn = hostStore.dbStatus.connectionString
    return conn ? `DB: ${hostStore.dbStatus.user}@${conn}` : 'DB: Oracle OK'
  }
  if (hostStore.dbStatus.connected === false) {
    return `DB: ${hostStore.dbStatus.message || 'Desconectado'}`
  }
  return 'DB: Oracle'
})

onMounted(() => {
  document.documentElement.style.setProperty('--color-primary', hostStore.activeHost.color)
  hostStore.checkDbHealth(false)
})

function onHostChange(hostId) {
  hostStore.setHost(hostId)
  hostStore.showToast(`Cambiado a ${hostStore.activeHost.name}`, 'info')
}

function openConfigModal() {
  editBridgeUrl.value = hostStore.bridgeUrl
  editAdminKey.value = hostStore.adminKey
  editCustomKey.value = hostStore.customProjectKey
  editCustomPort.value = hostStore.customPort
  editCustomDirectUrl.value = hostStore.customDirectUrl
  showConfigModal.value = true
}

function saveConfig() {
  hostStore.setBridgeUrl(editBridgeUrl.value.trim())
  hostStore.setAdminKey(editAdminKey.value.trim())
  if (hostStore.activeHostId === 'custom') {
    hostStore.setCustomHost(
      editCustomKey.value.trim(),
      editCustomPort.value.trim(),
      editCustomDirectUrl.value.trim()
    )
  }
  showConfigModal.value = false
  hostStore.showToast('Configuración actualizada', 'success')
  hostStore.checkDbHealth(true)
  catalogStore.loadAllCatalogs(true)
}

function handleLogout() {
  if (confirm('¿Cerrar sesión de administración?')) {
    hostStore.logout()
    router.replace('/login')
  }
}

async function syncMapperViews() {
  if (!confirm(`¿Deseas sincronizar todas las vistas del archivo local "config/mapperViews.js" directamente a la tabla API_VIEW_MAPPER en Oracle (${hostStore.activeHost.name})?`)) {
    return
  }
  isSyncing.value = true
  hostStore.showToast('Sincronizando consultas a Oracle (API_VIEW_MAPPER)...', 'info')
  try {
    const res = await api.post('/api/view/seed-from-file')
    await catalogStore.loadViews()
    hostStore.showToast(
      `✅ ${res.data?.message || `Sincronización exitosa en ${hostStore.activeHost.shortName}`}`,
      'success'
    )
  } catch (err) {
    hostStore.showToast(`❌ Error al sincronizar: ${err.message}`, 'error')
  } finally {
    isSyncing.value = false
  }
}

async function refreshCache() {
  isRefreshing.value = true
  hostStore.showToast('Recargando caché RAM y catálogos...', 'info')
  try {
    await api.post('/api/view/refresh')
    await catalogStore.loadAllCatalogs(true)
    await hostStore.checkDbHealth(false)
    hostStore.showToast(
      `✅ Catálogo actualizado: ${catalogStore.viewsCount} vistas y ${catalogStore.spCount} SPs en ${hostStore.activeHost.shortName}`,
      'success'
    )
  } catch (err) {
    hostStore.showToast(`❌ Error al recargar caché: ${err.message}`, 'error')
  } finally {
    isRefreshing.value = false
  }
}
</script>

<style scoped>
.app-header {
  min-height: 54px;
  padding: 8px 18px;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
  transition: background-color 0.3s ease;
  z-index: 50;
  gap: 12px;
  flex-wrap: wrap;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-icon {
  font-size: 1.25rem;
}
.brand-title {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.2px;
}
.brand-badge {
  background: rgba(255, 255, 255, 0.2);
  color: #FFFFFF;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.host-selector-container {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.22);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
.host-label {
  font-size: 0.75rem;
  font-weight: 700;
}
.host-select {
  background: #FFFFFF;
  color: #1E293B;
  border: 1px solid #CBD5E1;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 3px 8px;
  cursor: pointer;
  outline: none;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.15);
  padding: 5px 12px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  font-size: 0.78rem;
  font-weight: 600;
  user-select: none;
}
.cursor-pointer {
  cursor: pointer;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot-online {
  background-color: #4ADE80;
  box-shadow: 0 0 6px #4ADE80;
}
.dot-offline {
  background-color: #F87171;
  box-shadow: 0 0 6px #F87171;
}
.dot-unknown {
  background-color: #FBBF24;
}

.header-btn {
  background: rgba(255, 255, 255, 0.15);
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.header-btn:hover {
  background: rgba(255, 255, 255, 0.28);
}
.header-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-hint {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 2px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-card {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  width: 100%;
  max-width: 480px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  color: var(--text-primary);
  overflow: hidden;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
}
.btn-close {
  background: transparent;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: var(--text-secondary);
}
.modal-body {
  padding: 18px;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border-color);
  background: #F8FAFC;
}
</style>
