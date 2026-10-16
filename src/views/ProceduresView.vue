<template>
  <div class="proc-layout">
    <!-- Lista Lateral de SPs y FNs -->
    <div class="catalog-sidebar">
      <div class="search-header">
        <div class="type-selector">
          <button
            class="tab-btn"
            :class="{ active: currentType === 'sp' }"
            @click="switchType('sp')"
          >
            ⚡ Stored Procedures ({{ spList.length }})
          </button>
          <button
            class="tab-btn"
            :class="{ active: currentType === 'fn' }"
            @click="switchType('fn')"
          >
            ƒ(x) Funciones ({{ fnList.length }})
          </button>
        </div>

        <div class="search-input-row">
          <input
            type="text"
            class="form-control"
            placeholder="Buscar procedimiento o paquete..."
            v-model="searchTerm"
          />
          <button
            class="btn btn-sm"
            @click="reloadProcedures"
            :disabled="catalogStore.loadingProcedures"
            title="Recargar catálogo de SPs y Funciones"
          >
            {{ catalogStore.loadingProcedures ? '...' : '🔄' }}
          </button>
        </div>
      </div>

      <div class="item-list">
        <div
          v-for="item in filteredItems"
          :key="item.name"
          class="catalog-item"
          :class="{ active: selectedItemName === item.name }"
          @click="selectItem(item.name)"
        >
          <div class="item-title">{{ item.name }}</div>
          <div class="item-desc">{{ item.config?.sp_name || item.config?.fn_name || 'PL/SQL' }}</div>
        </div>
      </div>
    </div>

    <!-- Workspace de Parámetros y Ejecución -->
    <div class="proc-workspace">
      <div v-if="!selectedItem" class="empty-selection card">
        <h3>👈 Selecciona un procedimiento o función</h3>
        <p>Completa sus parámetros de entrada y pruébalo con inspección de llamada PL/SQL y binds en vivo.</p>
      </div>

      <div v-else class="proc-content">
        <!-- Control Card -->
        <div class="card">
          <div class="card-header">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="badge" :class="currentType === 'sp' ? 'badge-info' : 'badge-warning'">
                  {{ currentType.toUpperCase() }}
                </span>
                <h2 class="card-title">{{ selectedItemName }}</h2>
              </div>
              <p class="text-secondary" style="margin-top: 4px; font-size: 0.8rem;">
                Oracle Target: <code>{{ selectedItem.sp_name || selectedItem.fn_name }}</code>
              </p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-sm" @click="inputParams = {}" :disabled="executing">🧹 Limpiar</button>
              <button class="btn btn-primary" :disabled="executing" @click="runProcedure">
                {{ executing ? `⏳ Ejecutando (${elapsedSeconds}s)...` : '▶ Ejecutar en Oracle' }}
              </button>
            </div>
          </div>

          <!-- Barra de Endpoint y Acciones -->
          <div class="endpoint-bar">
            <span class="badge badge-info">POST</span>
            <code class="endpoint-url">{{ currentEndpoint }}</code>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-sm" @click="copyCurl" title="Copiar comando cURL">📋 Copiar cURL</button>
              <button class="btn btn-sm" @click="openInExplorer" title="Abrir en API Explorer">🚀 Probar en Explorer</button>
            </div>
          </div>

          <!-- Live PL/SQL Preview Card -->
          <div class="plsql-card">
            <div class="plsql-header" @click="plsqlCollapsed = !plsqlCollapsed">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span>{{ plsqlCollapsed ? '▶' : '▼' }}</span>
                <span>📜 Cuerpo de la Llamada PL/SQL (Oracle)</span>
                <span class="plsql-meta-badge">
                  {{ (selectedItem.in_param || []).length }} IN | {{ (selectedItem.out_param || []).length }} OUT
                </span>
              </div>
              <div style="display: flex; gap: 6px;" @click.stop>
                <button class="btn btn-sm btn-dark" @click="copyPlSql">📋 Copiar PL/SQL</button>
              </div>
            </div>
            <pre v-if="!plsqlCollapsed" class="plsql-code">{{ generatedPlSql }}</pre>
          </div>

          <!-- Formulario de Parámetros de Entrada -->
          <div class="params-section">
            <div class="section-title">📥 Parámetros de Entrada (IN):</div>
            <div v-if="!selectedItem.in_param || selectedItem.in_param.length === 0" class="no-params">
              Este procedimiento no requiere parámetros de entrada (IN).
            </div>
            <div v-else class="form-grid">
              <div
                v-for="param in selectedItem.in_param"
                :key="param"
                class="form-group"
              >
                <label class="form-label">{{ param }}:</label>
                <input
                  type="text"
                  class="form-control"
                  v-model="inputParams[param]"
                  :disabled="executing"
                  :placeholder="`Valor para ${param}`"
                  @keyup.enter="runProcedure"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Estado de Ejecución Activo con Cronómetro -->
        <div v-if="executing" class="card loading-card">
          <div class="loading-spinner">⏳</div>
          <div class="loading-title">Ejecutando Stored Procedure en Oracle...</div>
          <div class="loading-timer">Tiempo transcurrido: {{ elapsedSeconds }}s</div>
          <div class="loading-sub">
            Por favor aguarde, la conexión a la base de datos se mantiene abierta hasta finalizar el procedimiento.
          </div>
        </div>

        <!-- Error de Ejecución -->
        <div v-if="lastError" class="card error-box">
          <div class="error-title">❌ Error de Ejecución en Oracle ({{ lastError.status || 'Fallo' }}):</div>
          <div class="error-msg">{{ lastError.message }}</div>

          <div v-if="isPls306Error" class="pls-diag">
            💡 <strong>Diagnóstico PLS-00306:</strong> Error en número o tipos de argumentos en la llamada a
            <code>{{ selectedItem.sp_name || selectedItemName }}</code>. Verifique que todos los parámetros requeridos tengan el tipo esperado.
          </div>

          <div class="error-detail">
            <span class="detail-label">Bloque PL/SQL Invocado:</span>
            <pre>{{ lastError.data?.call || generatedPlSql }}</pre>
          </div>
          <div class="error-detail" v-if="Object.keys(coercedPayload).length > 0">
            <span class="detail-label">Parámetros / Binds Enviados:</span>
            <pre>{{ JSON.stringify(lastError.data?.params || coercedPayload, null, 2) }}</pre>
          </div>
        </div>

        <!-- Resultados de la Ejecución -->
        <div v-if="executionResult" class="card">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <h3 class="card-title">✅ Retorno del Procedimiento</h3>
              <span class="badge badge-success">{{ lastDuration }} ms</span>
            </div>
            <button class="btn btn-sm" @click="copyResultJson">📋 Copiar Salida JSON</button>
          </div>

          <!-- Parámetros OUT -->
          <div v-if="executionResult.out" style="margin-bottom: 14px;">
            <div class="section-title">📤 Parámetros de Salida (OUT Binds):</div>
            <pre>{{ JSON.stringify(executionResult.out, null, 2) }}</pre>
          </div>

          <!-- Respuesta completa -->
          <div>
            <div class="section-title">Respuesta JSON Completa:</div>
            <pre>{{ JSON.stringify(executionResult, null, 2) }}</pre>
          </div>
        </div>

        <!-- Si el SP devuelve filas tabulares (cursor / rows) -->
        <ResultsTable
          v-if="tabularRows.length > 0"
          :rows="tabularRows"
          :duration-ms="lastDuration"
          title="Registros Devueltos por el Procedimiento"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/services/api'
import { useHostStore } from '@/stores/hostStore'
import { useCatalogStore } from '@/stores/catalogStore'
import ResultsTable from '@/components/common/ResultsTable.vue'

const router = useRouter()
const hostStore = useHostStore()
const catalogStore = useCatalogStore()

const currentType = ref('sp')
const searchTerm = ref('')
const selectedItemName = ref('')
const inputParams = ref({})
const plsqlCollapsed = ref(false)

const executing = ref(false)
const elapsedSeconds = ref(0)
let timerInterval = null

const executionResult = ref(null)
const lastError = ref(null)
const lastDuration = ref(0)

onMounted(async () => {
  if (catalogStore.spCount === 0 && catalogStore.fnCount === 0) {
    await catalogStore.loadProcedures()
  }
  if (spList.value.length > 0) {
    selectItem(spList.value[0].name)
  }
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})

watch(
  () => [catalogStore.sp, catalogStore.fn],
  () => {
    if (!selectedItemName.value && currentList.value.length > 0) {
      selectItem(currentList.value[0].name)
    }
  }
)

async function reloadProcedures() {
  await catalogStore.loadProcedures()
  hostStore.showToast(
    `Catálogo recargado: ${catalogStore.spCount} SPs y ${catalogStore.fnCount} Funciones`,
    'info'
  )
}

const spList = computed(() =>
  Object.entries(catalogStore.sp || {}).map(([name, config]) => ({ name, config }))
)
const fnList = computed(() =>
  Object.entries(catalogStore.fn || {}).map(([name, config]) => ({ name, config }))
)

const currentList = computed(() => (currentType.value === 'sp' ? spList.value : fnList.value))

const filteredItems = computed(() => {
  if (!searchTerm.value.trim()) return currentList.value
  const t = searchTerm.value.toLowerCase().trim()
  return currentList.value.filter(item => {
    return (
      item.name.toLowerCase().includes(t) ||
      (item.config?.sp_name || item.config?.fn_name || '').toLowerCase().includes(t)
    )
  })
})

const selectedItem = computed(() => {
  if (!selectedItemName.value) return null
  const map = currentType.value === 'sp' ? catalogStore.sp : catalogStore.fn
  return map?.[selectedItemName.value] || null
})

const currentEndpoint = computed(() => {
  if (!selectedItemName.value) return '/api/sp/...'
  return currentType.value === 'sp'
    ? `/api/sp/${selectedItemName.value}`
    : `/api/fn/${selectedItemName.value}`
})

function switchType(type) {
  currentType.value = type
  selectedItemName.value = ''
  if (currentList.value.length > 0) {
    selectItem(currentList.value[0].name)
  }
}

function selectItem(name) {
  selectedItemName.value = name
  inputParams.value = {}
  executionResult.value = null
  lastError.value = null
}

const coercedPayload = computed(() => {
  const payload = {}
  for (const [k, v] of Object.entries(inputParams.value)) {
    if (v === '' || v === undefined || v === null) continue
    const trimmed = typeof v === 'string' ? v.trim() : v
    if (typeof trimmed === 'string' && /^-?\d+(\.\d+)?$/.test(trimmed)) {
      payload[k] = Number(trimmed)
    } else {
      payload[k] = trimmed
    }
  }
  return payload
})

const generatedPlSql = computed(() => {
  if (!selectedItem.value) return ''
  const name = selectedItem.value.sp_name || selectedItem.value.fn_name || selectedItemName.value
  const parts = []

  ;(selectedItem.value.in_param || []).forEach(p => {
    const val = inputParams.value[p]
    if (val !== undefined && val !== '') {
      parts.push(`  :${p} /* ${JSON.stringify(coercedPayload.value[p] ?? val)} */`)
    } else {
      parts.push(`  :${p}`)
    }
  })

  if (Array.isArray(selectedItem.value.out_param) && selectedItem.value.out_param.length > 0) {
    selectedItem.value.out_param.forEach(p => {
      parts.push(`  :${p} /* OUT */`)
    })
  }

  if (currentType.value === 'fn') {
    return `DECLARE\n  v_ret VARCHAR2(4000);\nBEGIN\n  v_ret := ${name}(\n${parts.join(',\n')}\n  );\nEND;`
  }

  if (parts.length === 0) {
    return `BEGIN\n  ${name}();\nEND;`
  }

  return `BEGIN\n  ${name}(\n${parts.join(',\n')}\n  );\nEND;`
})

const isPls306Error = computed(() => {
  const msg = String(lastError.value?.message || '')
  const code = String(lastError.value?.data?.code || '')
  return code === 'ORA-06550' || msg.includes('PLS-00306')
})

const tabularRows = computed(() => {
  if (!executionResult.value) return []
  if (Array.isArray(executionResult.value)) return executionResult.value
  if (Array.isArray(executionResult.value.rows)) return executionResult.value.rows
  if (executionResult.value.out && typeof executionResult.value.out === 'object') {
    for (const val of Object.values(executionResult.value.out)) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
        return val
      }
    }
  }
  return []
})

async function runProcedure() {
  if (!selectedItemName.value) return
  executing.value = true
  lastError.value = null
  executionResult.value = null
  elapsedSeconds.value = 0

  if (timerInterval) clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)

  try {
    const res = await api.post(currentEndpoint.value, coercedPayload.value)
    executionResult.value = res.data
    lastDuration.value = res.durationMs
    hostStore.showToast(`Procedimiento "${selectedItemName.value}" ejecutado con éxito (${res.durationMs} ms)`, 'success')
  } catch (err) {
    lastError.value = err
    hostStore.showToast(`Error al ejecutar: ${err.message}`, 'error')
  } finally {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    executing.value = false
  }
}

function copyPlSql() {
  navigator.clipboard.writeText(generatedPlSql.value)
  hostStore.showToast('Bloque PL/SQL copiado al portapapeles', 'success')
}

function copyCurl() {
  const curl = api.buildCurl({
    method: 'POST',
    path: currentEndpoint.value,
    body: coercedPayload.value
  })
  navigator.clipboard.writeText(curl)
  hostStore.showToast('Comando cURL copiado al portapapeles', 'success')
}

function copyResultJson() {
  navigator.clipboard.writeText(JSON.stringify(executionResult.value, null, 2))
  hostStore.showToast('Resultado JSON copiado al portapapeles', 'success')
}

function openInExplorer() {
  const templatePayload = {}
  ;(selectedItem.value?.in_param || []).forEach(p => {
    templatePayload[p] = coercedPayload.value[p] !== undefined ? coercedPayload.value[p] : ''
  })
  router.push({
    path: '/explorer',
    query: {
      method: 'POST',
      endpoint: currentEndpoint.value,
      body: JSON.stringify(templatePayload, null, 2)
    }
  })
}
</script>

<style scoped>
.proc-layout {
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

.search-input-row {
  display: flex;
  gap: 6px;
}
.search-input-row input {
  flex: 1;
}

.type-selector {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.tab-btn {
  flex: 1;
  padding: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  border: none;
  background: #F8FAFC;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.tab-btn.active {
  background: var(--color-primary);
  color: #FFFFFF;
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
  font-size: 0.84rem;
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

.proc-workspace {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: var(--bg-app);
}

.proc-content {
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
  flex-wrap: wrap;
}
.endpoint-url {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--color-primary);
  flex: 1;
}

.plsql-card {
  background: #0F172A;
  border: 1px solid #1E293B;
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: 16px;
}
.plsql-header {
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
.plsql-meta-badge {
  background: rgba(56, 189, 248, 0.15);
  color: #38BDF8;
  font-size: 0.7rem;
  padding: 1px 8px;
  border-radius: 9999px;
}
.btn-dark {
  background: rgba(255, 255, 255, 0.1);
  color: #F8FAFC;
  border-color: rgba(255, 255, 255, 0.2);
}
.plsql-code {
  margin: 0;
  border: none;
  border-radius: 0;
  max-height: 220px;
  color: #38BDF8;
}

.params-section {
  border-top: 1px solid var(--border-color);
  padding-top: 14px;
}
.section-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 10px;
}
.no-params {
  font-size: 0.85rem;
  color: var(--text-muted);
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.loading-card {
  text-align: center;
  padding: 32px 20px;
}
.loading-spinner {
  font-size: 2.2rem;
  margin-bottom: 10px;
}
.loading-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}
.loading-timer {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-top: 6px;
}
.loading-sub {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.error-box {
  background: var(--color-error-bg);
  border: 1px solid #FECACA;
  color: var(--color-error);
}
.error-title {
  font-weight: 700;
  margin-bottom: 6px;
}
.error-msg {
  font-size: 0.85rem;
  margin-bottom: 10px;
  white-space: pre-wrap;
  font-family: var(--font-mono);
}
.pls-diag {
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  color: #92400E;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  margin-bottom: 10px;
}
.error-detail {
  margin-top: 8px;
}
.detail-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #7F1D1D;
}

.empty-selection {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}
</style>
