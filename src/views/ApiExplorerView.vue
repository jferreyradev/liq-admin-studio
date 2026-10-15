<template>
  <div class="explorer-layout">
    <div class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">🌐 API Explorer & Probador de Endpoints</h2>
          <p class="text-secondary">Prueba cualquier endpoint con inspección directa de peticiones y respuestas.</p>
        </div>
        <button class="btn btn-sm" @click="copyCurl">📋 Copiar cURL</button>
      </div>

      <!-- Barra de Solicitud HTTP -->
      <div class="request-bar">
        <select class="form-control method-select" v-model="method">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>

        <input 
          type="text" 
          class="form-control path-input" 
          v-model="path" 
          placeholder="/api/view/configServer"
          @keyup.enter="sendRequest"
        />

        <button class="btn btn-primary" :disabled="loading" @click="sendRequest">
          {{ loading ? '⏳ Enviando...' : '🚀 Enviar' }}
        </button>
      </div>

      <!-- Subpestañas: Params, Body, Headers -->
      <div class="tabs-header">
        <button class="tab-item" :class="{ active: activeTab === 'params' }" @click="activeTab = 'params'">
          Query Params ({{ queryParams.length }})
        </button>
        <button class="tab-item" :class="{ active: activeTab === 'body' }" @click="activeTab = 'body'">
          Cuerpo JSON (Body)
        </button>
        <button class="tab-item" :class="{ active: activeTab === 'headers' }" @click="activeTab = 'headers'">
          Headers
        </button>
      </div>

      <!-- Tab: Query Params -->
      <div v-if="activeTab === 'params'" class="tab-pane">
        <div class="params-table">
          <div v-for="(p, i) in queryParams" :key="i" class="param-row">
            <input type="text" class="form-control" placeholder="Clave" v-model="p.key" />
            <input type="text" class="form-control" placeholder="Valor" v-model="p.value" />
            <button class="btn btn-sm btn-danger" @click="removeParam(i)">✕</button>
          </div>
        </div>
        <button class="btn btn-sm" style="margin-top: 8px;" @click="addParam">+ Agregar Parámetro</button>
      </div>

      <!-- Tab: Body JSON -->
      <div v-if="activeTab === 'body'" class="tab-pane">
        <textarea 
          class="form-control json-textarea" 
          v-model="bodyJson" 
          placeholder="{ &quot;campo&quot;: &quot;valor&quot; }"
          rows="6"
        ></textarea>
        <button class="btn btn-sm" style="margin-top: 6px;" @click="formatJson">🧹 Formatear JSON</button>
      </div>

      <!-- Tab: Headers -->
      <div v-if="activeTab === 'headers'" class="tab-pane">
        <p class="text-secondary" style="font-size: 0.8rem; margin-bottom: 8px;">
          Cabeceras inyectadas automáticamente según el servidor activo:
        </p>
        <pre>{{ JSON.stringify(hostStore.requestHeaders, null, 2) }}</pre>
      </div>
    </div>

    <!-- Tarjeta de Respuesta -->
    <div v-if="response" class="card">
      <div class="card-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <h3 class="card-title">Respuesta</h3>
          <span 
            class="badge" 
            :class="response.status < 400 ? 'badge-success' : 'badge-error'"
          >
            HTTP {{ response.status }}
          </span>
          <span class="badge badge-info">{{ response.durationMs }} ms</span>
        </div>
        <button class="btn btn-sm" @click="copyResponse">📋 Copiar Respuesta</button>
      </div>

      <pre class="response-pre">{{ typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useHostStore } from '@/stores/hostStore'
import { api } from '@/services/api'

const hostStore = useHostStore()

const method = ref('GET')
const path = ref('/api/view/configServer')
const activeTab = ref('params')
const queryParams = ref([{ key: 'limit', value: '10' }])
const bodyJson = ref('')
const loading = ref(false)
const response = ref(null)

function addParam() {
  queryParams.value.push({ key: '', value: '' })
}

function removeParam(index) {
  queryParams.value.splice(index, 1)
}

function formatJson() {
  try {
    bodyJson.value = JSON.stringify(JSON.parse(bodyJson.value), null, 2)
  } catch (_) {
    alert('JSON no válido')
  }
}

const computedParams = computed(() => {
  const map = {}
  queryParams.value.forEach(p => {
    if (p.key.trim()) map[p.key.trim()] = p.value
  })
  return map
})

async function sendRequest() {
  if (!path.value.trim()) return
  loading.value = true
  response.value = null

  try {
    let res
    if (method.value === 'GET') {
      res = await api.get(path.value, computedParams.value)
    } else if (method.value === 'POST') {
      let parsed = {}
      if (bodyJson.value.trim()) {
        try { parsed = JSON.parse(bodyJson.value) } catch (_) { parsed = bodyJson.value }
      }
      res = await api.post(path.value, parsed, computedParams.value)
    } else if (method.value === 'DELETE') {
      res = await api.delete(path.value, computedParams.value)
    }
    response.value = res
  } catch (err) {
    response.value = {
      status: err.status || 500,
      data: err.data || { error: err.message },
      durationMs: err.durationMs || 0
    }
  } finally {
    loading.value = false
  }
}

function copyCurl() {
  const base = `${hostStore.bridgeUrl}${path.value.startsWith('/') ? path.value : '/' + path.value}`
  const curl = `curl -X ${method.value} "${base}" \\\n  -H "x-project-key: ${hostStore.activeHost.projectKey}" \\\n  -H "x-project-port: ${hostStore.activeHost.projectPort}" \\\n  -H "X-Admin-Key: ${hostStore.adminKey}"`
  navigator.clipboard.writeText(curl)
  alert('cURL copiado al portapapeles')
}

function copyResponse() {
  if (!response.value) return
  const text = typeof response.value.data === 'object' ? JSON.stringify(response.value.data, null, 2) : response.value.data
  navigator.clipboard.writeText(text)
  alert('Respuesta copiada')
}
</script>

<style scoped>
.explorer-layout {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  height: 100%;
}

.request-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.method-select {
  width: 110px;
  font-weight: 700;
  color: var(--color-primary);
}
.path-input {
  flex: 1;
  font-family: var(--font-mono);
}

.tabs-header {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 12px;
}
.tab-item {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.tab-item.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.params-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.param-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.json-textarea {
  width: 100%;
  font-family: var(--font-mono);
  background: #0F172A;
  color: #38BDF8;
}

.response-pre {
  max-height: 450px;
}
</style>
