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

        <input 
          type="text" 
          class="form-control" 
          placeholder="Buscar procedimiento..." 
          v-model="searchTerm"
        />
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
        <p>Completa sus parámetros de entrada y pruébalo con inspección de binds en vivo.</p>
      </div>

      <div v-else class="proc-content">
        <!-- Control Card -->
        <div class="card">
          <div class="card-header">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" :class="currentType === 'sp' ? 'badge-info' : 'badge-warning'">
                  {{ currentType.toUpperCase() }}
                </span>
                <h2 class="card-title">{{ selectedItemName }}</h2>
              </div>
              <p class="text-secondary" style="margin-top: 4px;">
                Oracle PL/SQL: <code>{{ selectedItem.sp_name || selectedItem.fn_name }}</code>
              </p>
            </div>
            <div>
              <button class="btn btn-primary" :disabled="executing" @click="runProcedure">
                {{ executing ? '⏳ Ejecutando...' : '⚡ Ejecutar en Oracle' }}
              </button>
            </div>
          </div>

          <!-- Live PL/SQL Preview Card -->
          <div class="plsql-card">
            <div class="plsql-header">
              <span>📜 Bloque PL/SQL Generado en Tiempo Real</span>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-sm" @click="copyPlSql">📋 Copiar PL/SQL</button>
                <button class="btn btn-sm" @click="openInSqlStudio">✏️ Abrir en SQL Studio</button>
              </div>
            </div>
            <pre class="plsql-code">{{ generatedPlSql }}</pre>
          </div>

          <!-- Formulario de Parámetros de Entrada -->
          <div class="params-section">
            <div class="section-title">📥 Parámetros de Entrada (IN):</div>
            <div v-if="!selectedItem.in_param || selectedItem.in_param.length === 0" class="no-params">
              Este procedimiento no requiere parámetros de entrada.
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
                  :placeholder="`Valor para ${param}`"
                  @keyup.enter="runProcedure"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Resultados de la Ejecución -->
        <div v-if="lastError" class="card error-box">
          <div class="error-title">❌ Error de Ejecución en Oracle:</div>
          <div class="error-msg">{{ lastError.message }}</div>
          
          <div v-if="lastError.data?.call" class="error-detail">
            <span class="detail-label">Llamada Fallida:</span>
            <pre>{{ lastError.data.call }}</pre>
          </div>
          <div v-if="lastError.data?.params" class="error-detail">
            <span class="detail-label">Binds Enviados:</span>
            <pre>{{ JSON.stringify(lastError.data.params, null, 2) }}</pre>
          </div>
        </div>

        <div v-if="executionResult" class="card">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <h3 class="card-title">✅ Ejecución Exitosa</h3>
              <span class="badge badge-success">{{ lastDuration }} ms</span>
            </div>
            <button class="btn btn-sm" @click="copyResultJson">📋 Copiar Salida</button>
          </div>

          <!-- Parámetros OUT -->
          <div v-if="executionResult.out" style="margin-bottom: 12px;">
            <div class="section-title">📤 Parámetros de Salida (OUT Binds):</div>
            <pre>{{ JSON.stringify(executionResult.out, null, 2) }}</pre>
          </div>

          <!-- Respuesta completa -->
          <div>
            <div class="section-title">Respuesta Completa de la API:</div>
            <pre>{{ JSON.stringify(executionResult, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/services/api'
import { useHostStore } from '@/stores/hostStore'

const router = useRouter()
const hostStore = useHostStore()

const currentType = ref('sp')
const spMap = ref({})
const fnMap = ref({})
const searchTerm = ref('')
const selectedItemName = ref('')
const selectedItem = ref(null)
const inputParams = ref({})

const executing = ref(false)
const executionResult = ref(null)
const lastError = ref(null)
const lastDuration = ref(0)

onMounted(() => {
  loadCatalogs()
})

async function loadCatalogs() {
  try {
    const [spRes, fnRes] = await Promise.all([
      api.get('/api/sp/list'),
      api.get('/api/fn/list')
    ])
    spMap.value = spRes.data || {}
    fnMap.value = fnRes.data || {}

    if (spList.value.length > 0) {
      selectItem(spList.value[0].name)
    }
  } catch (err) {
    console.error('Error cargando procedimientos:', err)
  }
}

const spList = computed(() => Object.entries(spMap.value).map(([name, config]) => ({ name, config })))
const fnList = computed(() => Object.entries(fnMap.value).map(([name, config]) => ({ name, config })))

const currentList = computed(() => currentType.value === 'sp' ? spList.value : fnList.value)

const filteredItems = computed(() => {
  if (!searchTerm.value.trim()) return currentList.value
  const t = searchTerm.value.toLowerCase().trim()
  return currentList.value.filter(item => {
    return item.name.toLowerCase().includes(t) || 
      (item.config?.sp_name || item.config?.fn_name || '').toLowerCase().includes(t)
  })
})

function switchType(type) {
  currentType.value = type
  selectedItemName.value = ''
  selectedItem.value = null
  if (currentList.value.length > 0) {
    selectItem(currentList.value[0].name)
  }
}

function selectItem(name) {
  selectedItemName.value = name
  const map = currentType.value === 'sp' ? spMap.value : fnMap.value
  selectedItem.value = map[name] || null
  inputParams.value = {}
  executionResult.value = null
  lastError.value = null
}

const generatedPlSql = computed(() => {
  if (!selectedItem.value) return ''
  const name = selectedItem.value.sp_name || selectedItem.value.fn_name || selectedItemName.value
  const parts = []

  ;(selectedItem.value.in_param || []).forEach(p => {
    const val = inputParams.value[p]
    let valStr = `:${p}`
    if (val !== undefined && val !== '') {
      const lower = p.toLowerCase()
      if (lower.includes('periodo') || lower.includes('fecha')) {
        valStr = `TO_DATE('${val}', 'YYYY-MM-DD')`
      } else if (!isNaN(Number(val)) && typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val.trim())) {
        valStr = val.trim()
      } else {
        valStr = `'${val}'`
      }
    }
    parts.push(`  ${p} => ${valStr}`)
  })

  if (selectedItem.value.out_param && Array.isArray(selectedItem.value.out_param) && selectedItem.value.out_param.length > 0) {
    selectedItem.value.out_param.forEach(p => {
      parts.push(`  ${p} => :${p} /* OUT */`)
    })
  }

  if (currentType.value === 'fn') {
    return `DECLARE\n  v_ret NUMBER;\nBEGIN\n  v_ret := ${name}(\n${parts.join(',\n')}\n  );\nEND;`
  }

  return `BEGIN\n  ${name}(\n${parts.join(',\n')}\n  );\nEND;`
})

async function runProcedure() {
  if (!selectedItemName.value) return
  executing.value = true
  lastError.value = null
  executionResult.value = null

  const endpoint = currentType.value === 'sp' 
    ? `/api/sp/${selectedItemName.value}` 
    : `/api/fn/${selectedItemName.value}`

  const payload = {}
  for (const [k, v] of Object.entries(inputParams.value)) {
    if (v === '' || v === undefined) continue
    const trimmed = typeof v === 'string' ? v.trim() : v
    const lower = k.toLowerCase()
    
    // Coerción automática de enteros para IDs, tipos, grupo, cuotas, ley
    if ((lower.includes('id') || lower.includes('tipo') || lower.includes('grupo') || lower.includes('ley') || lower.includes('cuota') || lower.includes('cant')) && typeof trimmed === 'string' && /^-?\d+$/.test(trimmed)) {
      payload[k] = Number(trimmed)
    } else {
      payload[k] = trimmed
    }
  }

  try {
    const res = await api.post(endpoint, payload)
    executionResult.value = res.data
    lastDuration.value = res.durationMs
  } catch (err) {
    lastError.value = err
  } finally {
    executing.value = false
  }
}

function copyPlSql() {
  navigator.clipboard.writeText(generatedPlSql.value)
  alert('Bloque PL/SQL copiado al portapapeles')
}

function copyResultJson() {
  navigator.clipboard.writeText(JSON.stringify(executionResult.value, null, 2))
  alert('Resultado copiado')
}

function openInSqlStudio() {
  router.push({
    path: '/sql-studio',
    query: {
      sql: generatedPlSql.value
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
}
.plsql-code {
  margin: 0;
  border: none;
  border-radius: 0;
  max-height: 220px;
  color: #FBBF24;
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

.error-box {
  background: var(--color-error-bg);
  border: 1px solid #FECACA;
  color: var(--color-error);
}
.error-title {
  font-weight: 700;
  margin-bottom: 4px;
}
.error-msg {
  font-size: 0.85rem;
  margin-bottom: 8px;
  white-space: pre-wrap;
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
