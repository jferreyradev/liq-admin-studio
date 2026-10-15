<template>
  <div class="results-table-card card">
    <div class="card-header">
      <div class="title-section">
        <h3 class="card-title">{{ title || 'Resultados' }}</h3>
        <span class="badge badge-info" v-if="rows && rows.length !== undefined">
          {{ rows.length }} fila(s) {{ durationMs ? `(${durationMs} ms)` : '' }}
        </span>
      </div>

      <div class="actions-section">
        <input 
          v-if="rows && rows.length > 0"
          type="text" 
          class="form-control filter-input" 
          placeholder="Filtrar en resultados..." 
          v-model="searchTerm"
        />
        <button class="btn btn-sm" @click="copyJson" title="Copiar resultados en formato JSON">📋 JSON</button>
        <button class="btn btn-sm" @click="copyCsv" title="Copiar resultados en formato CSV">📋 CSV</button>
      </div>
    </div>

    <!-- Error View -->
    <div v-if="error" class="error-box">
      <div class="error-title">❌ Error de Ejecución:</div>
      <div class="error-msg">{{ error.message || error }}</div>
      <div v-if="error.data?.call" class="error-detail">
        <span class="detail-label">Llamada SQL:</span>
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
  }
})

const searchTerm = ref('')
const sortColumn = ref('')
const sortAsc = ref(true)

const columns = computed(() => {
  if (!props.rows || props.rows.length === 0) return []
  return Object.keys(props.rows[0])
})

function isNumeric(val) {
  if (typeof val === 'number') return true
  if (typeof val !== 'string') return false
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
      return Object.values(row).some(v => String(v).toLowerCase().includes(term))
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

function copyJson() {
  navigator.clipboard.writeText(JSON.stringify(props.rows, null, 2))
  alert('JSON copiado al portapapeles')
}

function copyCsv() {
  if (!props.rows || props.rows.length === 0) return
  const header = columns.value.join(',')
  const lines = props.rows.map(r => columns.value.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))
  const csv = [header, ...lines].join('\n')
  navigator.clipboard.writeText(csv)
  alert('CSV copiado al portapapeles')
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
}

.filter-input {
  padding: 4px 10px;
  font-size: 0.8rem;
  width: 200px;
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

.empty-state {
  padding: 30px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.88rem;
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
  margin-bottom: 4px;
}
.error-msg {
  font-size: 0.85rem;
  margin-bottom: 8px;
  white-space: pre-wrap;
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
