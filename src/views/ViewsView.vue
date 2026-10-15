<template>
  <div class="views-layout">
    <!-- Lista Lateral de Vistas -->
    <div class="catalog-sidebar">
      <div class="search-header">
        <input 
          type="text" 
          class="form-control" 
          placeholder="Buscar consulta o vista..." 
          v-model="searchTerm"
        />
        <div class="meta-row">
          <span class="badge badge-info">{{ filteredViews.length }} de {{ Object.keys(views).length }} vistas</span>
          <button class="btn btn-sm" @click="loadViews" :disabled="loadingCatalog">
            {{ loadingCatalog ? '...' : '🔄' }}
          </button>
        </div>
      </div>

      <div class="item-list">
        <div 
          v-for="v in filteredViews" 
          :key="v.name"
          class="catalog-item"
          :class="{ active: selectedViewName === v.name }"
          @click="selectView(v.name)"
        >
          <div class="item-title">{{ v.name }}</div>
          <div class="item-desc">{{ v.config?.description || 'Consulta de datos' }}</div>
        </div>
      </div>
    </div>

    <!-- Panel de Ejecución y Detalle -->
    <div class="view-workspace">
      <div v-if="!selectedView" class="empty-selection card">
        <h3>👈 Selecciona una vista del catálogo lateral</h3>
        <p>Podrás probarla en vivo, inspeccionar su SQL en Oracle y filtrar resultados.</p>
      </div>

      <div v-else class="view-content">
        <!-- Tarjeta de Control -->
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">{{ selectedViewName }}</h2>
              <p class="text-secondary">{{ selectedView.description || 'Consulta mapeada en Oracle 11g' }}</p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-primary" :disabled="executing" @click="runView">
                {{ executing ? '⏳ Ejecutando...' : '▶ Ejecutar Consulta' }}
              </button>
              <button class="btn btn-danger" @click="deleteView">🗑️ Desactivar</button>
            </div>
          </div>

          <!-- Barra de Endpoint y cURL -->
          <div class="endpoint-bar">
            <span class="badge badge-success">GET</span>
            <code class="endpoint-url">{{ fullRequestUrl }}</code>
            <button class="btn btn-sm" @click="copyUrl">📋 URL</button>
            <button class="btn btn-sm" @click="copyCurl">📋 cURL</button>
          </div>

          <!-- Sentencia SQL Ejecutada en Oracle -->
          <div class="sql-card">
            <div class="sql-header" @click="sqlCollapsed = !sqlCollapsed">
              <span>📜 Sentencia SQL Ejecutada en Oracle</span>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span class="badge badge-info">{{ Object.keys(selectedView.fields || {}).length }} columnas</span>
                <button class="btn btn-sm" @click.stop="copySql">📋 Copiar SQL</button>
                <button class="btn btn-sm" @click.stop="openInSqlStudio">✏️ Editar en SQL Studio</button>
                <span>{{ sqlCollapsed ? '▼' : '▲' }}</span>
              </div>
            </div>
            <pre v-if="!sqlCollapsed" class="sql-code">{{ generatedSql }}</pre>
          </div>

          <!-- Parámetros de Filtro (WhereFields & Paginación) -->
          <div class="filters-section">
            <div class="section-title">🔍 Parámetros y Filtros de Búsqueda:</div>
            <div class="form-grid">
              <div 
                v-for="(val, field) in selectedView.sql?.whereFields || {}" 
                :key="field"
                class="form-group"
              >
                <label class="form-label">{{ field }}:</label>
                <input 
                  type="text" 
                  class="form-control" 
                  v-model="queryParams[field]" 
                  :placeholder="`Filtrar por ${field}`"
                  @keyup.enter="runView"
                />
              </div>

              <!-- Paginación -->
              <div class="form-group">
                <label class="form-label">Límite (limit):</label>
                <input type="number" class="form-control" v-model.number="queryParams.limit" placeholder="50" />
              </div>
              <div class="form-group">
                <label class="form-label">Desplazamiento (offset):</label>
                <input type="number" class="form-control" v-model.number="queryParams.offset" placeholder="0" />
              </div>
              <div class="form-group">
                <label class="form-label">Columnas (fields):</label>
                <input type="text" class="form-control" v-model="queryParams.fields" placeholder="Col1,Col2 (vacío=todas)" />
              </div>
            </div>
          </div>
        </div>

        <!-- Tabla de Resultados -->
        <ResultsTable 
          :rows="results"
          :duration-ms="lastDuration"
          :error="lastError"
          title="Resultados de la Vista"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/services/api'
import { useHostStore } from '@/stores/hostStore'
import ResultsTable from '@/components/common/ResultsTable.vue'

const router = useRouter()
const hostStore = useHostStore()

const views = ref({})
const loadingCatalog = ref(false)
const searchTerm = ref('')
const selectedViewName = ref('')
const selectedView = ref(null)
const queryParams = ref({ limit: 50, offset: 0 })
const results = ref([])
const executing = ref(false)
const lastDuration = ref(0)
const lastError = ref(null)
const sqlCollapsed = ref(false)

onMounted(() => {
  loadViews()
})

async function loadViews() {
  loadingCatalog.value = true
  try {
    const res = await api.get('/api/view/list')
    views.value = res.data || {}
    if (!selectedViewName.value && Object.keys(views.value).length > 0) {
      selectView(Object.keys(views.value)[0])
    }
  } catch (err) {
    console.error('Error cargando catálogo de vistas:', err)
  } finally {
    loadingCatalog.value = false
  }
}

const filteredViews = computed(() => {
  const list = Object.entries(views.value).map(([name, config]) => ({ name, config }))
  if (!searchTerm.value.trim()) return list
  const t = searchTerm.value.toLowerCase().trim()
  return list.filter(v => v.name.toLowerCase().includes(t) || (v.config?.description || '').toLowerCase().includes(t))
})

function selectView(name) {
  selectedViewName.value = name
  selectedView.value = views.value[name]
  queryParams.value = { limit: 50, offset: 0 }
  results.value = []
  lastError.value = null
  lastDuration.value = 0
}

const generatedSql = computed(() => {
  if (!selectedView.value) return ''
  const fields = Object.entries(selectedView.value.fields || {})
    .map(([alias, expr]) => `  ${expr} AS "${alias}"`)
    .join(',\n')
  const froms = (selectedView.value.sql?.fromClause || ['FROM DUAL']).join('\n  ')
  return `SELECT\n${fields}\n${froms}`
})

const fullRequestUrl = computed(() => {
  const base = `${hostStore.bridgeUrl}/api/view/${selectedViewName.value}`
  const q = new URLSearchParams()
  Object.entries(queryParams.value).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) q.append(k, v)
  })
  const qs = q.toString()
  return `${base}${qs ? '?' + qs : ''}`
})

async function runView() {
  if (!selectedViewName.value) return
  executing.value = true
  lastError.value = null
  results.value = []

  try {
    const res = await api.get(`/api/view/${selectedViewName.value}`, queryParams.value)
    results.value = Array.isArray(res.data) ? res.data : [res.data]
    lastDuration.value = res.durationMs
  } catch (err) {
    lastError.value = err
  } finally {
    executing.value = false
  }
}

async function deleteView() {
  if (!confirm(`¿Estás seguro de desactivar la vista '${selectedViewName.value}'?`)) return
  try {
    await api.delete(`/api/view/${selectedViewName.value}`)
    alert(`Vista '${selectedViewName.value}' desactivada.`)
    await loadViews()
  } catch (err) {
    alert(`Error: ${err.message}`)
  }
}

function copyUrl() {
  navigator.clipboard.writeText(fullRequestUrl.value)
  alert('URL copiada al portapapeles')
}

function copyCurl() {
  const curl = `curl -X GET "${fullRequestUrl.value}" \\\n  -H "x-project-key: ${hostStore.activeHost.projectKey}" \\\n  -H "x-project-port: ${hostStore.activeHost.projectPort}" \\\n  -H "X-Admin-Key: ${hostStore.adminKey}"`
  navigator.clipboard.writeText(curl)
  alert('Comando cURL copiado al portapapeles')
}

function copySql() {
  navigator.clipboard.writeText(generatedSql.value)
  alert('Sentencia SQL copiada')
}

function openInSqlStudio() {
  router.push({
    path: '/sql-studio',
    query: {
      viewName: selectedViewName.value,
      sql: generatedSql.value
    }
  })
}
</script>

<style scoped>
.views-layout {
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
}

.item-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}
.catalog-item {
  padding: 8px 12px;
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
.item-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
}
.item-desc {
  font-size: 0.72rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.view-workspace {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: var(--bg-app);
}

.view-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.endpoint-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  margin-bottom: 14px;
}
.endpoint-url {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--color-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sql-card {
  background: #0F172A;
  border: 1px solid #1E293B;
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: 14px;
}
.sql-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #1E293B;
  color: #F8FAFC;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}
.sql-code {
  margin: 0;
  border: none;
  border-radius: 0;
  max-height: 220px;
}

.filters-section {
  border-top: 1px solid var(--border-color);
  padding-top: 14px;
}
.section-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 10px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 12px;
}

.empty-selection {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}
</style>
