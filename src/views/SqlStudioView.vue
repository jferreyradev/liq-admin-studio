<template>
  <div class="sql-studio-layout">
    <div class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">✏️ SQL Studio — Creador Automático de Consultas Oracle 11g</h2>
          <p class="text-secondary" style="font-size: 0.8rem; margin-top: 2px;">
            Escribe cualquier consulta SELECT pura. El sistema extraerá campos, alias, joins y filtros <code>:param</code> automáticamente.
          </p>
        </div>
        <div class="header-actions-group">
          <select
            class="form-control load-existing-select"
            v-model="selectedPresetView"
            @change="loadFromExistingView(selectedPresetView)"
          >
            <option value="">-- Cargar vista existente como base --</option>
            <option v-for="name in Object.keys(catalogStore.views)" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
          <button class="btn btn-sm" @click="loadSampleSql">💡 Ejemplo</button>
        </div>
      </div>

      <!-- Formulario de Nombre y Descripción -->
      <div class="meta-grid">
        <div class="form-group">
          <label class="form-label">Nombre de la Vista (Identificador en API):</label>
          <input
            type="text"
            class="form-control"
            v-model="viewName"
            placeholder="ej: empleadosPorRep"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Descripción:</label>
          <input
            type="text"
            class="form-control"
            v-model="viewDesc"
            placeholder="ej: Listado de empleados activos por repartición"
          />
        </div>
      </div>

      <!-- Importación directa desde Vista/Tabla física de Oracle (oracleView) -->
      <div class="oracle-view-import-bar">
        <div class="oracle-view-info">
          <span class="oracle-view-label">🏛️ Importar desde Vista o Tabla física de Oracle:</span>
          <span class="oracle-view-sub">Introspecciona las columnas de <code>ALL_TAB_COLUMNS</code> y registra la vista automáticamente.</span>
        </div>
        <div class="oracle-view-controls">
          <input
            type="text"
            class="form-control"
            style="width: 240px;"
            v-model="oracleViewTarget"
            placeholder="Ej: US_SUELDO.V_EMPLEADOS"
          />
          <button
            class="btn btn-sm btn-primary"
            :disabled="saving || !viewName.trim() || !oracleViewTarget.trim()"
            @click="importFromOraclePhysicalView"
          >
            ⚡ Generar desde Objeto Oracle
          </button>
        </div>
      </div>

      <!-- Editor SQL -->
      <div class="editor-container">
        <div class="editor-label-row">
          <label class="form-label">Sentencia SQL SELECT (Compatible con Oracle 11g):</label>
          <span class="bind-hint" v-if="detectedBinds.length > 0">
            🎯 {{ detectedBinds.length }} parámetro(s) detectado(s): <code>{{ detectedBinds.map(b => ':' + b).join(', ') }}</code>
          </span>
        </div>
        <textarea
          class="form-control sql-textarea"
          v-model="sqlQuery"
          placeholder="SELECT p.idpers AS PersonaId, p.dni AS Documento, p.apellido || ', ' || p.nombre AS ApeNom, c.idrep AS IdRep
FROM US_SUELDO.PERSONAS p
INNER JOIN US_SUELDO.CARGOS c ON c.idpers = p.idpers
WHERE c.idrep = :IdRep
ORDER BY p.apellido, p.nombre"
          rows="9"
        ></textarea>
      </div>

      <!-- Parámetros de Prueba si la consulta tiene :binds -->
      <div v-if="detectedBinds.length > 0" class="test-binds-box">
        <div class="section-title">🧪 Valores de Prueba para Parámetros Bind (al ejecutar "Probar Consulta"):</div>
        <div class="binds-grid">
          <div v-for="bind in detectedBinds" :key="bind" class="form-group">
            <label class="form-label">:{{ bind }}</label>
            <input
              type="text"
              class="form-control"
              v-model="testBindValues[bind]"
              :placeholder="`Valor para :${bind}`"
              @keyup.enter="testQuery"
            />
          </div>
        </div>
      </div>

      <!-- Barra de Acciones -->
      <div class="actions-bar">
        <button
          class="btn btn-primary"
          :disabled="saving || !viewName.trim() || !sqlQuery.trim()"
          @click="saveView"
        >
          {{ saving ? '⏳ Guardando...' : '🚀 Guardar en Oracle (API_VIEW_MAPPER)' }}
        </button>

        <button
          class="btn"
          :disabled="executing || !sqlQuery.trim()"
          @click="testQuery"
        >
          {{ executing ? '⏳ Ejecutando...' : '▶ Probar Consulta en Vivo' }}
        </button>

        <button
          class="btn"
          :disabled="!sqlQuery.trim()"
          @click="previewParseStructure"
        >
          ⚡ Previsualizar Parseo JSON
        </button>

        <div class="catalog-sync-btns">
          <button
            class="btn btn-sm"
            @click="triggerImportJson"
            title="Subir un archivo JSON con definiciones de vistas a la base de datos"
          >
            📁 Subir Vistas JSON a BD
          </button>
          <button
            class="btn btn-sm"
            @click="catalogStore.exportViewsJson()"
            title="Descargar todas las vistas de este servidor como archivo JSON"
          >
            📤 Exportar Vistas a JSON
          </button>
          <input
            ref="jsonFileInput"
            type="file"
            accept=".json"
            style="display: none;"
            @change="onJsonFileSelected"
          />
        </div>
      </div>
    </div>

    <!-- Previsualización del Parseo JSON -->
    <div v-if="parsedConfigPreview" class="card">
      <div class="card-header">
        <h3 class="card-title">🔍 Estructura JSON Generada para Oracle 11g (API_VIEW_MAPPER)</h3>
        <button class="btn btn-sm" @click="parsedConfigPreview = null">✕ Cerrar</button>
      </div>
      <pre>{{ JSON.stringify(parsedConfigPreview, null, 2) }}</pre>
    </div>

    <!-- Resultados de la Consulta -->
    <ResultsTable
      :rows="results"
      :duration-ms="lastDuration"
      :error="lastError"
      :loading="executing"
      title="Resultados de Prueba en SQL Studio"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/services/api'
import { useHostStore } from '@/stores/hostStore'
import { useCatalogStore, buildSqlFromViewConfig } from '@/stores/catalogStore'
import ResultsTable from '@/components/common/ResultsTable.vue'

const route = useRoute()
const router = useRouter()
const hostStore = useHostStore()
const catalogStore = useCatalogStore()

const sqlQuery = ref('')
const viewName = ref('')
const viewDesc = ref('')
const oracleViewTarget = ref('')
const selectedPresetView = ref('')
const testBindValues = ref({})
const parsedConfigPreview = ref(null)

const executing = ref(false)
const saving = ref(false)
const results = ref([])
const lastDuration = ref(0)
const lastError = ref(null)
const jsonFileInput = ref(null)

onMounted(async () => {
  if (catalogStore.viewsCount === 0) {
    await catalogStore.loadViews()
  }
  if (route.query.sql) {
    sqlQuery.value = String(route.query.sql)
  }
  if (route.query.viewName) {
    viewName.value = String(route.query.viewName)
  }
  if (route.query.description) {
    viewDesc.value = String(route.query.description)
  }
})

const detectedBinds = computed(() => {
  const sql = sqlQuery.value || ''
  const matches = sql.match(/:([A-Za-z_][A-Za-z0-9_]*)/g) || []
  const unique = new Set(matches.map(m => m.slice(1)))
  return Array.from(unique)
})

function loadFromExistingView(name) {
  if (!name || !catalogStore.views[name]) return
  const cfg = catalogStore.views[name]
  viewName.value = name
  viewDesc.value = cfg.description || `Consulta basada en ${name}`
  sqlQuery.value = buildSqlFromViewConfig(cfg)
  parsedConfigPreview.value = cfg
  hostStore.showToast(`Vista '${name}' cargada en el editor`, 'info')
}

function loadSampleSql() {
  viewName.value = 'empleadosPorRepMuestra'
  viewDesc.value = 'Listado de agentes activos por repartición'
  sqlQuery.value = `SELECT
    p.idpers AS PersonaId,
    p.dni AS Documento,
    p.apellido || ', ' || p.nombre AS ApeNom,
    c.idrep AS IdRep
FROM US_SUELDO.PERSONAS p
INNER JOIN US_SUELDO.CARGOS c ON c.idpers = p.idpers
WHERE c.idrep = :IdRep
ORDER BY p.apellido, p.nombre`
}

function parseSqlClientSide(sqlText) {
  const clean = sqlText.trim().replace(/;+\s*$/, '')
  const upper = clean.toUpperCase()
  if (!upper.startsWith('SELECT') || !upper.includes('FROM')) {
    throw new Error('La consulta debe iniciar con SELECT y contener cláusula FROM.')
  }

  const fromIdx = clean.search(/\bFROM\b/i)
  const selectPart = clean.slice(6, fromIdx).trim()
  const restPart = clean.slice(fromIdx).trim()

  const whereIdx = restPart.search(/\bWHERE\b/i)
  const groupIdx = restPart.search(/\b(GROUP\s+BY|ORDER\s+BY)\b/i)

  let fromSection = restPart
  let whereSection = ''
  let groupSection = ''

  if (whereIdx !== -1) {
    fromSection = restPart.slice(0, whereIdx).trim()
    if (groupIdx !== -1 && groupIdx > whereIdx) {
      whereSection = restPart.slice(whereIdx + 5, groupIdx).trim()
      groupSection = restPart.slice(groupIdx).trim()
    } else {
      whereSection = restPart.slice(whereIdx + 5).trim()
    }
  } else if (groupIdx !== -1) {
    fromSection = restPart.slice(0, groupIdx).trim()
    groupSection = restPart.slice(groupIdx).trim()
  }

  const fields = {}
  selectPart.split(',').forEach((col, i) => {
    const trimmed = col.trim()
    const asMatch = trimmed.match(/^(.*?)\s+AS\s+["']?([A-Za-z0-9_]+)["']?$/i)
    if (asMatch) {
      fields[asMatch[2]] = asMatch[1].trim()
    } else {
      const dotParts = trimmed.split('.')
      const alias = dotParts[dotParts.length - 1].replace(/[^A-Za-z0-9_]/g, '') || `Col${i + 1}`
      fields[alias] = trimmed
    }
  })

  const whereFields = {}
  if (whereSection) {
    const conds = whereSection.split(/\bAND\b/i)
    conds.forEach(c => {
      const bindMatch = c.match(/([A-Za-z0-9_.]+)\s*=\s*:([A-Za-z0-9_]+)/)
      if (bindMatch) {
        whereFields[bindMatch[2]] = bindMatch[1].trim()
      }
    })
  }

  return {
    description: viewDesc.value.trim() || `Vista ${viewName.value.trim() || 'preview'}`,
    fields,
    sql: {
      fromClause: [fromSection],
      whereFields,
      ...(groupSection ? { groupClause: [groupSection] } : {})
    }
  }
}

function previewParseStructure() {
  try {
    parsedConfigPreview.value = parseSqlClientSide(sqlQuery.value)
    hostStore.showToast('Estructura JSON generada', 'info')
  } catch (err) {
    hostStore.showToast(err.message, 'warning')
  }
}

async function testQuery() {
  if (!sqlQuery.value.trim()) return
  executing.value = true
  lastError.value = null
  results.value = []

  const tempName = `_temp_studio_${Date.now()}`
  try {
    const saveRes = await api.post('/api/view/save', {
      viewName: tempName,
      sql: sqlQuery.value.trim(),
      description: 'Vista temporal de prueba SQL Studio'
    })

    if (saveRes.data?.config) {
      parsedConfigPreview.value = saveRes.data.config
    }

    const queryParams = { limit: 50 }
    detectedBinds.value.forEach(b => {
      const val = testBindValues.value[b]
      if (val !== undefined && String(val).trim() !== '') {
        queryParams[b] = String(val).trim()
      }
    })

    const res = await api.get(`/api/view/${tempName}`, queryParams)
    results.value = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : [])
    lastDuration.value = res.durationMs
    hostStore.showToast(`Prueba exitosa: ${results.value.length} fila(s) (${res.durationMs} ms)`, 'success')
  } catch (err) {
    if (err.status === 404) {
      results.value = []
      lastDuration.value = err.durationMs || 0
      hostStore.showToast('La consulta ejecutó sin errores pero devolvió 0 registros', 'warning')
    } else {
      lastError.value = err
      hostStore.showToast(`Error en consulta: ${err.message}`, 'error')
    }
  } finally {
    try {
      await api.delete(`/api/view/${tempName}`)
    } catch (_) {}
    executing.value = false
  }
}

async function saveView() {
  const name = viewName.value.trim()
  const sql = sqlQuery.value.trim()
  if (!name || !sql) {
    hostStore.showToast('El nombre de la vista y la sentencia SQL son obligatorios', 'warning')
    return
  }

  saving.value = true
  try {
    const res = await api.post('/api/view/save', {
      viewName: name,
      description: viewDesc.value.trim() || `Vista ${name}`,
      sql
    })
    if (res.data?.config) {
      parsedConfigPreview.value = res.data.config
    }
    await catalogStore.loadViews()
    hostStore.showToast(`✅ Vista '${name}' guardada exitosamente en Oracle`, 'success')
    router.push({ path: '/views', query: { view: name } })
  } catch (err) {
    hostStore.showToast(`❌ Error al guardar vista: ${err.message}`, 'error')
  } finally {
    saving.value = false
  }
}

async function importFromOraclePhysicalView() {
  const name = viewName.value.trim()
  const target = oracleViewTarget.value.trim()
  if (!name || !target) {
    hostStore.showToast('Ingresa el nombre del endpoint y el objeto Oracle (ej. V_EMPLEADOS)', 'warning')
    return
  }

  saving.value = true
  try {
    const res = await api.post('/api/view/save', {
      viewName: name,
      description: viewDesc.value.trim() || `Vista generada desde ${target}`,
      oracleView: target
    })
    if (res.data?.config) {
      parsedConfigPreview.value = res.data.config
      sqlQuery.value = buildSqlFromViewConfig(res.data.config)
    }
    await catalogStore.loadViews()
    hostStore.showToast(`✅ Vista '${name}' creada automáticamente desde '${target}'`, 'success')
  } catch (err) {
    hostStore.showToast(`❌ Error al generar desde objeto Oracle: ${err.message}`, 'error')
  } finally {
    saving.value = false
  }
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
.sql-studio-layout {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  height: 100%;
}

.header-actions-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.load-existing-select {
  min-width: 240px;
  padding: 5px 10px;
  font-size: 0.8rem;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 14px;
  margin-bottom: 14px;
}

.oracle-view-import-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #F8FAFC;
  border: 1px dashed #CBD5E1;
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.oracle-view-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.oracle-view-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-primary);
}
.oracle-view-sub {
  font-size: 0.74rem;
  color: var(--text-secondary);
}
.oracle-view-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.editor-container {
  margin-bottom: 14px;
}

.editor-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.bind-hint {
  font-size: 0.76rem;
  color: var(--color-primary);
  font-weight: 600;
}

.sql-textarea {
  width: 100%;
  font-family: var(--font-mono);
  background: #0F172A;
  color: #38BDF8;
  border: 1px solid #1E293B;
  padding: 14px;
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  line-height: 1.5;
}
.sql-textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(106, 27, 154, 0.2);
}

.test-binds-box {
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  margin-bottom: 14px;
}
.section-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.binds-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.actions-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.catalog-sync-btns {
  display: flex;
  gap: 6px;
  margin-left: auto;
}
</style>
