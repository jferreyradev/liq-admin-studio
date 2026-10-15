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
        :title="hostStore.dbStatus.message + ' (Clic para reprobar conexión)'"
        @click="hostStore.checkDbHealth()"
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
        <span class="status-text">DB: Oracle</span>
      </div>

      <!-- Botón Sincronizar mapperViews -->
      <button 
        class="header-btn" 
        :disabled="isSyncing"
        @click="syncMapperViews" 
        title="Sincroniza las 54 consultas de config/mapperViews.js a API_VIEW_MAPPER"
      >
        <span>{{ isSyncing ? '⏳ Sincronizando...' : '📥 Sincronizar Vistas' }}</span>
      </button>

      <!-- Botón Recargar Caché RAM -->
      <button 
        class="header-btn" 
        :disabled="isRefreshing"
        @click="refreshCache" 
        title="Reinicia la memoria RAM de vistas y procedimientos"
      >
        <span>{{ isRefreshing ? '⏳ Recargando...' : '🔄 Recargar Caché' }}</span>
      </button>

      <!-- Configuración de Clave Admin y Bridge -->
      <button class="header-btn" @click="showConfigModal = true" title="Configuración de Puente y Clave de Acceso">
        ⚙️ Config
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
            <label class="form-label">URL del Puente / Gateway (Deno Bridge o Local):</label>
            <input 
              type="text" 
              class="form-control" 
              v-model="editBridgeUrl" 
              placeholder="https://dno-admin-bridge.jferreyradev.deno.net"
            />
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
              <label class="form-label">Clave del Proyecto (x-project-key):</label>
              <input type="text" class="form-control" v-model="editCustomKey" placeholder="ej. ServerTrancas o IP" />
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useHostStore } from '@/stores/hostStore'
import { api } from '@/services/api'

const router = useRouter()
const hostStore = useHostStore()
const isSyncing = ref(false)
const isRefreshing = ref(false)
const showConfigModal = ref(false)

const editBridgeUrl = ref(hostStore.bridgeUrl)
const editAdminKey = ref(hostStore.adminKey)
const editCustomKey = ref(hostStore.customProjectKey)
const editCustomPort = ref(hostStore.customPort)

onMounted(() => {
  document.documentElement.style.setProperty('--color-primary', hostStore.activeHost.color)
  hostStore.checkDbHealth()
})

function onHostChange(hostId) {
  hostStore.setHost(hostId)
}

function saveConfig() {
  hostStore.setBridgeUrl(editBridgeUrl.value.trim())
  hostStore.setAdminKey(editAdminKey.value.trim())
  if (hostStore.activeHostId === 'custom') {
    hostStore.setCustomHost(editCustomKey.value.trim(), editCustomPort.value.trim())
  }
  showConfigModal.value = false
  hostStore.checkDbHealth()
}

function handleLogout() {
  if (confirm('¿Cerrar sesión de administración?')) {
    hostStore.logout()
    router.replace('/login')
  }
}

async function syncMapperViews() {
  isSyncing.value = true
  try {
    const res = await api.post('/api/view/seed-from-file')
    alert(`✅ Sincronización exitosa: ${res.data.successful || 0} vistas guardadas en la base de datos de ${hostStore.activeHost.shortName}.`)
  } catch (err) {
    alert(`❌ Error al sincronizar: ${err.message}`)
  } finally {
    isSyncing.value = false
  }
}

async function refreshCache() {
  isRefreshing.value = true
  try {
    await api.post('/api/view/refresh')
    alert(`🔄 Caché de vistas y procedimientos reiniciada en ${hostStore.activeHost.shortName}.`)
  } catch (err) {
    alert(`❌ Error: ${err.message}`)
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
