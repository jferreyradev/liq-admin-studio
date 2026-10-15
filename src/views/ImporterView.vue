<template>
  <div class="importer-layout">
    <div class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">📁 Importador Masivo de Archivos a Oracle</h2>
          <p class="text-secondary">Carga masiva por lotes (executeMany) de planillas Excel (.xlsx, .xls) o CSV hacia tablas Oracle 11g.</p>
        </div>
      </div>

      <!-- Paso 1: Drag & Drop de Archivo -->
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
        <div class="drop-icon">📤</div>
        <div class="drop-text" v-if="!selectedFile">
          <strong>Haz clic o arrastra un archivo aquí</strong>
          <span style="font-size: 0.78rem; color: var(--text-secondary); display: block; margin-top: 4px;">
            Soporta .xlsx, .xls, .csv, .txt (hasta 50 MB)
          </span>
        </div>
        <div class="drop-text" v-else>
          <strong>Archivo seleccionado: {{ selectedFile.name }} ({{ Math.round(selectedFile.size / 1024) }} KB)</strong>
          <span class="badge badge-success" style="margin-top: 6px;">Listo para vista previa</span>
        </div>
      </div>

      <div v-if="loadingPreview" style="text-align: center; padding: 20px;">
        ⏳ Analizando archivo y generando vista previa...
      </div>

      <!-- Paso 2: Configuración del Mapeo de Tablas y Columnas -->
      <div v-if="previewData" class="mapping-section">
        <div class="section-title">⚙️ Configuración de Destino y Mapeo:</div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Tabla Destino en Oracle:</label>
            <input 
              type="text" 
              class="form-control" 
              v-model="targetTable" 
              placeholder="ej. US_SUELDO.HOJA_NOV"
            />
          </div>

          <div class="form-group" style="justify-content: flex-end;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
              <input type="checkbox" v-model="truncateTable" />
              <span>Vaciar tabla antes de insertar (TRUNCATE)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; margin-top: 4px;">
              <input type="checkbox" v-model="atomicTransaction" />
              <span>Transacción atómica (Rollback total ante cualquier error)</span>
            </label>
          </div>
        </div>

        <!-- Mapeo de Columnas -->
        <div style="margin-top: 16px;">
          <label class="form-label">Mapeo de Columnas (Columna del Archivo ➔ Columna Oracle):</label>
          <div class="mapping-grid">
            <div 
              v-for="col in previewData.columns || []" 
              :key="col"
              class="mapping-item"
            >
              <span class="file-col">{{ col }}</span>
              <span style="color: var(--text-muted);">➔</span>
              <input 
                type="text" 
                class="form-control mapping-input" 
                v-model="columnMap[col]" 
                :placeholder="col"
              />
            </div>
          </div>
        </div>

        <!-- Botón de Ejecución -->
        <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
          <button 
            class="btn btn-primary" 
            :disabled="importing || !targetTable.trim()" 
            @click="executeImport"
          >
            {{ importing ? '⏳ Importando lote...' : '🚀 Ejecutar Importación en Oracle' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Muestra de 10 Filas del Archivo -->
    <ResultsTable 
      v-if="previewData && previewData.sampleRows"
      :rows="previewData.sampleRows"
      title="Muestra de Datos del Archivo (Primeras 10 filas)"
    />

    <!-- Resultado de la Importación -->
    <div v-if="importResult" class="card">
      <div class="card-header">
        <h3 class="card-title">✅ Resumen de Importación</h3>
        <span class="badge badge-success">{{ importResult.totalRows || 0 }} registros</span>
      </div>
      <pre>{{ JSON.stringify(importResult, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { api } from '@/services/api'
import { useHostStore } from '@/stores/hostStore'
import ResultsTable from '@/components/common/ResultsTable.vue'

const hostStore = useHostStore()

const isDragging = ref(false)
const selectedFile = ref(null)
const loadingPreview = ref(false)
const previewData = ref(null)
const uploadId = ref(null)

const targetTable = ref('')
const truncateTable = ref(false)
const atomicTransaction = ref(true)
const columnMap = ref({})

const importing = ref(false)
const importResult = ref(null)

function onDrop(e) {
  isDragging.value = false
  if (e.dataTransfer.files.length > 0) {
    handleFile(e.dataTransfer.files[0])
  }
}

function onFileSelected(e) {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0])
  }
}

async function handleFile(file) {
  selectedFile.value = file
  loadingPreview.value = true
  previewData.value = null
  importResult.value = null
  columnMap.value = {}

  try {
    const buffer = await file.arrayBuffer()
    const url = `${hostStore.bridgeUrl}/api/import/preview`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': file.name,
        'x-project-key': hostStore.activeHost.projectKey,
        'x-project-port': hostStore.activeHost.projectPort,
        'X-Admin-Key': hostStore.adminKey
      },
      body: buffer
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}))
      throw new Error(errJson.error || `HTTP ${res.status}`)
    }

    const data = await res.json()
    previewData.value = data
    uploadId.value = data.uploadId

    // Mapeo 1 a 1 por defecto
    ;(data.columns || []).forEach(c => {
      columnMap.value[c] = c
    })
  } catch (err) {
    alert(`Error al generar vista previa: ${err.message}`)
  } finally {
    loadingPreview.value = false
  }
}

async function executeImport() {
  if (!uploadId.value || !targetTable.value.trim()) return
  importing.value = true
  importResult.value = null

  try {
    const payload = {
      uploadId: uploadId.value,
      tableName: targetTable.value.trim(),
      mapping: columnMap.value,
      truncate: truncateTable.value,
      atomic: atomicTransaction.value
    }

    const res = await api.post('/api/import/execute', payload)
    importResult.value = res.data
    alert(`✅ Importación completada con éxito. Registros insertados: ${res.data?.inserted || 'OK'}`)
  } catch (err) {
    alert(`❌ Error durante la importación: ${err.message}`)
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.importer-layout {
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
  padding: 36px 20px;
  text-align: center;
  background: #F8FAFC;
  cursor: pointer;
  transition: all 0.2s ease;
}
.dropzone:hover, .dropzone.dragover {
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

.mapping-section {
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
  margin-top: 16px;
}
.section-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.mapping-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  margin-top: 8px;
}
.mapping-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
}
.file-col {
  font-size: 0.8rem;
  font-weight: 700;
  min-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mapping-input {
  flex: 1;
  padding: 4px 8px;
  font-size: 0.8rem;
}
</style>
