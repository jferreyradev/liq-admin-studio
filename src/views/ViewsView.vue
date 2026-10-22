<template>
  <div class="views-layout">
    <!-- Lista Lateral de Vistas -->
    <div class="catalog-sidebar">
      <div class="search-header">
        <input
          type="text"
          class="form-control"
          placeholder="Buscar consulta o tabla..."
          v-model="searchTerm"
        />
        <div class="meta-row">
          <span class="badge badge-info">
            {{ filteredViews.length }} de {{ catalogStore.viewsCount }} vistas
          </span>
          <div class="sidebar-tools">
            <button
              class="btn btn-sm"
              @click="triggerImportJson"
              title="Importar lote de vistas desde archivo JSON a Oracle (API_VIEW_MAPPER)"
            >
              📁
            </button>
            <button
              class="btn btn-sm"
              @click="catalogStore.exportViewsJson()"
              :title="catalogStore.selectedViewsCount > 0 ? `Exportar las ${catalogStore.selectedViewsCount} vistas seleccionadas a JSON` : 'Exportar todas las vistas de este servidor a JSON'"
            >
              📤 {{ catalogStore.selectedViewsCount > 0 ? `(${catalogStore.selectedViewsCount})` : '' }}
            </button>
            <button
              class="btn btn-sm"
              @click="reloadViews"
              :disabled="catalogStore.loadingViews"
              title="Recargar listado de vistas"
            >
              {{ catalogStore.loadingViews ? '...' : '🔄' }}
            </button>
          </div>
        </div>

        <!-- Controles de Selección para Análisis de Agente IA / Exportación Selectiva -->
        <div class="selection-toolbar">
          <button
            type="button"
            class="btn-link"
            @click="selectFilteredViews"
            title="Marcar todas las vistas filtradas actualmente"
          >
            ☑️ Marcar filtradas ({{ filteredViews.length }})
          </button>
          <span v-if="catalogStore.selectedViewsCount > 0">•</span>
          <button
            v-if="catalogStore.selectedViewsCount > 0"
            type="button"
            class="btn-link"
            @click="onlyShowSelected = !onlyShowSelected"
          >
            {{ onlyShowSelected ? 'Ver todas' : `Ver marcadas (${catalogStore.selectedViewsCount})` }}
          </button>
          <span v-if="catalogStore.selectedViewsCount > 0">•</span>
          <button
            v-if="catalogStore.selectedViewsCount > 0"
            type="button"
            class="btn-link text-danger"
            @click="clearViewSelection"
          >
            ✕ Limpiar
          </button>
        </div>

        <!-- Barra de Exportación para Agente IA cuando hay ítems seleccionados -->
        <div v-if="catalogStore.totalSelectedForAgent > 0" class="agent-selection-box">
          <div class="agent-box-header">
            <span>🤖 <strong>Selección para Agente IA:</strong></span>
            <span class="agent-counts">
              {{ catalogStore.selectedViewsCount }} Vistas · {{ catalogStore.selectedSpCount }} SPs · {{ catalogStore.selectedFnCount }} FNs
            </span>
          </div>
          <div class="agent-box-actions">
            <button
              class="btn btn-sm btn-primary"
              @click="catalogStore.exportAgentBundleJson()"
              title="Descargar JSON unificado con SQL, parámetros y reglas de dominio para un Agente IA"
            >
              🤖 Descargar JSON Agente
            </button>
            <button
              class="btn btn-sm"
              @click="catalogStore.copyAgentBundleClipboard()"
              title="Copiar JSON de contexto al portapapeles para pegar directamente en el chat del Agente IA"
            >
              📋 Copiar
            </button>
            <button
              v-if="catalogStore.selectedViewsCount > 0"
              class="btn btn-sm"
              @click="catalogStore.exportViewsJson()"
              title="Descargar únicamente el catálogo JSON de las vistas seleccionadas"
            >
              📤 Solo Vistas
            </button>
          </div>
        </div>

        <input
          ref="jsonFileInput"
          type="file"
          accept=".json"
          style="display: none;"
          @change="onJsonFileSelected"
        />
      </div>

      <div class="item-list">
        <div
          v-for="v in displayedViews"
          :key="v.name"
          class="catalog-item"
          :class="{
            active: selectedViewName === v.name,
            checked: catalogStore.selectedViews.includes(v.name)
          }"
          @click="selectView(v.name)"
        >
          <div class="item-header-row">
            <div class="item-title-group">
              <input
                type="checkbox"
                class="item-checkbox"
                :checked="catalogStore.selectedViews.includes(v.name)"
                @click.stop="catalogStore.toggleViewSelection(v.name)"
                title="Seleccionar esta vista para exportar a JSON o proveer a un Agente IA"
              />
              <div class="item-title">{{ v.name }}</div>
            </div>
            <span
              class="mini-badge"
              :class="hasWhereFieldsFor(v.config) ? 'mini-fixed' : 'mini-open'"
              :title="hasWhereFieldsFor(v.config) ? 'Filtra por parámetros WHERE' : 'Permite filtrar por cualquier columna'"
            >
              {{ hasWhereFieldsFor(v.config) ? 'WHERE' : 'OPEN' }}
            </span>
          </div>
          <div class="item-desc">
            {{ v.config?.description || v.config?.sql?.fromClause?.[0] || 'Consulta SQL' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Panel de Ejecución y Detalle -->
    <div class="view-workspace">
      <div v-if="!selectedView" class="empty-selection card">
        <h3>👈 Selecciona una vista del catálogo lateral</h3>
        <p>Podrás probarla en vivo, inspeccionar su SQL en Oracle, proyectar columnas y filtrar resultados.</p>
      </div>

      <div v-else class="view-content">
        <!-- Tarjeta de Control -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="title-with-badge">
                <h2 class="card-title">{{ selectedViewName }}</h2>
                <span
                  class="badge"
                  :class="hasWhereFields ? 'badge-info' : 'badge-warning'"
                >
                  {{ hasWhereFields ? `🎯 Parámetros Fijos (${whereKeys.length})` : `🌐 Filtros Abiertos (${fieldKeys.length} columnas)` }}
                </span>
              </div>
              <p class="view-subtitle" v-if="hasWhereFields">
                Filtra preferentemente por <code>{{ whereKeys.join(', ') }}</code> sobre <code>{{ selectedView.sql?.fromClause?.[0] || 'Oracle' }}</code>.
              </p>
              <p class="view-subtitle" v-else>
                Sin restricción fija en WHERE: permite filtrar por cualquiera de sus <strong>{{ fieldKeys.length }} columnas</strong>.
              </p>
            </div>
            <div class="header-btn-group">
              <button
                class="btn btn-sm"
                @click="catalogStore.exportViewsJson([selectedViewName])"
                title="Descargar definición JSON únicamente de esta vista"
              >
                📤 JSON Vista
              </button>
              <button
                class="btn btn-sm"
                @click="catalogStore.exportAgentBundleJson({ view: selectedViewName })"
                :title="catalogStore.totalSelectedForAgent > 0 ? `Descargar bundle para Agente IA (${catalogStore.totalSelectedForAgent} seleccionados)` : 'Descargar contexto enriquecido de esta vista para análisis de un Agente IA'"
              >
                🤖 {{ catalogStore.totalSelectedForAgent > 0 ? `JSON Agente (${catalogStore.totalSelectedForAgent})` : 'Para Agente IA' }}
              </button>
              <button class="btn btn-sm" @click="clearFilters" title="Restablecer filtros">
                🧹 Limpiar
              </button>
              <button class="btn btn-primary" :disabled="executing" @click="runView">
                {{ executing ? '⏳ Ejecutando...' : '▶ Ejecutar Consulta' }}
              </button>
              <button class="btn btn-danger" @click="deleteView" title="Desactivar vista en API_VIEW_MAPPER">
                🗑️ Desactivar
              </button>
            </div>
          </div>

          <!-- Barra de Endpoint y cURL -->
          <div class="endpoint-bar">
            <span class="badge badge-success">GET</span>
            <code class="endpoint-url">{{ relativeRequestUrl }}</code>
            <div class="endpoint-actions">
              <button class="btn btn-sm" @click="copyUrl" title="Copiar URL completa">📋 URL</button>
              <button class="btn btn-sm" @click="copyCurl" title="Copiar comando cURL">📋 cURL</button>
              <button class="btn btn-sm" @click="openInExplorer" title="Personalizar petición en API Explorer">🚀 Explorer</button>
            </div>
          </div>

          <!-- Sentencia SQL Ejecutada en Oracle -->
          <div class="sql-card">
            <div class="sql-header" @click="sqlCollapsed = !sqlCollapsed">
              <div class="sql-header-left">
                <span>{{ sqlCollapsed ? '▶' : '▼' }}</span>
                <span>📜 Sentencia SQL Ejecutada en Oracle</span>
                <span class="sql-meta-pill">{{ sqlMetaSummary }}</span>
              </div>
              <div style="display: flex; gap: 6px; align-items: center;" @click.stop>
                <button class="btn btn-sm btn-dark" @click="copySql">📋 Copiar SQL</button>
                <button class="btn btn-sm btn-dark" @click="openInSqlStudio">✏️ Editar en SQL Studio</button>
              </div>
            </div>
            <pre v-if="!sqlCollapsed" class="sql-code">{{ generatedSql }}</pre>
          </div>

          <!-- Selector rápido de Columnas (fields) -->
          <div class="columns-selector-section" v-if="fieldKeys.length > 0">
            <div class="section-header-row">
              <span class="section-title" style="margin-bottom: 0;">
                📊 Proyección de Columnas (<code>fields</code>):
              </span>
              <div class="col-quick-actions">
                <button class="btn-link" @click="selectAllColumns">Todas ({{ fieldKeys.length }})</button>
                <span>•</span>
                <button class="btn-link" @click="toggleColumnPills = !toggleColumnPills">
                  {{ toggleColumnPills ? 'Ocultar selector' : 'Seleccionar columnas' }}
                </button>
              </div>
            </div>

            <div v-if="toggleColumnPills" class="column-pills">
              <button
                v-for="col in fieldKeys"
                :key="col"
                type="button"
                class="col-pill"
                :class="{ selected: selectedColumnsList.includes(col) }"
                @click="toggleColumnSelection(col)"
              >
                {{ col }}
              </button>
            </div>
          </div>

          <!-- Parámetros de Filtro (WhereFields / Columnas & Paginación) -->
          <div class="filters-section">
            <div class="section-header-row">
              <div class="section-title" style="margin-bottom: 0;">
                {{ hasWhereFields ? '⚡ Parámetros de Consulta (whereFields):' : '🔍 Filtros por Columna (Opcionales):' }}
              </div>
            </div>

            <div class="form-grid" style="margin-top: 10px;">
              <div
                v-for="field in filterableFields"
                :key="field"
                class="form-group"
              >
                <label class="form-label" style="display: flex; align-items: center; justify-content: space-between;">
                  <span>{{ field }}:</span>
                  <span v-if="isPeriodoField(field)" class="badge badge-info" style="font-size: 0.65rem;" title="Regla de la API: El día es siempre 01">📅 PERÍODO (Día 01)</span>
                </label>
                <input
                  type="text"
                  class="form-control"
                  v-model="filterValues[field]"
                  :placeholder="isPeriodoField(field) ? 'Ej: 09/2026 o 01/09/2026 (Día 01 fijo)' : `Filtrar ${field}...`"
                  @keyup.enter="runView"
                />
                <span v-if="isPeriodoField(field) && filterValues[field]" class="periodo-preview-hint">
                  ➔ Se enviará como: <code>{{ normalizePeriodoFilter(filterValues[field], field) }}</code>
                </span>
              </div>
            </div>

            <!-- Parámetros de Motor baseQuery (Paginación, Search LIKE, Sort, Fields) -->
            <div class="engine-params-row">
              <div class="form-group">
                <label class="form-label">Límite (limit):</label>
                <input type="number" class="form-control" v-model.number="limit" placeholder="50" @keyup.enter="runView" />
              </div>

              <div class="form-group">
                <label class="form-label">Offset (Paginación):</label>
                <div class="offset-control">
                  <button class="btn btn-sm" @click="prevPage" :disabled="offset <= 0 || executing" title="Página anterior">◀</button>
                  <input type="number" class="form-control" v-model.number="offset" placeholder="0" @keyup.enter="runView" />
                  <button class="btn btn-sm" @click="nextPage" :disabled="executing" title="Página siguiente">▶</button>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Búsqueda LIKE (search):</label>
                <input
                  type="text"
                  class="form-control"
                  v-model="searchParam"
                  :placeholder="fieldKeys[0] ? `Ej: ${fieldKeys[0]}:texto` : 'Campo:texto'"
                  @keyup.enter="runView"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Ordenamiento (sort):</label>
                <input
                  type="text"
                  class="form-control"
                  v-model="sortParam"
                  :placeholder="fieldKeys[0] ? `Ej: {&quot;${fieldKeys[0]}&quot;:&quot;asc&quot;}` : '{&quot;Campo&quot;:&quot;asc&quot;}'"
                  @keyup.enter="runView"
                />
              </div>

              <div class="form-group" style="grid-column: 1 / -1;">
                <label class="form-label">Columnas proyectadas (fields - separadas por coma):</label>
                <input
                  type="text"
                  class="form-control"
                  v-model="fieldsParam"
                  :placeholder="`Vacío = todas (${fieldKeys.slice(0, 4).join(', ')}...)`"
                  @keyup.enter="runView"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Tabla de Resultados -->
        <ResultsTable
          :rows="results"
          :duration-ms="lastDuration"
          :error="lastError"
          :loading="executing"
          title="Resultados de la Consulta"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '@/services/api'
import { useHostStore } from '@/stores/hostStore'
import { useCatalogStore, buildSqlFromViewConfig } from '@/stores/catalogStore'
import ResultsTable from '@/components/common/ResultsTable.vue'

const router = useRouter()
const route = useRoute()
const hostStore = useHostStore()
const catalogStore = useCatalogStore()

const searchTerm = ref('')
const selectedViewName = ref('')
const onlyShowSelected = ref(false)
const filterValues = ref({})
const limit = ref(50)
const offset = ref(0)
const fieldsParam = ref('')
const searchParam = ref('')
const sortParam = ref('')
const toggleColumnPills = ref(false)

const results = ref([])
const executing = ref(false)
const lastDuration = ref(0)
const lastError = ref(null)
const sqlCollapsed = ref(false)
const jsonFileInput = ref(null)

onMounted(async () => {
  if (catalogStore.viewsCount === 0) {
    await catalogStore.loadViews()
  }
  const initialView = route.query.view ? String(route.query.view) : Object.keys(catalogStore.views)[0]
  if (initialView && catalogStore.views[initialView]) {
    selectView(initialView)
  }
})

watch(
  () => catalogStore.views,
  (newViews) => {
    const keys = Object.keys(newViews || {})
    if (keys.length > 0 && (!selectedViewName.value || !newViews[selectedViewName.value])) {
      selectView(keys[0])
    }
  }
)

async function reloadViews() {
  await catalogStore.loadViews()
  hostStore.showToast(`Catálogo actualizado (${catalogStore.viewsCount} vistas)`, 'info')
}

function hasWhereFieldsFor(config) {
  return Boolean(config?.sql?.whereFields && Object.keys(config.sql.whereFields).length > 0)
}

const filteredViews = computed(() => {
  const list = Object.entries(catalogStore.views || {}).map(([name, config]) => ({ name, config }))
  if (!searchTerm.value.trim()) return list
  const t = searchTerm.value.toLowerCase().trim()
  return list.filter(v =>
    v.name.toLowerCase().includes(t) ||
    (v.config?.description || '').toLowerCase().includes(t) ||
    (v.config?.sql?.fromClause?.join(' ') || '').toLowerCase().includes(t)
  )
})

const displayedViews = computed(() => {
  if (!onlyShowSelected.value) return filteredViews.value
  return filteredViews.value.filter(v => catalogStore.selectedViews.includes(v.name))
})

function selectFilteredViews() {
  catalogStore.selectViews(filteredViews.value.map(v => v.name))
  hostStore.showToast(`Se marcaron ${filteredViews.value.length} vistas`, 'info')
}

function clearViewSelection() {
  catalogStore.clearSelectedViews()
  onlyShowSelected.value = false
}

const selectedView = computed(() => {
  if (!selectedViewName.value) return null
  return catalogStore.views[selectedViewName.value] || null
})

const hasWhereFields = computed(() => hasWhereFieldsFor(selectedView.value))

const whereKeys = computed(() => {
  if (!hasWhereFields.value) return []
  return Object.keys(selectedView.value?.sql?.whereFields || {})
})

const fieldKeys = computed(() => {
  return Object.keys(selectedView.value?.fields || {})
})

const filterableFields = computed(() => {
  return hasWhereFields.value ? whereKeys.value : fieldKeys.value
})

const selectedColumnsList = computed(() => {
  if (!fieldsParam.value.trim()) return []
  return fieldsParam.value.split(',').map(s => s.trim()).filter(Boolean)
})

function toggleColumnSelection(col) {
  const current = new Set(selectedColumnsList.value)
  if (current.has(col)) {
    current.delete(col)
  } else {
    current.add(col)
  }
  fieldsParam.value = Array.from(current).join(',')
}

function selectAllColumns() {
  fieldsParam.value = ''
}

function selectView(name) {
  selectedViewName.value = name
  filterValues.value = {}
  limit.value = 50
  offset.value = 0
  fieldsParam.value = ''
  searchParam.value = ''
  sortParam.value = ''
  results.value = []
  lastError.value = null
  lastDuration.value = 0
}

function clearFilters() {
  filterValues.value = {}
  limit.value = 50
  offset.value = 0
  fieldsParam.value = ''
  searchParam.value = ''
  sortParam.value = ''
}

const generatedSql = computed(() => buildSqlFromViewConfig(selectedView.value))

const sqlMetaSummary = computed(() => {
  if (!selectedView.value) return ''
  const cols = fieldKeys.value.length
  const tables = Array.isArray(selectedView.value.sql?.fromClause) ? selectedView.value.sql.fromClause.length : 1
  const wheres = whereKeys.value.length
  const parts = [`${cols} columnas`, `${tables} ${tables === 1 ? 'origen' : 'joins/tablas'}`]
  if (wheres > 0) parts.push(`${wheres} filtros WHERE`)
  return parts.join(' • ')
})

function isPeriodoField(fieldName) {
  const lower = String(fieldName || '').toLowerCase()
  return lower.includes('periodo') || lower === 'per' || lower === 'vper'
}

function normalizePeriodoFilter(rawVal, fieldName) {
  if (rawVal === undefined || rawVal === null) return ''
  const trimmed = String(rawVal).trim()
  if (!trimmed || !isPeriodoField(fieldName)) return trimmed

  // 1. DD/MM/YYYY o D/M/YYYY -> siempre día 01: 01/MM/YYYY
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    return `01/${String(parseInt(dmy[2], 10)).padStart(2, '0')}/${dmy[3]}`
  }

  // 2. MM/YYYY o M/YYYY -> 01/MM/YYYY
  const my = trimmed.match(/^(\d{1,2})\/(\d{4})$/)
  if (my) {
    return `01/${String(parseInt(my[1], 10)).padStart(2, '0')}/${my[2]}`
  }

  // 3. YYYY-MM o YYYY-MM-DD -> 01/MM/YYYY
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/)
  if (iso) {
    return `01/${String(parseInt(iso[2], 10)).padStart(2, '0')}/${iso[1]}`
  }

  // 4. Compacto YYYYMM (202609) o MMYYYY (092026) -> 01/MM/YYYY
  if (/^\d{6}$/.test(trimmed)) {
    const firstFour = parseInt(trimmed.slice(0, 4), 10)
    const lastTwo = parseInt(trimmed.slice(4, 6), 10)
    if (firstFour >= 1990 && firstFour <= 2100 && lastTwo >= 1 && lastTwo <= 12) {
      return `01/${String(lastTwo).padStart(2, '0')}/${firstFour}`
    }
    const firstTwo = parseInt(trimmed.slice(0, 2), 10)
    const lastFour = parseInt(trimmed.slice(2, 6), 10)
    if (lastFour >= 1990 && lastFour <= 2100 && firstTwo >= 1 && firstTwo <= 12) {
      return `01/${String(firstTwo).padStart(2, '0')}/${lastFour}`
    }
  }

  return trimmed
}

const activeQueryParams = computed(() => {
  const params = {}
  if (fieldsParam.value.trim()) params.fields = fieldsParam.value.trim()
  if (limit.value !== '' && limit.value !== null && limit.value !== undefined) params.limit = limit.value
  if (offset.value && Number(offset.value) > 0) params.offset = offset.value
  if (searchParam.value.trim()) params.search = searchParam.value.trim()
  if (sortParam.value.trim()) params.sort = sortParam.value.trim()

  Object.entries(filterValues.value).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      params[k] = normalizePeriodoFilter(v, k)
    }
  })
  return params
})

const relativeRequestUrl = computed(() => {
  const q = new URLSearchParams()
  Object.entries(activeQueryParams.value).forEach(([k, v]) => q.append(k, String(v)))
  const qs = q.toString()
  return `/api/view/${selectedViewName.value}${qs ? '?' + qs : ''}`
})

const fullRequestUrl = computed(() => {
  return api.buildUrl(`/api/view/${selectedViewName.value}`, activeQueryParams.value)
})

async function runView() {
  if (!selectedViewName.value) return
  executing.value = true
  lastError.value = null
  results.value = []

  try {
    const res = await api.get(`/api/view/${selectedViewName.value}`, activeQueryParams.value)
    results.value = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : [])
    lastDuration.value = res.durationMs
    hostStore.showToast(`Consulta exitosa: ${results.value.length} registros (${res.durationMs} ms)`, 'success')
  } catch (err) {
    if (err.status === 404) {
      results.value = []
      lastDuration.value = err.durationMs || 0
      hostStore.showToast('Consulta finalizada: 0 registros encontrados para esos filtros', 'warning')
    } else {
      lastError.value = err
      hostStore.showToast(`Error: ${err.message}`, 'error')
    }
  } finally {
    executing.value = false
  }
}

function prevPage() {
  const step = Number(limit.value) || 50
  offset.value = Math.max(0, (Number(offset.value) || 0) - step)
  runView()
}

function nextPage() {
  const step = Number(limit.value) || 50
  offset.value = (Number(offset.value) || 0) + step
  runView()
}

async function deleteView() {
  if (!confirm(`¿Estás seguro de desactivar la vista '${selectedViewName.value}' en API_VIEW_MAPPER?`)) return
  try {
    await api.delete(`/api/view/${selectedViewName.value}`)
    hostStore.showToast(`Vista '${selectedViewName.value}' desactivada con éxito`, 'success')
    selectedViewName.value = ''
    await catalogStore.loadViews()
  } catch (err) {
    hostStore.showToast(`Error al desactivar: ${err.message}`, 'error')
  }
}

function copyUrl() {
  navigator.clipboard.writeText(fullRequestUrl.value)
  hostStore.showToast('URL copiada al portapapeles', 'success')
}

function copyCurl() {
  const curl = api.buildCurl({
    method: 'GET',
    path: `/api/view/${selectedViewName.value}`,
    queryParams: activeQueryParams.value
  })
  navigator.clipboard.writeText(curl)
  hostStore.showToast('Comando cURL copiado al portapapeles', 'success')
}

function copySql() {
  navigator.clipboard.writeText(generatedSql.value)
  hostStore.showToast('Sentencia SQL copiada al portapapeles', 'success')
}

function openInSqlStudio() {
  router.push({
    path: '/sql-studio',
    query: {
      viewName: selectedViewName.value,
      description: selectedView.value?.description || `Consulta basada en ${selectedViewName.value}`,
      sql: generatedSql.value
    }
  })
}

function openInExplorer() {
  router.push({
    path: '/explorer',
    query: {
      method: 'GET',
      endpoint: `/api/view/${selectedViewName.value}`,
      params: JSON.stringify(activeQueryParams.value)
    }
  })
}

function triggerImportJson() {
  if (jsonFileInput.value) {
    jsonFileInput.value.value = ''
    jsonFileInput.value.click()
  }
}

async function onJsonFileSelected(e) {
  const file = e.target.files?.[0]
  if (file) {
    await catalogStore.importViewsJsonFile(file)
  }
}
</script>

<style scoped>
.views-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.catalog-sidebar {
  width: 300px;
  min-width: 300px;
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
.sidebar-tools {
  display: flex;
  gap: 4px;
}

.selection-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: var(--text-muted);
  flex-wrap: wrap;
}
.text-danger {
  color: #DC2626 !important;
}

.agent-selection-box {
  background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%);
  border: 1px solid #C4B5FD;
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.agent-box-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.73rem;
  color: #4C1D95;
}
.agent-counts {
  font-size: 0.68rem;
  font-weight: 700;
  background: #DDD6FE;
  color: #5B21B6;
  padding: 1px 6px;
  border-radius: 9999px;
}
.agent-box-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
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
.catalog-item.checked {
  background-color: rgba(124, 58, 237, 0.05);
}
.catalog-item.active {
  background-color: rgba(106, 27, 154, 0.08);
  border-left-color: var(--color-primary);
}
.item-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.item-title-group {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  flex: 1;
}
.item-checkbox {
  cursor: pointer;
  accent-color: var(--color-primary);
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.item-title {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-badge {
  font-size: 0.62rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  flex-shrink: 0;
}
.mini-fixed {
  background: var(--color-info-bg);
  color: var(--color-info);
}
.mini-open {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}
.item-desc {
  font-size: 0.72rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
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

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.view-subtitle {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 4px;
}
.header-btn-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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
  flex-wrap: wrap;
}
.endpoint-url {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--color-primary);
  flex: 1;
  min-width: 200px;
  word-break: break-all;
}
.endpoint-actions {
  display: flex;
  gap: 6px;
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
  flex-wrap: wrap;
  gap: 8px;
}
.sql-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sql-meta-pill {
  background: rgba(56, 189, 248, 0.15);
  color: #38BDF8;
  border: 1px solid rgba(56, 189, 248, 0.3);
  font-size: 0.7rem;
  padding: 1px 8px;
  border-radius: 9999px;
}
.btn-dark {
  background: rgba(255, 255, 255, 0.1);
  color: #F8FAFC;
  border-color: rgba(255, 255, 255, 0.2);
}
.btn-dark:hover {
  background: rgba(255, 255, 255, 0.2);
}
.sql-code {
  margin: 0;
  border: none;
  border-radius: 0;
  max-height: 240px;
}

.columns-selector-section {
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  margin-bottom: 14px;
}
.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.col-quick-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  color: var(--text-muted);
}
.btn-link {
  background: none;
  border: none;
  color: var(--color-primary);
  font-weight: 700;
  font-size: 0.76rem;
  cursor: pointer;
}
.btn-link:hover {
  text-decoration: underline;
}
.column-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.col-pill {
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  color: var(--text-secondary);
  padding: 3px 9px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.col-pill.selected {
  background: var(--color-primary);
  color: #FFFFFF;
  border-color: var(--color-primary);
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
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.periodo-preview-hint {
  font-size: 0.7rem;
  color: var(--color-primary);
  margin-top: 3px;
  word-break: break-all;
}
.engine-params-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 12px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--border-color);
}
.offset-control {
  display: flex;
  gap: 4px;
  align-items: center;
}
.offset-control input {
  flex: 1;
  min-width: 70px;
  text-align: center;
}

.empty-selection {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}
</style>
