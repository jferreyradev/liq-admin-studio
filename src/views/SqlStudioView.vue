<template>
  <div class="sql-studio-layout">
    <div class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">✏️ SQL Studio — Creador de Vistas Oracle 11g</h2>
          <p class="text-secondary">Escribe una sentencia SELECT en SQL puro para probarla y registrarla directamente como vista de la API.</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn" @click="loadSampleSql">💡 Cargar Ejemplo</button>
          <button class="btn btn-primary" :disabled="executing" @click="testQuery">
            {{ executing ? '⏳ Ejecutando...' : '▶ Probar Consulta' }}
          </button>
        </div>
      </div>

      <!-- Editor SQL -->
      <div class="editor-container">
        <textarea 
          class="form-control sql-textarea" 
          v-model="sqlQuery"
          placeholder="SELECT p.idpers AS &quot;Id&quot;, p.dni AS &quot;Dni&quot;, p.apellido AS &quot;Apellido&quot; FROM US_SUELDO.PERSONAS p WHERE p.activo = 1"
          rows="8"
        ></textarea>
      </div>

      <!-- Barra para Guardar como Vista Permanente -->
      <div class="save-bar">
        <div class="form-group" style="flex: 1;">
          <label class="form-label">Nombre de la Vista (viewName):</label>
          <input 
            type="text" 
            class="form-control" 
            v-model="viewName" 
            placeholder="ej. misEmpleadosActivos"
          />
        </div>

        <div class="form-group" style="flex: 2;">
          <label class="form-label">Descripción de la Vista:</label>
          <input 
            type="text" 
            class="form-control" 
            v-model="viewDesc" 
            placeholder="ej. Lista de empleados activos con DNI"
          />
        </div>

        <div style="display: flex; align-items: flex-end;">
          <button 
            class="btn btn-primary" 
            :disabled="saving || !viewName.trim() || !sqlQuery.trim()" 
            @click="saveView"
          >
            {{ saving ? '⏳ Guardando...' : '💾 Guardar en Oracle' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Resultados de la Consulta -->
    <ResultsTable 
      :rows="results"
      :duration-ms="lastDuration"
      :error="lastError"
      title="Resultados de la Consulta SQL"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/services/api'
import ResultsTable from '@/components/common/ResultsTable.vue'

const route = useRoute()

const sqlQuery = ref('')
const viewName = ref('')
const viewDesc = ref('')
const executing = ref(false)
const saving = ref(false)
const results = ref([])
const lastDuration = ref(0)
const lastError = ref(null)

onMounted(() => {
  if (route.query.sql) {
    sqlQuery.value = String(route.query.sql)
  }
  if (route.query.viewName) {
    viewName.value = String(route.query.viewName)
  }
})

function loadSampleSql() {
  viewName.value = 'agentesMuestra'
  viewDesc.value = 'Muestra de agentes con legajo y DNI'
  sqlQuery.value = `SELECT 
  p.idpers AS "IdPersona",
  p.dni AS "Dni",
  p.apellido || ' ' || p.nombre AS "NombreCompleto"
FROM US_SUELDO.PERSONAS p
WHERE ROWNUM <= 25`
}

async function testQuery() {
  if (!sqlQuery.value.trim()) return
  executing.value = true
  lastError.value = null
  results.value = []

  try {
    // Probar mediante endpoint temporal o guardar vista efímera
    const tempName = `_temp_studio_${Date.now()}`
    await api.post('/api/view/save', {
      viewName: tempName,
      sql: sqlQuery.value,
      description: 'Vista temporal de prueba'
    })

    const res = await api.get(`/api/view/${tempName}?limit=50`)
    results.value = Array.isArray(res.data) ? res.data : [res.data]
    lastDuration.value = res.durationMs

    // Eliminar la vista temporal
    try { await api.delete(`/api/view/${tempName}`) } catch (_) {}
  } catch (err) {
    lastError.value = err
  } finally {
    executing.value = false
  }
}

async function saveView() {
  if (!viewName.value.trim() || !sqlQuery.value.trim()) return
  saving.value = true
  try {
    const res = await api.post('/api/view/save', {
      viewName: viewName.value.trim(),
      description: viewDesc.value.trim() || `Vista ${viewName.value.trim()}`,
      sql: sqlQuery.value.trim()
    })
    alert(`✅ Vista '${viewName.value.trim()}' guardada con éxito en Oracle y disponible en la API.`)
  } catch (err) {
    alert(`❌ Error al guardar vista: ${err.message}`)
  } finally {
    saving.value = false
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

.editor-container {
  margin-bottom: 16px;
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

.save-bar {
  display: flex;
  gap: 12px;
  background: #F8FAFC;
  padding: 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  flex-wrap: wrap;
}
</style>
