<template>
  <div class="explorer-master-layout">
    <!-- Catálogo Lateral de Endpoints -->
    <div class="catalog-sidebar">
      <div class="search-header">
        <input
          type="text"
          class="form-control"
          placeholder="Filtrar endpoints..."
          v-model="sidebarSearch"
        />
        <div class="meta-row">
          <span class="badge badge-info">{{ filteredEndpoints.length }} endpoints</span>
          <select class="form-control filter-type-select" v-model="sidebarTypeFilter">
            <option value="all">Todos</option>
            <option value="system">🔧 Sistema</option>
            <option value="view">📋 Vistas</option>
            <option value="sp">⚡ SPs</option>
            <option value="fn">ƒ(x) Funciones</option>
            <option value="repo">📊 Reportes</option>
            <option value="entity">🗃️ Entidades</option>
          </select>
        </div>
      </div>

      <div class="item-list">
        <div
          v-for="ep in filteredEndpoints"
          :key="ep.id"
          class="catalog-item"
          :class="{ active: path === ep.path && method === ep.method }"
          @click="loadEndpoint(ep)"
        >
          <div class="ep-row">
            <span class="ep-name">{{ ep.name }}</span>
            <span class="ep-method" :class="`method-${ep.method.toLowerCase()}`">{{ ep.method }}</span>
          </div>
          <div class="ep-path">{{ ep.path }}</div>
        </div>
      </div>
    </div>

    <!-- Área Principal del Explorer -->
    <div class="explorer-workspace">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">🌐 API Explorer & Probador de Endpoints</h2>
            <p class="text-secondary" style="font-size: 0.8rem; margin-top: 2px;">
              Construye, parametriza y prueba cualquier consulta o endpoint de la API con inspección en vivo.
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm" @click="resetExplorer" title="Restablecer formulario">🧹 Limpiar</button>
            <button class="btn btn-sm" @click="copyCurl" title="Copiar comando cURL">📋 Copiar cURL</button>
          </div>
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
            {{ loading ? '⏳ Enviando...' : '🚀 Enviar Petición' }}
          </button>
        </div>

        <!-- Subpestañas: Params, Body, Headers -->
        <div class="tabs-header">
          <button class="tab-item" :class="{ active: activeTab === 'params' }" @click="activeTab = 'params'">
            Parámetros Query ({{ activeQueryParamsCount }})
          </button>
          <button class="tab-item" :class="{ active: activeTab === 'body' }" @click="activeTab = 'body'">
            Cuerpo JSON (Body)
          </button>
          <button class="tab-item" :class="{ active: activeTab === 'headers' }" @click="activeTab = 'headers'">
            Encabezados (Headers)
          </button>
        </div>

        <!-- Tab: Query Params -->
        <div v-if="activeTab === 'params'" class="tab-pane">
          <div class="shortcuts-bar">
            <span class="shortcuts-label">ATAJOS RÁPIDOS:</span>
            <button class="btn btn-sm" @click="addQuickParam('fields', '')">+ fields</button>
            <button class="btn btn-sm" @click="addQuickParam('limit', '50')">+ limit</button>
            <button class="btn btn-sm" @click="addQuickParam('offset', '0')">+ offset</button>
            <button class="btn btn-sm" @click="addQuickParam('search', 'Campo:texto')">+ search</button>
            <button class="btn btn-sm" @click="addQuickParam('sort', '{\"Campo\":\"asc\"}')">+ sort</button>
            <button class="btn btn-sm" style="margin-left: auto;" @click="addParam('', '', true)">+ Agregar Fila</button>
          </div>

          <div class="table-container" style="max-height: 240px;">
            <table>
              <thead>
                <tr>
                  <th style="width: 55px; text-align: center;">Activo</th>
                  <th style="width: 40%;">Clave (Parámetro)</th>
                  <th style="width: 50%;">Valor</th>
                  <th style="width: 45px;"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(p, i) in queryParams" :key="i">
                  <td style="text-align: center;">
                    <input type="checkbox" v-model="p.enabled" />
                  </td>
                  <td>
                    <input
                      type="text"
                      class="form-control param-input"
                      placeholder="Parámetro (ej: IdRep)"
                      v-model="p.key"
                      @keyup.enter="sendRequest"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      class="form-control param-input"
                      placeholder="Valor"
                      v-model="p.value"
                      @keyup.enter="sendRequest"
                    />
                  </td>
                  <td style="text-align: center;">
                    <button class="btn btn-sm btn-danger" @click="removeParam(i)">✕</button>
                  </td>
                </tr>
                <tr v-if="queryParams.length === 0">
                  <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 14px;">
                    Sin parámetros query. Usa los atajos rápidos o "+ Agregar Fila".
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab: Body JSON -->
        <div v-if="activeTab === 'body'" class="tab-pane">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span class="shortcuts-label">PAYLOAD JSON (POST / PUT):</span>
            <button class="btn btn-sm" @click="formatJson">🧹 Formatear JSON</button>
          </div>
          <textarea
            class="form-control json-textarea"
            v-model="bodyJson"
            placeholder="{&#10;  &quot;campo&quot;: &quot;valor&quot;&#10;}"
            rows="7"
          ></textarea>
        </div>

        <!-- Tab: Headers -->
        <div v-if="activeTab === 'headers'" class="tab-pane">
          <label class="header-check-row">
            <input type="checkbox" v-model="includeAdminKey" />
            <span>Incluir cabecera <code>X-Admin-Key</code> de administrador</span>
          </label>
          <p class="text-secondary" style="font-size: 0.78rem; margin: 10px 0 6px;">
            Cabeceras activas para <strong>{{ hostStore.activeHost.name }}</strong>:
          </p>
          <pre>{{ JSON.stringify(effectiveHeadersPreview, null, 2) }}</pre>
        </div>

        <!-- Vista previa en vivo de URL -->
        <div class="live-url-bar">
          <div class="live-url-left">
            <span class="ep-method" :class="`method-${method.toLowerCase()}`">{{ method }}</span>
            <code class="live-url-code">{{ relativeUrlPreview }}</code>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm" @click="copyUrl">📋 Copiar URL</button>
            <button class="btn btn-sm" @click="copyCurl">📋 Copiar cURL</button>
          </div>
        </div>
      </div>

      <!-- Tarjeta de Respuesta -->
      <div v-if="response" class="card">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <h3 class="card-title">Respuesta del Servidor</h3>
            <span
              class="badge"
              :class="response.status < 400 ? 'badge-success' : response.status < 500 ? 'badge-warning' : 'badge-error'"
            >
              HTTP {{ response.status }} {{ response.statusText || '' }}
            </span>
            <span class="badge badge-info">{{ response.durationMs }} ms • {{ response.sizeKb || '0.0' }} KB</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button
              v-if="responseRows.length > 0"
              class="btn btn-sm"
              :class="{ 'btn-primary': responseViewFormat === 'table' }"
              @click="responseViewFormat = 'table'"
            >
              📊 Tabla ({{ responseRows.length }})
            </button>
            <button
              class="btn btn-sm"
              :class="{ 'btn-primary': responseViewFormat === 'json' }"
              @click="responseViewFormat = 'json'"
            >
              { } JSON
            </button>
            <button class="btn btn-sm" @click="copyResponse">📋 Copiar Respuesta</button>
          </div>
        </div>

        <div v-if="responseViewFormat === 'table' && responseRows.length > 0">
          <ResultsTable
            :rows="responseRows"
            :duration-ms="response.durationMs"
            title="Vista Tabular de Respuesta"
          />
        </div>
        <pre v-else class="response-pre">{{ formattedResponseData }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useHostStore } from '@/stores/hostStore'
import { useCatalogStore } from '@/stores/catalogStore'
import { api } from '@/services/api'
import ResultsTable from '@/components/common/ResultsTable.vue'

const route = useRoute()
const hostStore = useHostStore()
const catalogStore = useCatalogStore()

const sidebarSearch = ref('')
const sidebarTypeFilter = ref('all')

const method = ref('GET')
const path = ref('/api/view/list')
const activeTab = ref('params')
const queryParams = ref([])
const bodyJson = ref('')
const includeAdminKey = ref(true)

const loading = ref(false)
const response = ref(null)
const responseViewFormat = ref('json')

onMounted(async () => {
  await catalogStore.loadAllCatalogs()

  if (route.query.endpoint) {
    method.value = String(route.query.method || 'GET').toUpperCase()
    path.value = String(route.query.endpoint)
    queryParams.value = []

    if (route.query.params) {
      try {
        const parsedParams = JSON.parse(String(route.query.params))
        Object.entries(parsedParams).forEach(([k, v]) => {
          addParam(k, String(v), true)
        })
      } catch (_) {}
    }

    if (route.query.body) {
      bodyJson.value = String(route.query.body)
      activeTab.value = 'body'
    } else {
      activeTab.value = method.value === 'GET' ? 'params' : 'body'
    }
  } else {
    addParam('limit', '50', true)
  }
})

const allEndpoints = computed(() => {
  const list = [
    { id: 'sys:views', type: 'system', method: 'GET', path: '/api/view/list', name: 'Catálogo de Vistas' },
    { id: 'sys:sp', type: 'system', method: 'GET', path: '/api/sp/list', name: 'Catálogo de SPs' },
    { id: 'sys:fn', type: 'system', method: 'GET', path: '/api/fn/list', name: 'Catálogo de Funciones' },
    { id: 'sys:repo', type: 'system', method: 'GET', path: '/api/repo/list', name: 'Catálogo de Reportes' },
    { id: 'sys:en', type: 'system', method: 'GET', path: '/api/en/list', name: 'Catálogo de Entidades' },
    { id: 'sys:tables', type: 'system', method: 'GET', path: '/api/import/tables', name: 'Tablas Oracle' },
    { id: 'sys:health', type: 'system', method: 'GET', path: '/api/admin/health', name: 'Health Check BD' }
  ]

  Object.keys(catalogStore.views || {}).forEach(v => {
    list.push({
      id: `view:${v}`,
      type: 'view',
      method: 'GET',
      path: `/api/view/${v}`,
      name: v,
      meta: catalogStore.views[v]
    })
  })

  Object.keys(catalogStore.sp || {}).forEach(sp => {
    list.push({
      id: `sp:${sp}`,
      type: 'sp',
      method: 'POST',
      path: `/api/sp/${sp}`,
      name: sp,
      meta: catalogStore.sp[sp]
    })
  })

  Object.keys(catalogStore.fn || {}).forEach(fn => {
    list.push({
      id: `fn:${fn}`,
      type: 'fn',
      method: 'POST',
      path: `/api/fn/${fn}`,
      name: fn,
      meta: catalogStore.fn[fn]
    })
  })

  Object.keys(catalogStore.repo || {}).forEach(r => {
    list.push({
      id: `repo:${r}`,
      type: 'repo',
      method: 'GET',
      path: `/api/repo/${r}`,
      name: r,
      meta: catalogStore.repo[r]
    })
  })

  Object.keys(catalogStore.entities || {}).forEach(en => {
    list.push({
      id: `entity:${en}`,
      type: 'entity',
      method: 'GET',
      path: `/api/${en}`,
      name: `Entidad: ${en}`,
      meta: catalogStore.entities[en]
    })
  })

  return list
})

const filteredEndpoints = computed(() => {
  return allEndpoints.value.filter(ep => {
    if (sidebarTypeFilter.value !== 'all' && ep.type !== sidebarTypeFilter.value) {
      return false
    }
    if (!sidebarSearch.value.trim()) return true
    const q = sidebarSearch.value.toLowerCase().trim()
    return ep.name.toLowerCase().includes(q) || ep.path.toLowerCase().includes(q)
  })
})

function loadEndpoint(ep) {
  method.value = ep.method
  path.value = ep.path
  queryParams.value = []
  bodyJson.value = ''

  if (ep.type === 'view' && ep.meta) {
    addParam('fields', '', false)
    addParam('limit', '50', true)
    addParam('offset', '0', false)
    const whereFields = ep.meta.sql?.whereFields || {}
    Object.keys(whereFields).forEach(wf => {
      addParam(wf, '', false)
    })
    activeTab.value = 'params'
  } else if ((ep.type === 'sp' || ep.type === 'fn') && ep.meta) {
    const inParams = ep.meta.in_param || []
    const template = {}
    inParams.forEach(p => { template[p] = '' })
    bodyJson.value = JSON.stringify(template, null, 2)
    activeTab.value = 'body'
  } else if (ep.type === 'repo') {
    addParam('limit', '50', true)
    activeTab.value = 'params'
  } else if (ep.path === '/api/admin/health') {
    addParam('testDb', 'true', true)
    activeTab.value = 'params'
  } else {
    activeTab.value = ep.method === 'GET' ? 'params' : 'body'
  }
}

function addParam(key = '', value = '', enabled = true) {
  queryParams.value.push({ key, value, enabled })
}

function addQuickParam(key, defaultValue) {
  const existing = queryParams.value.find(p => p.key === key)
  if (existing) {
    existing.enabled = true
    if (!existing.value) existing.value = defaultValue
  } else {
    queryParams.value.push({ key, value: defaultValue, enabled: true })
  }
  activeTab.value = 'params'
}

function removeParam(index) {
  queryParams.value.splice(index, 1)
}

function resetExplorer() {
  method.value = 'GET'
  path.value = '/api/view/list'
  queryParams.value = []
  bodyJson.value = ''
  response.value = null
  activeTab.value = 'params'
}

function formatJson() {
  if (!bodyJson.value.trim()) return
  try {
    bodyJson.value = JSON.stringify(JSON.parse(bodyJson.value), null, 2)
    hostStore.showToast('JSON formateado correctamente', 'success')
  } catch (e) {
    hostStore.showToast(`JSON inválido: ${e.message}`, 'error')
  }
}

const computedParams = computed(() => {
  const map = {}
  queryParams.value.forEach(p => {
    if (p.enabled && p.key.trim()) {
      map[p.key.trim()] = p.value
    }
  })
  return map
})

const activeQueryParamsCount = computed(() => Object.keys(computedParams.value).length)

const relativeUrlPreview = computed(() => {
  const cleanPath = path.value.startsWith('/') ? path.value : `/${path.value}`
  const q = new URLSearchParams()
  Object.entries(computedParams.value).forEach(([k, v]) => q.append(k, v))
  const qs = q.toString()
  return `${cleanPath}${qs ? '?' + qs : ''}`
})

const effectiveHeadersPreview = computed(() => {
  const h = { ...hostStore.requestHeaders }
  if (!includeAdminKey.value) {
    delete h['X-Admin-Key']
  }
  return h
})

const responseRows = computed(() => {
  if (!response.value || !response.value.data) return []
  const d = response.value.data
  if (Array.isArray(d) && d.length > 0 && typeof d[0] === 'object' && d[0] !== null) {
    return d
  }
  if (d && Array.isArray(d.rows) && d.rows.length > 0 && typeof d.rows[0] === 'object') {
    return d.rows
  }
  return []
})

const formattedResponseData = computed(() => {
  if (!response.value) return ''
  return typeof response.value.data === 'object'
    ? JSON.stringify(response.value.data, null, 2)
    : String(response.value.data)
})

async function sendRequest() {
  if (!path.value.trim()) return
  loading.value = true
  response.value = null

  try {
    let parsedBody = {}
    if (method.value === 'POST' || method.value === 'PUT') {
      if (bodyJson.value.trim()) {
        try {
          parsedBody = JSON.parse(bodyJson.value)
        } catch (err) {
          hostStore.showToast(`Error de sintaxis en el Cuerpo JSON: ${err.message}`, 'error')
          loading.value = false
          return
        }
      }
    }

    let res
    const m = method.value.toUpperCase()
    if (m === 'GET') {
      res = await api.get(path.value, computedParams.value)
    } else if (m === 'POST') {
      res = await api.post(path.value, parsedBody, computedParams.value)
    } else if (m === 'PUT') {
      res = await api.put(path.value, parsedBody, computedParams.value)
    } else if (m === 'DELETE') {
      res = await api.delete(path.value, computedParams.value)
    }

    response.value = res
    responseViewFormat.value = responseRows.value.length > 0 ? 'table' : 'json'
    hostStore.showToast(`HTTP ${res.status} (${res.durationMs} ms)`, 'success')
  } catch (err) {
    response.value = {
      status: err.status || 500,
      statusText: 'Error',
      data: err.data || { error: err.message },
      durationMs: err.durationMs || 0,
      sizeKb: err.sizeKb || '0.0'
    }
    responseViewFormat.value = 'json'
    hostStore.showToast(`HTTP ${err.status || 'Error'}: ${err.message}`, 'warning')
  } finally {
    loading.value = false
  }
}

function copyUrl() {
  const fullUrl = api.buildUrl(path.value, computedParams.value)
  navigator.clipboard.writeText(fullUrl)
  hostStore.showToast('URL copiada al portapapeles', 'success')
}

function copyCurl() {
  const curl = api.buildCurl({
    method: method.value,
    path: path.value,
    queryParams: computedParams.value,
    body: bodyJson.value.trim() || null,
    includeAdminKey: includeAdminKey.value
  })
  navigator.clipboard.writeText(curl)
  hostStore.showToast('Comando cURL copiado al portapapeles', 'success')
}

function copyResponse() {
  if (!response.value) return
  navigator.clipboard.writeText(formattedResponseData.value)
  hostStore.showToast('Respuesta copiada al portapapeles', 'success')
}
</script>

<style scoped>
.explorer-master-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.catalog-sidebar {
  width: 290px;
  min-width: 290px;
  border-right: 1px solid var(--border-color);
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
}

.search-header {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.filter-type-select {
  padding: 3px 8px;
  font-size: 0.75rem;
  width: auto;
}

.item-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}
.catalog-item {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  margin-bottom: 3px;
  border-left: 3px solid transparent;
  transition: all 0.15s ease;
}
.catalog-item:hover {
  background-color: var(--bg-hover);
}
.catalog-item.active {
  background-color: rgba(106, 27, 154, 0.08);
  border-left-color: var(--color-primary);
}
.ep-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.ep-name {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ep-method {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.method-get {
  background: var(--color-success-bg);
  color: var(--color-success);
}
.method-post {
  background: var(--color-info-bg);
  color: var(--color-info);
}
.method-put {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}
.method-delete {
  background: var(--color-error-bg);
  color: var(--color-error);
}
.ep-path {
  font-family: var(--font-mono);
  font-size: 0.71rem;
  color: var(--text-secondary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.explorer-workspace {
  flex: 1;
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
  flex-wrap: wrap;
}
.method-select {
  width: 110px;
  font-weight: 700;
  color: var(--color-primary);
}
.path-input {
  flex: 1;
  min-width: 220px;
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

.shortcuts-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.shortcuts-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.param-input {
  padding: 4px 8px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  width: 100%;
}

.json-textarea {
  width: 100%;
  font-family: var(--font-mono);
  background: #0F172A;
  color: #38BDF8;
}

.header-check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.live-url-bar {
  margin-top: 14px;
  padding: 10px 14px;
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.live-url-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 220px;
  overflow: hidden;
}
.live-url-code {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--color-primary);
  word-break: break-all;
}

.response-pre {
  max-height: 450px;
}
</style>
