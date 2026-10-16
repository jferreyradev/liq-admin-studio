<template>
  <div class="importer-master-layout">
    <!-- Barra Lateral de Tablas Oracle -->
    <div class="catalog-sidebar">
      <div class="search-header">
        <input
          type="text"
          class="form-control"
          placeholder="Buscar tabla en Oracle..."
          v-model="tableSearch"
        />
        <div class="meta-row">
          <span class="badge badge-info">{{ filteredTables.length }} tablas</span>
          <button
            class="btn btn-sm"
            @click="catalogStore.loadTables()"
            :disabled="catalogStore.loadingTables"
            title="Recargar tablas de Oracle"
          >
            {{ catalogStore.loadingTables ? '...' : '🔄' }}
          </button>
        </div>
      </div>

      <div class="item-list">
        <div v-if="filteredTables.length === 0" class="sidebar-hint">
          <p><strong>📁 Pasos de Carga Masiva:</strong></p>
          <p>1. Sube tu archivo Excel (.xlsx, .xls) o CSV (.csv, .txt).</p>
          <p>2. Selecciona o escribe la tabla destino en Oracle.</p>
          <p>3. Inspecciona y asocia las columnas.</p>
        </div>
        <div
          v-for="tbl in filteredTables"
          :key="tbl"
          class="catalog-item"
          :class="{ active: targetTable.toUpperCase() === tbl.toUpperCase() }"
          @click="selectTargetTable(tbl)"
        >
          <div class="item-title">📊 {{ tbl }}</div>
          <div class="item-desc">Clic para usar como tabla destino</div>
        </div>
      </div>
    </div>

    <!-- Área Principal del Importador -->
    <div class="importer-workspace">
      <!-- Card 1: Subida de Archivo -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">📁 Cargar Archivo a Tabla Oracle (executeMany)</h2>
            <p class="text-secondary" style="font-size: 0.8rem; margin-top: 2px;">
              Sube planillas Excel (.xlsx, .xls) o delimitadas (.csv, .tsv, .txt) para inserción masiva por lotes de alto rendimiento en Oracle 11g.
            </p>
          </div>
          <button v-if="previewData" class="btn btn-sm" @click="resetImporter">🔄 Reiniciar</button>
        </div>

        <div
          class="dropzone"
          :class="{ dragover: isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
          @click="$refs.fileInput.click()"
        >
          <input
            type="file"
            ref="fileInput"
            style="display: none;"
            accept=".xlsx,.xls,.csv,.tsv,.txt"
            @change="onFileSelected"
          />
          <div class="drop-icon">📥</div>
          <div class="drop-text" v-if="loadingPreview">
            <strong>⏳ Subiendo y procesando "{{ selectedFile?.name }}"...</strong>
          </div>
          <div class="drop-text" v-else-if="!selectedFile">
            <strong>Arrastra tu archivo aquí o haz clic para seleccionarlo</strong>
            <span class="drop-sub">
              Formatos compatibles: Excel (.xlsx, .xls) y CSV (.csv, .tsv, .txt) • Máx 50 MB
            </span>
          </div>
          <div class="drop-text" v-else>
            <strong>📄 {{ selectedFile.name }} ({{ (selectedFile.size / 1024).toFixed(1) }} KB)</strong>
            <span class="drop-sub">Haz clic o arrastra otro archivo para reemplazarlo</span>
          </div>
        </div>
      </div>

      <!-- Card 2: Previsualización, Selector de Hoja y Tabla Destino -->
      <div v-if="previewData" class="card">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <h3 class="card-title">📄 {{ previewData.fileName || selectedFile?.name }}</h3>
            <span class="badge badge-success">{{ (previewData.totalRows || 0).toLocaleString() }} filas detectadas</span>
            <span class="badge badge-info">{{ (previewData.columns || []).length }} columnas</span>

            <!-- Selector de hoja si el Excel tiene múltiples hojas -->
            <div v-if="previewData.sheets && previewData.sheets.length > 1" class="sheet-selector">
              <label class="form-label" style="margin: 0;">Hoja Excel:</label>
              <select class="form-control sheet-select" v-model="selectedSheet" @change="onSheetChange">
                <option v-for="s in previewData.sheets" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Selección e Introspección de Tabla Destino -->
        <div class="target-table-bar">
          <div class="form-group" style="flex: 1; max-width: 480px;">
            <label class="form-label">Tabla Destino en Oracle:</label>
            <div style="display: flex; gap: 8px;">
              <input
                type="text"
                class="form-control"
                list="oracleTablesDatalist"
                v-model="targetTable"
                placeholder="Ej: STG_NOVEDADES o US_SUELDO.HOJA_NOV"
                @keyup.enter="inspectTableColumns"
              />
              <datalist id="oracleTablesDatalist">
                <option v-for="t in catalogStore.tables" :key="t" :value="t" />
              </datalist>
              <button
                class="btn btn-primary"
                :disabled="inspectingCols || !targetTable.trim()"
                @click="inspectTableColumns"
              >
                {{ inspectingCols ? '⏳ Inspeccionando...' : '🔍 Inspeccionar Columnas' }}
              </button>
            </div>
            <span class="field-hint">
              Selecciona una tabla del panel izquierdo o escríbela y pulsa "Inspeccionar Columnas" para obtener los tipos de datos de Oracle.
            </span>
          </div>
        </div>

        <!-- Muestra de las primeras 10 filas -->
        <ResultsTable
          v-if="sampleRows.length > 0"
          :rows="sampleRows"
          title="Previsualización del Archivo (Primeras 10 filas)"
        />
      </div>

      <!-- Card 3: Mapeo de Columnas y Opciones de Ejecución -->
      <div v-if="previewData && (oracleColumns.length > 0 || targetTable.trim())" class="card">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h3 class="card-title">🔗 Mapeo de Columnas (Archivo ➔ Oracle)</h3>
            <span class="badge badge-info">{{ mappedColumnsCount }} de {{ (previewData.columns || []).length }} mapeadas</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm" @click="autoMapColumns">✨ Auto-Mapear</button>
            <button class="btn btn-sm" @click="ignoreAllColumns">🚫 Ignorar Todas</button>
          </div>
        </div>

        <p class="text-secondary" style="font-size: 0.8rem; margin-bottom: 12px;">
          Asocia cada columna detectada en el archivo con su correspondiente columna en la tabla de Oracle. Puedes omitir columnas seleccionando <code>(No importar / Ignorar)</code>.
        </p>

        <div class="table-container" style="max-height: 360px; margin-bottom: 16px;">
          <table>
            <thead>
              <tr>
                <th style="width: 28%;">Columna en Archivo</th>
                <th style="width: 36%;">➔ Mapear a Columna Oracle</th>
                <th style="width: 18%;">Tipo en Oracle</th>
                <th style="width: 18%;">Ejemplo Fila 1</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fileCol in previewData.columns || []" :key="fileCol">
                <td><strong>{{ fileCol }}</strong></td>
                <td>
                  <select
                    v-if="oracleColumns.length > 0"
                    class="form-control mapping-select"
                    v-model="columnMap[fileCol]"
                  >
                    <option value="">(No importar / Ignorar)</option>
                    <option v-for="oc in oracleColumns" :key="oc.name" :value="oc.name">
                      {{ oc.name }} ({{ oc.type }}{{ oc.length ? `(${oc.length})` : '' }})
                    </option>
                  </select>
                  <input
                    v-else
                    type="text"
                    class="form-control mapping-select"
                    v-model="columnMap[fileCol]"
                    placeholder="Nombre columna Oracle (vacío = ignorar)"
                  />
                </td>
                <td class="oracle-type-cell">
                  <code>{{ getOracleTypeLabel(columnMap[fileCol]) }}</code>
                </td>
                <td class="sample-val-cell">
                  {{ formatSampleValue(sampleRows[0]?.[fileCol]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Opciones Transaccionales -->
        <div class="import-options-box">
          <div class="section-title" style="margin-bottom: 6px;">⚙️ Opciones de Inserción en Oracle:</div>
          <label class="option-check">
            <input type="checkbox" v-model="truncateTable" />
            <span>⚠️ <strong>Vaciar tabla antes de insertar</strong> (Ejecuta <code>TRUNCATE TABLE</code> / <code>DELETE</code> previo a la carga)</span>
          </label>
          <label class="option-check">
            <input type="checkbox" v-model="atomicTransaction" />
            <span>🔒 <strong>Modo Transaccional Atómico</strong> (Si alguna fila falla, ejecuta <code>ROLLBACK</code> completo sin dejar registros parciales)</span>
          </label>
        </div>

        <!-- Botón de Ejecución -->
        <div class="execute-bar">
          <button
            class="btn btn-primary btn-lg"
            :disabled="importing || !targetTable.trim() || mappedColumnsCount === 0"
            @click="executeImport"
          >
            {{ importing ? '⏳ Insertando lotes en Oracle...' : '🚀 Iniciar Carga Masiva a Oracle' }}
          </button>
          <span v-if="importing" class="exec-status-text">
            Ejecutando executeMany por lotes de 2000 registros...
          </span>
        </div>
      </div>

      <!-- Card 4: Resultado de la Importación -->
      <div v-if="importResult || importError" class="card">
        <div class="card-header">
          <h3 class="card-title">Resultado de la Importación</h3>
          <span class="badge" :class="importError ? 'badge-error' : 'badge-success'">
            {{ importError ? 'Error' : 'Completado' }}
          </span>
        </div>

        <div v-if="importError" class="error-result-box">
          <h4>❌ Error durante la importación a Oracle</h4>
          <p>{{ importError }}</p>
          <p class="rollback-note" v-if="atomicTransaction">
            🔒 Como el modo transaccional atómico estaba activo, se realizó un rollback automático y ningún registro parcial quedó en la tabla.
          </p>
        </div>

        <div v-else-if="importResult" class="success-result-box">
          <h4>✅ ¡Carga masiva completada con éxito!</h4>
          <div class="summary-metrics">
            <div class="metric-item">
              <span class="metric-label">Tabla Destino:</span>
              <code>{{ importResult.tableName || targetTable }}</code>
            </div>
            <div class="metric-item">
              <span class="metric-label">Filas Insertadas:</span>
              <strong class="metric-highlight">
                {{ (importResult.rowsInserted ?? importResult.inserted ?? 0).toLocaleString() }}
              </strong>
              <span> / {{ (importResult.totalRows || previewData?.totalRows || 0).toLocaleString() }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Tiempo de Ejecución:</span>
              <span>{{ importResult.timeMs || 0 }} ms ({{ ((importResult.timeMs || 0) / 1000).toFixed(2) }}s)</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Columnas Mapeadas:</span>
              <span>{{ mappedColumnsCount }}</span>
            </div>
          </div>

          <div v-if="importResult.batchErrors && importResult.batchErrors.length > 0" class="batch-errors-box">
            <div class="batch-errors-title">
              ⚠️ Advertencias en {{ importResult.batchErrors.length }} fila(s):
            </div>
            <pre>{{ JSON.stringify(importResult.batchErrors, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '@/services/api'
import { useHostStore } from '@/stores/hostStore'
import { useCatalogStore } from '@/stores/catalogStore'
import ResultsTable from '@/components/common/ResultsTable.vue'

const hostStore = useHostStore()
const catalogStore = useCatalogStore()

const tableSearch = ref('')
const isDragging = ref(false)
const selectedFile = ref(null)
const selectedSheet = ref('')
const loadingPreview = ref(false)
const previewData = ref(null)
const uploadId = ref(null)

const targetTable = ref('')
const inspectingCols = ref(false)
const oracleColumns = ref([])
const columnMap = ref({})

const truncateTable = ref(false)
const atomicTransaction = ref(true)

const importing = ref(false)
const importResult = ref(null)
const importError = ref(null)

onMounted(() => {
  if (catalogStore.tablesCount === 0) {
    catalogStore.loadTables()
  }
})

const filteredTables = computed(() => {
  const list = catalogStore.tables || []
  if (!tableSearch.value.trim()) return list
  const q = tableSearch.value.toLowerCase().trim()
  return list.filter(t => t.toLowerCase().includes(q))
})

const sampleRows = computed(() => {
  if (!previewData.value) return []
  return previewData.value.preview || previewData.value.sampleRows || []
})

const mappedColumnsCount = computed(() => {
  return Object.values(columnMap.value).filter(v => v && v.trim() !== '').length
})

function onDrop(e) {
  isDragging.value = false
  if (e.dataTransfer?.files?.length > 0) {
    processFile(e.dataTransfer.files[0], null)
  }
}

function onFileSelected(e) {
  if (e.target?.files?.length > 0) {
    processFile(e.target.files[0], null)
  }
}

async function onSheetChange() {
  if (selectedFile.value && selectedSheet.value) {
    await processFile(selectedFile.value, selectedSheet.value)
  }
}

async function processFile(file, sheetName = null) {
  selectedFile.value = file
  loadingPreview.value = true
  importResult.value = null
  importError.value = null

  try {
    const buffer = await file.arrayBuffer()
    const queryParams = { fileName: file.name }
    if (sheetName) queryParams.sheet = sheetName

    const res = await api.postBinary('/api/import/preview', buffer, queryParams, {
      'X-File-Name': encodeURIComponent(file.name)
    })

    previewData.value = res.data
    uploadId.value = res.data.uploadId
    selectedSheet.value = res.data.selectedSheet || (res.data.sheets?.[0] ?? '')

    autoMapColumns()
    hostStore.showToast(
      `Archivo procesado: ${(res.data.totalRows || 0).toLocaleString()} registros encontrados`,
      'success'
    )

    if (targetTable.value.trim() && oracleColumns.value.length === 0) {
      await inspectTableColumns()
    }
  } catch (err) {
    hostStore.showToast(`Error al previsualizar archivo: ${err.message}`, 'error')
  } finally {
    loadingPreview.value = false
  }
}

function selectTargetTable(tableName) {
  targetTable.value = tableName
  inspectTableColumns()
}

async function inspectTableColumns() {
  const tbl = targetTable.value.trim()
  if (!tbl) return
  inspectingCols.value = true
  try {
    const res = await api.get(`/api/import/table-columns/${encodeURIComponent(tbl)}`)
    oracleColumns.value = res.data?.columns || []
    if (oracleColumns.value.length === 0) {
      hostStore.showToast(`La tabla "${tbl}" no devolvió columnas en ALL_TAB_COLUMNS`, 'warning')
    } else {
      hostStore.showToast(
        `Tabla ${tbl}: ${oracleColumns.value.length} columnas obtenidas de Oracle`,
        'success'
      )
      if (previewData.value) {
        autoMapColumns()
      }
    }
  } catch (err) {
    hostStore.showToast(`Error al inspeccionar tabla: ${err.message}`, 'error')
  } finally {
    inspectingCols.value = false
  }
}

function autoMapColumns() {
  const fileCols = previewData.value?.columns || []
  const newMap = {}

  fileCols.forEach(fc => {
    const normFc = fc.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '')
    if (oracleColumns.value.length > 0) {
      const match = oracleColumns.value.find(oc => {
        const normOc = oc.name.toUpperCase().replace(/[^A-Z0-9_]/g, '')
        return normOc === normFc || oc.name.toUpperCase() === fc.trim().toUpperCase()
      })
      newMap[fc] = match ? match.name : ''
    } else {
      newMap[fc] = fc.trim().toUpperCase()
    }
  })

  columnMap.value = newMap
}

function ignoreAllColumns() {
  const fileCols = previewData.value?.columns || []
  const newMap = {}
  fileCols.forEach(fc => { newMap[fc] = '' })
  columnMap.value = newMap
}

function getOracleTypeLabel(colName) {
  if (!colName) return '-'
  const found = oracleColumns.value.find(c => c.name === colName)
  if (!found) return 'AUTO'
  return `${found.type}${found.length ? `(${found.length})` : ''}`
}

function formatSampleValue(val) {
  if (val === undefined || val === null || val === '') return '-'
  return String(val)
}

async function executeImport() {
  if (!uploadId.value || !targetTable.value.trim()) return

  const activeMapping = {}
  Object.entries(columnMap.value).forEach(([fileCol, targetCol]) => {
    if (targetCol && targetCol.trim() !== '') {
      activeMapping[fileCol] = targetCol.trim()
    }
  })

  if (Object.keys(activeMapping).length === 0) {
    hostStore.showToast('Debes mapear al menos una columna para importar', 'warning')
    return
  }

  if (truncateTable.value) {
    const ok = confirm(
      `⚠️ ATENCIÓN: Has marcado "Vaciar tabla antes de insertar".\nSe eliminarán TODOS los registros actuales en "${targetTable.value.trim()}" antes de cargar.\n\n¿Deseas continuar?`
    )
    if (!ok) return
  }

  importing.value = true
  importResult.value = null
  importError.value = null

  try {
    const res = await api.post('/api/import/execute', {
      uploadId: uploadId.value,
      tableName: targetTable.value.trim(),
      mapping: activeMapping,
      truncate: truncateTable.value,
      atomic: atomicTransaction.value,
      batchSize: 2000
    })

    importResult.value = res.data
    const count = res.data?.rowsInserted ?? res.data?.inserted ?? 0
    hostStore.showToast(`✅ ¡${count.toLocaleString()} filas insertadas en ${targetTable.value.trim()}!`, 'success')
  } catch (err) {
    importError.value = err.message
    hostStore.showToast(`❌ Error en importación: ${err.message}`, 'error')
  } finally {
    importing.value = false
  }
}

function resetImporter() {
  selectedFile.value = null
  previewData.value = null
  uploadId.value = null
  oracleColumns.value = []
  columnMap.value = {}
  importResult.value = null
  importError.value = null
}
</script>

<style scoped>
.importer-master-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.catalog-sidebar {
  width: 280px;
  min-width: 280px;
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
.sidebar-hint {
  padding: 14px;
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.6;
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
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
}
.item-desc {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.importer-workspace {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  height: 100%;
}

.dropzone {
  border: 2px dashed #CBD5E1;
  border-radius: var(--radius-md);
  padding: 32px 20px;
  text-align: center;
  background: #F8FAFC;
  cursor: pointer;
  transition: all 0.2s ease;
}
.dropzone:hover,
.dropzone.dragover {
  border-color: var(--color-primary);
  background: rgba(106, 27, 154, 0.04);
}
.drop-icon {
  font-size: 2.2rem;
  margin-bottom: 6px;
}
.drop-text {
  font-size: 0.92rem;
  color: var(--text-primary);
}
.drop-sub {
  font-size: 0.78rem;
  color: var(--text-secondary);
  display: block;
  margin-top: 4px;
}

.sheet-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
}
.sheet-select {
  padding: 4px 8px;
  font-size: 0.8rem;
  width: auto;
}

.target-table-bar {
  margin-bottom: 16px;
}
.field-hint {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 4px;
}

.mapping-select {
  padding: 5px 10px;
  font-size: 0.82rem;
  width: 100%;
}
.oracle-type-cell {
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.sample-val-cell {
  font-size: 0.8rem;
  color: var(--text-secondary);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-options-box {
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.option-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.84rem;
  cursor: pointer;
}

.execute-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.btn-lg {
  padding: 10px 22px;
  font-size: 0.92rem;
}
.exec-status-text {
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.error-result-box {
  background: var(--color-error-bg);
  border: 1px solid #FECACA;
  color: var(--color-error);
  padding: 14px 16px;
  border-radius: var(--radius-sm);
}
.rollback-note {
  font-size: 0.78rem;
  margin-top: 8px;
  color: #7F1D1D;
}

.success-result-box {
  background: var(--color-success-bg);
  border: 1px solid #BBF7D0;
  color: #14532D;
  padding: 16px;
  border-radius: var(--radius-sm);
}
.summary-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 10px;
  font-size: 0.85rem;
}
.metric-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.metric-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #166534;
}
.metric-highlight {
  font-size: 1.15rem;
  color: var(--color-primary);
}

.batch-errors-box {
  margin-top: 14px;
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
}
.batch-errors-title {
  font-weight: 700;
  color: #92400E;
  font-size: 0.82rem;
  margin-bottom: 6px;
}
</style>
