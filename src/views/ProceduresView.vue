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
                  {{ inParamList.length }} IN | {{ outParamList.length }} OUT
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
            <div v-if="inParamList.length === 0" class="no-params">
              Este procedimiento no requiere parámetros de entrada (IN).
            </div>
            <div v-else class="form-grid">
              <div
                v-for="param in inParamList"
                :key="param"
                class="form-group"
              >
                <label class="form-label" style="display: flex; align-items: center; justify-content: space-between;">
                  <span>{{ param }}:</span>
                  <span v-if="isPeriodoParam(param)" class="badge badge-info" style="font-size: 0.65rem;" title="Regla de la API: Todo período utiliza siempre el día 01">📅 PERÍODO (Día 01)</span>
                  <span v-else-if="isDateParam(param)" class="badge badge-info" style="font-size: 0.65rem;">📅 DATE</span>
                </label>
                <input
                  type="text"
                  class="form-control"
                  v-model="inputParams[param]"
                  :disabled="executing"
                  :placeholder="isPeriodoParam(param) ? 'Ej: 09/2026 o 01/09/2026 (Día siempre 01)' : (isDateParam(param) ? 'Ej: 01/09/2026 o 2026-09-01' : `Valor para ${param} (vacío = NULL)`)"
                  @keyup.enter="runProcedure"
                />
                <span v-if="isDateParam(param) && inputParams[param]" class="date-preview-hint">
                  ➔ Se vinculará en Oracle como: <code>{{ formatPreviewBind(coercedPayload[param]) }}</code>
                </span>
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
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <h3 class="card-title">
                {{ plsqlOutWarning ? '⚠️ Procedimiento Finalizado con Observaciones' : '✅ Retorno del Procedimiento' }}
              </h3>
              <span class="badge" :class="plsqlOutWarning ? 'badge-warning' : 'badge-success'">
                HTTP 200 • {{ lastDuration }} ms
              </span>
            </div>
            <button class="btn btn-sm" @click="copyResultJson">📋 Copiar Salida JSON</button>
          </div>

          <!-- Alerta si el SP reportó un error en sus variables OUT -->
          <div v-if="plsqlOutWarning" class="pls-diag" style="margin-bottom: 14px;">
            ⚠️ <strong>Atención en Parámetros OUT de PL/SQL:</strong> {{ plsqlOutWarning }}
          </div>

          <!-- Sentencia y Binds efectivamente ejecutados en el servidor -->
          <div v-if="executionResult.call || executionResult.params" style="margin-bottom: 14px;">
            <div class="section-title">🔍 Sentencia y Binds Ejecutados en el Servidor Oracle:</div>
            <pre>{{ JSON.stringify({ call: executionResult.call, params: executionResult.params, elapsedSeconds: executionResult.elapsed }, null, 2) }}</pre>
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

const inParamList = computed(() => {
  const raw = selectedItem.value?.in_param
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'object') return Object.keys(raw)
  return []
})

const outParamList = computed(() => {
  const raw = selectedItem.value?.out_param
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'object' && raw.varName) return [raw.varName]
  return []
})

const currentEndpoint = computed(() => {
  if (!selectedItemName.value) return '/api/sp/...'
  return currentType.value === 'sp'
    ? `/api/sp/${selectedItemName.value}`
    : `/api/fn/${selectedItemName.value}`
})

function isPeriodoParam(paramName) {
  const lower = String(paramName || '').toLowerCase()
  return lower.includes('periodo') || lower === 'vper' || lower === 'per'
}

function isDateParam(paramName) {
  const lower = String(paramName || '').toLowerCase()
  return (
    isPeriodoParam(paramName) ||
    lower.includes('fecha') ||
    lower.includes('fec') ||
    lower.includes('vto')
  )
}

function coerceParamValue(rawVal, paramName) {
  if (rawVal === undefined || rawVal === null) return null
  const trimmed = typeof rawVal === 'string' ? rawVal.trim() : String(rawVal)
  if (trimmed === '') return null

  const isPeriodo = isPeriodoParam(paramName)
  const isDate = isDateParam(paramName)

  // 1. YYYY-MM-DD -> Medianoche en zona horaria local (si es Periodo, día siempre 01)
  const isoDateOnly = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoDateOnly) {
    const day = isPeriodo ? 1 : parseInt(isoDateOnly[3], 10)
    const d = new Date(
      parseInt(isoDateOnly[1], 10),
      parseInt(isoDateOnly[2], 10) - 1,
      day,
      0, 0, 0
    )
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  // 2. DD/MM/YYYY o D/M/YYYY -> Medianoche local (si es Periodo, día siempre 01)
  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmyMatch) {
    const day = isPeriodo ? 1 : parseInt(dmyMatch[1], 10)
    const d = new Date(
      parseInt(dmyMatch[3], 10),
      parseInt(dmyMatch[2], 10) - 1,
      day,
      0, 0, 0
    )
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  // 3. YYYY-MM -> Día 01 del mes a medianoche local
  const ymMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/)
  if (isDate && ymMatch) {
    const d = new Date(parseInt(ymMatch[1], 10), parseInt(ymMatch[2], 10) - 1, 1, 0, 0, 0)
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  // 4. MM/YYYY o M/YYYY -> Día 01 del mes a medianoche local
  const myMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/)
  if (isDate && myMatch) {
    const d = new Date(parseInt(myMatch[2], 10), parseInt(myMatch[1], 10) - 1, 1, 0, 0, 0)
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  // 4b. Formato compacto YYYYMM (202609) o MMYYYY (092026) en campos Periodo -> Día 01 fijo
  if (isPeriodo && /^\d{6}$/.test(trimmed)) {
    const firstFour = parseInt(trimmed.slice(0, 4), 10)
    const lastTwo = parseInt(trimmed.slice(4, 6), 10)
    if (firstFour >= 1990 && firstFour <= 2100 && lastTwo >= 1 && lastTwo <= 12) {
      return new Date(firstFour, lastTwo - 1, 1, 0, 0, 0).toISOString()
    }
    const firstTwo = parseInt(trimmed.slice(0, 2), 10)
    const lastFour = parseInt(trimmed.slice(2, 6), 10)
    if (lastFour >= 1990 && lastFour <= 2100 && firstTwo >= 1 && firstTwo <= 12) {
      return new Date(lastFour, firstTwo - 1, 1, 0, 0, 0).toISOString()
    }
  }

  // 5. Valores numéricos
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed)
  }

  return trimmed
}

function formatPreviewBind(val) {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const yyyy = d.getFullYear()
      return `${dd}/${mm}/${yyyy} 00:00:00 (${val})`
    }
  }
  return JSON.stringify(val)
}

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
  inParamList.value.forEach(param => {
    payload[param] = coerceParamValue(inputParams.value[param], param)
  })
  return payload
})

const generatedPlSql = computed(() => {
  if (!selectedItem.value) return ''
  const name = selectedItem.value.sp_name || selectedItem.value.fn_name || selectedItemName.value
  const parts = []

  inParamList.value.forEach(p => {
    const rawVal = inputParams.value[p]
    if (rawVal !== undefined && rawVal !== '') {
      parts.push(`  :${p} /* ${formatPreviewBind(coercedPayload.value[p])} */`)
    } else {
      parts.push(`  :${p} /* NULL */`)
    }
  })

  if (currentType.value === 'sp' && outParamList.value.length > 0) {
    outParamList.value.forEach(p => {
      parts.push(`  :${p} /* OUT */`)
    })
  }

  if (currentType.value === 'fn') {
    const outVar = outParamList.value[0] || 'value'
    return `BEGIN\n  :${outVar} := ${name}(\n${parts.join(',\n')}\n  );\nEND;`
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

const plsqlOutWarning = computed(() => {
  const out = executionResult.value?.out
  if (!out || typeof out !== 'object') return null

  const errCode = out.ValorError ?? out.vError ?? out.VERROR ?? out.error
  const errMsg = out.vErrorMsg ?? out.VmsgError ?? out.VmensajeError ?? out.VERRORMSG
  const salida = out.ValorSalida ?? out.vSALIDA ?? out.VSALIDA

  if (errMsg && String(errMsg).trim() !== '') {
    return `El procedimiento devolvió mensaje de error: "${errMsg}" (Código: ${errCode ?? salida ?? 'N/A'})`
  }
  if (errCode !== undefined && errCode !== null && Number(errCode) !== 0) {
    return `El parámetro de error devolvió un código distinto de cero (${errCode}). Revise los parámetros enviados.`
  }
  if (salida !== undefined && salida !== null && Number(salida) < 0) {
    return `El parámetro ValorSalida devolvió un valor negativo (${salida}), lo que suele indicar una condición de rechazo en PL/SQL.`
  }
  return null
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
    if (plsqlOutWarning.value) {
      hostStore.showToast(`Procedimiento finalizado con advertencia PL/SQL: ${plsqlOutWarning.value}`, 'warning', 5000)
    } else {
      hostStore.showToast(`Procedimiento "${selectedItemName.value}" ejecutado (${res.durationMs} ms)`, 'success')
    }
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
  router.push({
    path: '/explorer',
    query: {
      method: 'POST',
      endpoint: currentEndpoint.value,
      body: JSON.stringify(coercedPayload.value, null, 2)
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
.date-preview-hint {
  font-size: 0.72rem;
  color: var(--color-info);
  margin-top: 2px;
}
.date-preview-hint code {
  font-family: var(--font-mono);
  font-size: 0.7rem;
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
