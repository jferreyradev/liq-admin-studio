<template>
  <div class="results-table-card card">
    <div class="card-header">
      <div class="title-section">
        <h3 class="card-title">{{ title || 'Resultados' }}</h3>
        <span class="badge badge-info" v-if="loading">⏳ Consultando Oracle...</span>
        <span class="badge badge-info" v-else-if="rows && rows.length !== undefined">
          {{ filteredRows.length }}{{ searchTerm ? ` / ${rows.length}` : '' }} fila(s) {{ durationMs ? `• ${durationMs} ms` : '' }}
        </span>
      </div>

      <div class="actions-section" v-if="rows && rows.length > 0 && !error">
        <input
          v-if="viewMode === 'table'"
          type="text"
          class="form-control filter-input"
          placeholder="Filtrar en resultados..."
          v-model="searchTerm"
        />
        <div class="view-toggle">
          <button
            class="btn btn-sm"
            :class="{ 'btn-active-mode': viewMode === 'table' }"
            @click="viewMode = 'table'"
          >
            📊 Tabla
          </button>
          <button
            class="btn btn-sm"
            :class="{ 'btn-active-mode': viewMode === 'json' }"
            @click="viewMode = 'json'"
          >
            { } JSON
          </button>
        </div>
        <button class="btn btn-sm" @click="copyJson" title="Copiar resultados en formato JSON">📋 JSON</button>
        <button class="btn btn-sm" @click="copyCsv" title="Copiar resultados en formato CSV">📋 CSV</button>
        <button class="btn btn-sm" @click="downloadCsv" title="Descargar resultados como archivo CSV">📥 Descargar CSV</button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-icon">⏳</div>
      <div class="loading-title">Ejecutando consulta en Oracle Database...</div>
      <div class="loading-sub">Por favor aguarde mientras se conecta al servidor y se recuperan los registros.</div>
    </div>

    <!-- Error View -->
    <div v-else-if="error" class="error-box">
      <div class="error-title">
        ⚠️ Error {{ error.status ? `HTTP ${error.status}` : '' }} al ejecutar consulta en Oracle:
      </div>
      <div class="error-msg">{{ error.message || error }}</div>

      <div v-if="isDbConnectionError" class="conn-diag">
        <div class="diag-title">🔍 Diagnóstico de Conexión Oracle:</div>
        <p>La API no pudo comunicarse con el motor Oracle Database configurado.</p>
        <ul>
          <li><strong>VPN Desconectada:</strong> Si el servidor Oracle está en red municipal privada, verifique que su cliente VPN esté activo.</li>
          <li><strong>Listener / Host:</strong> Verifique que el servicio Oracle Listener responda en el puerto configurado (1521).</li>
        </ul>
      </div>

      <div v-if="error.data?.call" class="error-detail">
        <span class="detail-label">Sentencia SQL / PL-SQL:</span>
        <pre>{{ error.data.call }}</pre>
      </div>
      <div v-if="error.data?.params" class="error-detail">
        <span class="detail-label">Parámetros (Binds):</span>
        <pre>{{ JSON.stringify(error.data.params, null, 2) }}</pre>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!rows || rows.length === 0" class="empty-state">
      <p>{{ emptyText || 'No hay datos para mostrar.' }}</p>
    </div>

    <!-- JSON View -->
    <pre v-else-if="viewMode === 'json'" class="json-pre"><code>{{ JSON.stringify(filteredRows, null, 2) }}</code></pre>

    <!-- Table View -->
    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col"
              @click="toggleSort(col)"
              class="sortable-th"
            >
              <div class="th-content">
                <span>{{ col }}</span>
                <span class="sort-icon">{{ sortColumn === col ? (sortAsc ? '▲' : '▼') : '' }}</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in filteredRows" :key="i">
            <td
              v-for="col in columns"
              :key="col"
              :class="{ 'table-amount': isNumeric(row[col]) }"
            >
              {{ formatCell(row[col]) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useHostStore } from '@/stores/hostStore'

const props = defineProps({
  rows: {
    type: Array,
    default: () => []
  },
  durationMs: {
    type: Number,
    default: 0
  },
  title: {
    type: String,
    default: 'Resultados'
  },
  emptyText: {
    type: String,
    default: 'Sin registros.'
  },
  error: {
    type: [Object, String],
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const hostStore = useHostStore()
const searchTerm = ref('')
const sortColumn = ref('')
const sortAsc = ref(true)
const viewMode = ref('table')

const columns = computed(() => {
  if (!props.rows || props.rows.length === 0) return []
  return Object.keys(props.rows[0])
})

const isDbConnectionError = computed(() => {
  const msg = String(props.error?.message || props.error || '')
  return (
    msg.includes('ORA-12170') ||
    msg.includes('NJS-040') ||
    msg.includes('timeout') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ORA-12541')
  )
})

function isNumeric(val) {
  if (typeof val === 'number') return true
  if (typeof val !== 'string' || val.trim() === '') return false
  return !isNaN(val) && !isNaN(parseFloat(val))
}

function formatCell(val) {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function toggleSort(col) {
  if (sortColumn.value === col) {
    sortAsc.value = !sortAsc.value
  } else {
    sortColumn.value = col
    sortAsc.value = true
  }
}

const filteredRows = computed(() => {
  let list = props.rows || []
  if (searchTerm.value.trim()) {
    const term = searchTerm.value.toLowerCase().trim()
    list = list.filter(row => {
      return Object.values(row).some(v => String(v ?? '').toLowerCase().includes(term))
    })
  }
  if (sortColumn.value) {
    list = [...list].sort((a, b) => {
      const va = a[sortColumn.value]
      const vb = b[sortColumn.value]
      if (va === vb) return 0
      if (va === null || va === undefined) return 1
      if (vb === null || vb === undefined) return -1
      return (va > vb ? 1 : -1) * (sortAsc.value ? 1 : -1)
    })
  }
  return list
})

function buildCsvString() {
  if (!props.rows || props.rows.length === 0) return ''
  const header = columns.value.join(',')
  const lines = filteredRows.value.map(r =>
    columns.value.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')
  )
  return [header, ...lines].join('\n')
}

function copyJson() {
  navigator.clipboard.writeText(JSON.stringify(filteredRows.value, null, 2))
  hostStore.showToast('JSON copiado al portapapeles', 'success')
}

function copyCsv() {
  const csv = buildCsvString()
  if (!csv) return
  navigator.clipboard.writeText(csv)
  hostStore.showToast('CSV copiado al portapapeles', 'success')
}

function downloadCsv() {
  const csv = buildCsvString()
  if (!csv) return
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `resultados_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  hostStore.showToast('Archivo CSV descargado', 'success')
}
</script>

<style scoped>
.results-table-card {
  width: 100%;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.actions-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.view-toggle {
  display: inline-flex;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.view-toggle .btn {
  border: none;
  border-radius: 0;
}

.btn-active-mode {
  background: var(--color-primary);
  color: #FFFFFF;
}

.filter-input {
  padding: 4px 10px;
  font-size: 0.8rem;
  width: 190px;
}

.sortable-th {
  cursor: pointer;
  user-select: none;
}
.th-content {
  display: flex;
  align-items: center;
  gap: 4px;
}
.sort-icon {
  font-size: 0.7rem;
  color: var(--color-primary);
}

.table-amount {
  font-family: var(--font-mono);
  text-align: right;
  font-weight: 500;
}

.loading-state {
  padding: 36px 20px;
  text-align: center;
  color: var(--text-secondary);
}
.loading-icon {
  font-size: 2rem;
  margin-bottom: 8px;
}
.loading-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}
.loading-sub {
  font-size: 0.8rem;
  margin-top: 4px;
}

.empty-state {
  padding: 30px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.88rem;
}

.json-pre {
  max-height: 480px;
}

.error-box {
  background: var(--color-error-bg);
  border: 1px solid #FECACA;
  border-radius: var(--radius-sm);
  padding: 14px 16px;
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
  background: rgba(0, 0, 0, 0.05);
  padding: 8px 10px;
  border-radius: var(--radius-sm);
}
.conn-diag {
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  color: #92400E;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  margin-bottom: 10px;
  line-height: 1.5;
}
.diag-title {
  font-weight: 700;
  margin-bottom: 4px;
}
.conn-diag ul {
  margin-left: 18px;
  margin-top: 4px;
}
.error-detail {
  margin-top: 8px;
}
.detail-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #7F1D1D;
}
.error-detail pre {
  margin-top: 4px;
  background: #1E293B;
  color: #F87171;
}
</style>
