<template>
  <div class="help-layout">
    <!-- Índice Lateral del Manual -->
    <div class="help-sidebar">
      <div class="search-header">
        <input
          type="text"
          class="form-control"
          placeholder="Buscar en el manual (ej. JSON, bind, Excel)..."
          v-model="searchQuery"
        />
      </div>

      <div class="topic-list">
        <div
          v-for="section in filteredSections"
          :key="section.id"
          class="topic-item"
          :class="{ active: activeSectionId === section.id }"
          @click="selectSection(section.id)"
        >
          <span class="topic-icon">{{ section.icon }}</span>
          <div class="topic-meta">
            <div class="topic-title">{{ section.title }}</div>
            <div class="topic-sub">{{ section.subtitle }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Contenido del Manual -->
    <div class="help-workspace" ref="workspaceRef">
      <!-- Encabezado General -->
      <div class="card hero-card">
        <div class="hero-content">
          <div>
            <span class="badge badge-info" style="margin-bottom: 6px;">DOCUMENTACIÓN INTERACTIVA</span>
            <h1 class="hero-title">📖 Manual de Uso — Liquid Studio</h1>
            <p class="hero-desc">
              Guía práctica para administrar vistas dinámicas, procedimientos PL/SQL, importaciones masivas Excel/CSV y sincronización entre municipios sobre <strong>Oracle Database 11g / 19c</strong>.
            </p>
          </div>
          <div class="hero-quick-links">
            <button class="btn btn-sm" @click="selectSection('migration')">🔄 Cómo migrar vistas entre municipios</button>
            <button class="btn btn-sm" @click="selectSection('sql-studio')">✏️ Cómo crear una vista SQL</button>
            <button class="btn btn-sm" @click="selectSection('importer')">📁 Cómo importar un Excel a Oracle</button>
          </div>
        </div>
      </div>

      <!-- Sección 1: Multi-Host y Barra Superior -->
      <div v-show="shouldShow('multihost')" id="sec-multihost" class="card help-section-card">
        <div class="section-header">
          <div class="section-title-group">
            <span class="sec-icon">🏢</span>
            <div>
              <h2 class="card-title">1. Conexión Multi-Municipio y Barra Superior</h2>
              <p class="text-secondary">Cómo alternar entre servidores, verificar salud de Oracle y gestionar la caché RAM.</p>
            </div>
          </div>
        </div>

        <div class="help-grid-2">
          <div class="info-box">
            <h4>🌐 Modos de Enrutamiento</h4>
            <ul>
              <li><strong>Servidor Local (`Local :3005`):</strong> Se conecta de forma directa a <code>http://localhost:3005</code> en tu equipo.</li>
              <li><strong>Municipios Remotos (Trancas, Tafí Viejo, Concepción, Burruyacú, Desarrollo):</strong> Enrutan a través del puente seguro Deno inyectando automáticamente las cabeceras <code>x-project-key</code> y <code>x-project-port</code>.</li>
              <li><strong>⚙️ Servidor Personalizado:</strong> Permite conectarte a cualquier IP/URL directa (ej. <code>http://192.168.1.50:3005</code>) o definir un proyecto personalizado del puente.</li>
            </ul>
          </div>

          <div class="info-box">
            <h4>🛠️ Controles de la Barra Superior</h4>
            <ul>
              <li><strong>🟢 Píldora <code>DB: USUARIO@HOST</code>:</strong> Muestra el estado de Oracle. Haz clic sobre ella en cualquier momento para disparar un test de conexión en vivo (<code>/api/admin/health?testDb=true</code>).</li>
              <li><strong>📥 Sincronizar mapperViews:</strong> Lee el archivo local <code>config/mapperViews.js</code> del servidor activo y guarda/actualiza sus 54+ consultas en la tabla <code>API_VIEW_MAPPER</code>.</li>
              <li><strong>🔄 Recargar Caché RAM:</strong> Limpia la memoria RAM del backend Node.js para que tome cambios hechos directamente en la base de datos sin reiniciar el servidor.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Sección 2: Vistas y Consultas -->
      <div v-show="shouldShow('views')" id="sec-views" class="card help-section-card">
        <div class="section-header">
          <div class="section-title-group">
            <span class="sec-icon">📋</span>
            <div>
              <h2 class="card-title">2. Vistas y Consultas Dinámicas (<code>/views</code>)</h2>
              <p class="text-secondary">Ejecución de consultas, proyección de columnas, filtros avanzados y exportación.</p>
            </div>
          </div>
          <button class="btn btn-sm btn-primary" @click="$router.push('/views')">Ir a Vistas ➔</button>
        </div>

        <div class="steps-list">
          <div class="step-item">
            <div class="step-badge">A</div>
            <div class="step-body">
              <h4>Tipos de Vistas: <code>WHERE</code> vs <code>OPEN</code></h4>
              <p>
                En el catálogo lateral verás dos tipos de etiquetas:
                <span class="badge badge-info">WHERE</span> indica que la consulta tiene parámetros indexados fijos (ej. <code>IdRep</code>, <code>Periodo</code>).
                <span class="badge badge-warning">OPEN</span> indica que la consulta tiene <strong>filtros abiertos</strong> y te permite filtrar por cualquiera de las columnas que devuelve.
              </p>
            </div>
          </div>

          <div class="step-item">
            <div class="step-badge">B</div>
            <div class="step-body">
              <h4>Proyección de Columnas (<code>?fields=Col1,Col2</code>)</h4>
              <p>
                Haz clic en <strong>"Seleccionar columnas"</strong> para activar o desactivar píldoras con los campos de la vista. La API construirá un <code>SELECT</code> trayendo únicamente las columnas elegidas para ahorrar ancho de banda.
              </p>
            </div>
          </div>

          <div class="step-item">
            <div class="step-badge">C</div>
            <div class="step-body">
              <h4>Filtros Avanzados del Motor (<code>baseQuery</code>)</h4>
              <ul>
                <li><strong>Búsqueda parcial LIKE (<code>search</code>):</strong> Escribe <code>Campo:texto</code> (ej. <code>ApeNom:GARCIA</code>) para buscar coincidencias parciales sin importar mayúsculas/minúsculas.</li>
                <li><strong>Ordenamiento dinámico (<code>sort</code>):</strong> Escribe un JSON indicando dirección <code>asc</code> o <code>desc</code>, por ejemplo: <code>{"PersonaId":"desc"}</code>.</li>
                <li><strong>Paginación (<code>limit</code> y <code>offset</code>):</strong> Compatible 100% con Oracle 11g mediante subconsulta <code>ROWNUM</code>. Usa los botones <strong>◀</strong> y <strong>▶</strong> para avanzar o retroceder de página.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Sección 3: SQL Studio y Creación de Vistas -->
      <div v-show="shouldShow('sql-studio')" id="sec-sql-studio" class="card help-section-card">
        <div class="section-header">
          <div class="section-title-group">
            <span class="sec-icon">✏️</span>
            <div>
              <h2 class="card-title">3. SQL Studio — Creación e Importación de Vistas (<code>/sql-studio</code>)</h2>
              <p class="text-secondary">Tres formas de registrar nuevos endpoints de consulta en Oracle sin tocar el código del servidor.</p>
            </div>
          </div>
          <button class="btn btn-sm btn-primary" @click="$router.push('/sql-studio')">Ir a SQL Studio ➔</button>
        </div>

        <div class="help-grid-3">
          <div class="method-card">
            <div class="method-tag">Opción 1 • SQL Puro</div>
            <h4>Desde una sentencia <code>SELECT</code></h4>
            <p>Escribe cualquier consulta <code>SELECT ... FROM ... WHERE ...</code>.</p>
            <ul>
              <li>Usa alias con <code>AS NombreCampo</code> para definir cómo se llamará la propiedad en el JSON.</li>
              <li>Usa dos puntos (ej. <code>WHERE c.idrep = :IdRep</code>) para crear filtros URL automáticos.</li>
              <li>SQL Studio detectará <code>:IdRep</code> y te mostrará un campo de prueba para ejecutar <strong>▶ Probar Consulta en Vivo</strong> antes de guardarla.</li>
            </ul>
          </div>

          <div class="method-card">
            <div class="method-tag">Opción 2 • Objeto Oracle</div>
            <h4>Desde una Vista o Tabla Física</h4>
            <p>Si ya creaste una vista en Oracle (ej. <code>US_SUELDO.V_LIQ_ACTIVA</code>):</p>
            <ul>
              <li>Escribe el nombre del endpoint en <strong>Nombre de la Vista</strong>.</li>
              <li>En el bloque <strong>"🏛️ Importar desde Vista o Tabla física de Oracle"</strong> escribe <code>US_SUELDO.V_LIQ_ACTIVA</code>.</li>
              <li>Pulsa <strong>⚡ Generar desde Objeto Oracle</strong>: la API leerá <code>ALL_TAB_COLUMNS</code> y creará la vista automáticamente.</li>
            </ul>
          </div>

          <div class="method-card">
            <div class="method-tag">Opción 3 • Clonar Existente</div>
            <h4>Basarse en una Vista Actual</h4>
            <p>Usa el selector superior <strong>"-- Cargar vista existente como base --"</strong>:</p>
            <ul>
              <li>Recupera el SQL reconstruido de cualquier vista del catálogo.</li>
              <li>Cámbiale el nombre, agrega columnas o filtros <code>JOIN</code> / <code>WHERE</code> y guárdala como una nueva vista.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Sección 4: Migración de Vistas y SPs entre Municipios -->
      <div v-show="shouldShow('migration')" id="sec-migration" class="card help-section-card highlight-card">
        <div class="section-header">
          <div class="section-title-group">
            <span class="sec-icon">🔄</span>
            <div>
              <h2 class="card-title">4. Cómo Migrar / Clonar Vistas y SPs entre Municipios (Import / Export JSON)</h2>
              <p class="text-secondary">Lleva las vistas y el catálogo de Stored Procedures / Funciones desde Desarrollo o Localhost hacia Trancas, Concepción, Tafí Viejo o Burruyacú en segundos.</p>
            </div>
          </div>
        </div>

        <div class="workflow-steps">
          <div class="wf-step">
            <span class="wf-num">1</span>
            <div>
              <strong>Selecciona el servidor origen</strong>
              <p>En el selector superior <code>🏢 Servidor</code>, elige <strong>Desarrollo</strong> o <strong>Localhost</strong>.</p>
            </div>
          </div>
          <div class="wf-arrow">➔</div>
          <div class="wf-step">
            <span class="wf-num">2</span>
            <div>
              <strong>Exporta el catálogo a JSON</strong>
              <p>En <strong>Vistas</strong> o en <strong>Stored Procedures & FNs</strong>, pulsa <strong>📤 Exportar JSON</strong> (o <strong>📦</strong> para el paquete completo de SPs + FNs).</p>
            </div>
          </div>
          <div class="wf-arrow">➔</div>
          <div class="wf-step">
            <span class="wf-num">3</span>
            <div>
              <strong>Cambia al municipio destino</strong>
              <p>En <code>🏢 Servidor</code>, selecciona el municipio destino (ej. <strong>Trancas</strong> o <strong>Concepción</strong>).</p>
            </div>
          </div>
          <div class="wf-arrow">➔</div>
          <div class="wf-step">
            <span class="wf-num">4</span>
            <div>
              <strong>Importa el archivo JSON</strong>
              <p>Pulsa <strong>📁 Importar JSON</strong> y selecciona el archivo descargado. Quedará registrado y activo en memoria al instante.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Sección 5: Stored Procedures y Funciones -->
      <div v-show="shouldShow('procedures')" id="sec-procedures" class="card help-section-card">
        <div class="section-header">
          <div class="section-title-group">
            <span class="sec-icon">⚡</span>
            <div>
              <h2 class="card-title">5. Stored Procedures y Funciones PL/SQL (<code>/procedures</code>)</h2>
              <p class="text-secondary">Ejecución interactiva con introspección en vivo desde <code>ALL_ARGUMENTS</code>.</p>
            </div>
          </div>
          <button class="btn btn-sm btn-primary" @click="$router.push('/procedures')">Ir a SPs & FNs ➔</button>
        </div>

        <div class="help-grid-2">
          <div class="info-box">
            <h4>⚡ Ejecución, Exportación y Regla de Períodos (Día <code>01</code>)</h4>
            <ul>
              <li>Alterna entre <strong>Stored Procedures</strong> (<code>POST /api/sp/:name</code>) y <strong>Funciones</strong> (<code>POST /api/fn/:name</code>).</li>
              <li><strong>📤 Descarga e Importación de SPs y Funciones:</strong> En la cabecera de la lista lateral puedes pulsar <strong>📤</strong> para descargar los SPs o Funciones disponibles a JSON, <strong>📦</strong> para descargar el paquete completo (SPs + Funciones), <strong>📁</strong> para importar un lote JSON y <strong>🔎</strong> para descubrir/sincronizar todos los procedimientos desde <code>ALL_ARGUMENTS</code> en Oracle.</li>
              <li><strong>📅 Regla Obligatoria de Períodos (Día <code>01</code> Fijo):</strong> En toda la API, cualquier parámetro de período (<code>Periodo</code>, <code>vPERIODO</code>, <code>PeriodoLiq</code>, <code>vPER</code>) utiliza <strong>siempre el día <code>01</code></strong>; solamente cambian el mes y el año. Puedes ingresar <code>09/2026</code>, <code>2026-09</code>, <code>202609</code> o <code>01/09/2026</code> y el sistema forzará automáticamente el día <code>01</code> en medianoche local.</li>
              <li>Durante la ejecución verás un <strong>cronómetro en tiempo real</strong> y los campos se bloquearán hasta que Oracle confirme la transacción.</li>
            </ul>
          </div>

          <div class="info-box">
            <h4>🩺 Solución de Errores Frecuentes</h4>
            <ul>
              <li><strong><code>200 OK</code> sin efecto o en 0s:</strong> Asegúrate de que el período e IDs de liquidación coincidan con registros existentes. El Studio normaliza todo período al día <code>01</code> a las <code>00:00:00</code> hora local para evitar desfases UTC-3 con el tipo <code>DATE</code> de Oracle.</li>
              <li><strong><code>ORA-06550</code> / <code>PLS-00306: wrong number or types of arguments</code>:</strong> Indica que faltan parámetros obligatorios o que el paquete en Oracle cambió su firma. Pulsa <strong>🔄 Recargar Caché RAM</strong> en la barra superior para re-introspeccionar <code>ALL_ARGUMENTS</code>.</li>
              <li><strong><code>ORA-12170: TNS:Connect timeout occurred</code>:</strong> Verifica que la VPN municipal esté conectada y que el listener de Oracle responda en el puerto 1521.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Sección 6: Importador Masivo Excel / CSV -->
      <div v-show="shouldShow('importer')" id="sec-importer" class="card help-section-card">
        <div class="section-header">
          <div class="section-title-group">
            <span class="sec-icon">📁</span>
            <div>
              <h2 class="card-title">6. Importador Masivo Excel / CSV a Oracle (<code>/importer</code>)</h2>
              <p class="text-secondary">Inserción de alto rendimiento por lotes (<code>executeMany</code>) con validación de tipos e integridad transaccional.</p>
            </div>
          </div>
          <button class="btn btn-sm btn-primary" @click="$router.push('/importer')">Ir al Importador ➔</button>
        </div>

        <div class="steps-list">
          <div class="step-item">
            <div class="step-badge">1</div>
            <div class="step-body">
              <h4>Subida y Selección de Hoja Excel</h4>
              <p>Arrastra un archivo <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>, <code>.tsv</code> o <code>.txt</code> (hasta 50 MB). Si el Excel tiene varias hojas, elige la hoja deseada en el selector desplegable.</p>
            </div>
          </div>

          <div class="step-item">
            <div class="step-badge">2</div>
            <div class="step-body">
              <h4>Introspección de Tabla y Columnas Oracle</h4>
              <p>Selecciona la tabla destino en el panel izquierdo o escríbela (ej. <code>US_SUELDO.HOJA_NOV</code>) y pulsa <strong>🔍 Inspeccionar Columnas</strong>. El sistema consultará los tipos exactos (<code>NUMBER</code>, <code>VARCHAR2</code>, <code>DATE</code>) en Oracle.</p>
            </div>
          </div>

          <div class="step-item">
            <div class="step-badge">3</div>
            <div class="step-body">
              <h4>Mapeo Inteligente y Opciones Transaccionales</h4>
              <p>
                Verifica la asociación entre cada columna del archivo y la columna de Oracle (puedes elegir <code>(No importar / Ignorar)</code> para descartar columnas).
                Si activas <strong>🔒 Modo Transaccional Atómico</strong>, cualquier error en una fila hará <code>ROLLBACK</code> completo para no dejar datos incompletos.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Sección 7: API Explorer y Referencia Rápida -->
      <div v-show="shouldShow('explorer')" id="sec-explorer" class="card help-section-card">
        <div class="section-header">
          <div class="section-title-group">
            <span class="sec-icon">🌐</span>
            <div>
              <h2 class="card-title">7. API Explorer y Referencia de Endpoints (<code>/explorer</code>)</h2>
              <p class="text-secondary">Resumen de rutas HTTP y cabeceras para consumo desde frontends o línea de comandos.</p>
            </div>
          </div>
          <button class="btn btn-sm btn-primary" @click="$router.push('/explorer')">Ir a API Explorer ➔</button>
        </div>

        <div class="table-container" style="margin-bottom: 14px;">
          <table>
            <thead>
              <tr>
                <th>Método</th>
                <th>Endpoint</th>
                <th>Autenticación</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="badge badge-success">GET</span></td>
                <td><code>/api/view/list</code></td>
                <td>Pública</td>
                <td>Devuelve el catálogo JSON de todas las vistas activas.</td>
              </tr>
              <tr>
                <td><span class="badge badge-success">GET</span></td>
                <td><code>/api/view/:name</code></td>
                <td>Pública</td>
                <td>Ejecuta una vista. Soporta <code>?fields=</code>, <code>?limit=</code>, <code>?offset=</code>, <code>?search=</code>, <code>?sort=</code> y filtros por campo.</td>
              </tr>
              <tr>
                <td><span class="badge badge-info">POST</span></td>
                <td><code>/api/view/save</code></td>
                <td><code>X-Admin-Key</code></td>
                <td>Crea o actualiza una vista enviando <code>{ viewName, description, sql }</code> u <code>{ oracleView }</code>.</td>
              </tr>
              <tr>
                <td><span class="badge badge-info">POST</span></td>
                <td><code>/api/view/import-json</code></td>
                <td><code>X-Admin-Key</code></td>
                <td>Importa masivamente un objeto JSON de vistas hacia <code>API_VIEW_MAPPER</code>.</td>
              </tr>
              <tr>
                <td><span class="badge badge-info">POST</span></td>
                <td><code>/api/view/seed-from-file</code></td>
                <td><code>X-Admin-Key</code></td>
                <td>Sincroniza el archivo <code>config/mapperViews.js</code> del servidor hacia Oracle.</td>
              </tr>
              <tr>
                <td><span class="badge badge-success">GET</span></td>
                <td><code>/api/sp/list</code> / <code>/api/fn/list</code></td>
                <td>Pública</td>
                <td>Devuelve el catálogo completo de Stored Procedures y Funciones disponibles.</td>
              </tr>
              <tr>
                <td><span class="badge badge-info">POST</span></td>
                <td><code>/api/sp/:name</code></td>
                <td>Pública</td>
                <td>Ejecuta un Stored Procedure enviando los parámetros <code>IN</code> en el cuerpo JSON.</td>
              </tr>
              <tr>
                <td><span class="badge badge-info">POST</span></td>
                <td><code>/api/sp/import-json</code></td>
                <td><code>X-Admin-Key</code></td>
                <td>Importa un catálogo JSON de SPs y/o Funciones en la caché RAM y en <code>spmapper.local.json</code>.</td>
              </tr>
              <tr>
                <td><span class="badge badge-info">POST</span></td>
                <td><code>/api/sp/sync-oracle</code></td>
                <td><code>X-Admin-Key</code></td>
                <td>Descubre y sincroniza en vivo todos los SPs y Funciones desde <code>ALL_ARGUMENTS</code> en Oracle.</td>
              </tr>
              <tr>
                <td><span class="badge badge-info">POST</span></td>
                <td><code>/api/fn/:name</code></td>
                <td>Pública</td>
                <td>Ejecuta una Función PL/SQL en Oracle y retorna el valor calculado.</td>
              </tr>
              <tr>
                <td><span class="badge badge-info">POST</span></td>
                <td><code>/api/import/preview</code></td>
                <td><code>X-Admin-Key</code></td>
                <td>Recibe el binario Excel/CSV (<code>application/octet-stream</code>) y devuelve <code>uploadId</code>, hojas y muestra.</td>
              </tr>
              <tr>
                <td><span class="badge badge-info">POST</span></td>
                <td><code>/api/import/execute</code></td>
                <td><code>X-Admin-Key</code></td>
                <td>Inserta en Oracle el archivo previsualizado mediante <code>{ uploadId, tableName, mapping, truncate, atomic }</code>.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const searchQuery = ref('')
const activeSectionId = ref('all')
const workspaceRef = ref(null)

const sections = [
  {
    id: 'all',
    icon: '📚',
    title: 'Todo el Manual',
    subtitle: 'Ver todas las secciones completas',
    keywords: 'todo manual completo guia ayuda'
  },
  {
    id: 'multihost',
    icon: '🏢',
    title: '1. Multi-Host y Barra Superior',
    subtitle: 'Municipios, puente Deno, Salud BD y Caché RAM',
    keywords: 'servidor municipio trancas concepcion tafi viejo burruyacu local bridge cache ram health oracle'
  },
  {
    id: 'views',
    icon: '📋',
    title: '2. Vistas y Consultas',
    subtitle: 'Proyección fields, search LIKE, sort y paginación',
    keywords: 'vistas consultas where open fields columnas filtros paginacion limit offset search sort csv json'
  },
  {
    id: 'sql-studio',
    icon: '✏️',
    title: '3. SQL Studio',
    subtitle: 'Crear vistas desde SELECT o tabla/vista física Oracle',
    keywords: 'sql studio crear vista select from where bind parametro oracleview tabla fisica'
  },
  {
    id: 'migration',
    icon: '🔄',
    title: '4. Migrar Vistas entre Municipios',
    subtitle: 'Exportar e importar lotes JSON de vistas',
    keywords: 'migrar clonar importar exportar json vistas municipios sincronizar'
  },
  {
    id: 'procedures',
    icon: '⚡',
    title: '5. Stored Procedures y Funciones',
    subtitle: 'Ejecución PL/SQL, binds IN/OUT y errores PLS-00306',
    keywords: 'sp procedimientos funciones plsql in out binds cursor pls-00306 ora-06550'
  },
  {
    id: 'importer',
    icon: '📁',
    title: '6. Importador Excel / CSV',
    subtitle: 'Carga masiva executeMany, mapeo y modo atómico',
    keywords: 'importar excel csv xlsx tabla columnas mapeo truncate rollback atomico executemany'
  },
  {
    id: 'explorer',
    icon: '🌐',
    title: '7. API Explorer y Endpoints',
    subtitle: 'Tabla de rutas HTTP, cabeceras y cURL',
    keywords: 'explorer endpoints rutas http get post delete curl headers x-admin-key'
  }
]

const filteredSections = computed(() => {
  if (!searchQuery.value.trim()) return sections
  const q = searchQuery.value.toLowerCase().trim()
  return sections.filter(s =>
    s.id === 'all' ||
    s.title.toLowerCase().includes(q) ||
    s.subtitle.toLowerCase().includes(q) ||
    s.keywords.includes(q)
  )
})

function selectSection(id) {
  activeSectionId.value = id
  if (workspaceRef.value) {
    workspaceRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function shouldShow(sectionId) {
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    const sec = sections.find(s => s.id === sectionId)
    if (!sec) return true
    return (
      sec.title.toLowerCase().includes(q) ||
      sec.subtitle.toLowerCase().includes(q) ||
      sec.keywords.includes(q)
    )
  }
  return activeSectionId.value === 'all' || activeSectionId.value === sectionId
}
</script>

<style scoped>
.help-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.help-sidebar {
  width: 290px;
  min-width: 290px;
  border-right: 1px solid var(--border-color);
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
}

.search-header {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
}

.topic-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.topic-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  margin-bottom: 4px;
  border-left: 3px solid transparent;
  transition: all 0.15s ease;
}
.topic-item:hover {
  background: var(--bg-hover);
}
.topic-item.active {
  background: rgba(106, 27, 154, 0.08);
  border-left-color: var(--color-primary);
}
.topic-icon {
  font-size: 1.15rem;
  margin-top: 1px;
}
.topic-title {
  font-size: 0.83rem;
  font-weight: 700;
  color: var(--text-primary);
}
.topic-sub {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-top: 2px;
  line-height: 1.3;
}

.help-workspace {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.hero-card {
  background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%);
  border-left: 4px solid var(--color-primary);
}
.hero-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}
.hero-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.hero-desc {
  font-size: 0.88rem;
  color: var(--text-secondary);
  max-width: 720px;
  line-height: 1.5;
}
.hero-quick-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.help-section-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.highlight-card {
  border-color: #CBD5E1;
  background: #F8FAFC;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
  gap: 12px;
  flex-wrap: wrap;
}
.section-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sec-icon {
  font-size: 1.5rem;
}

.help-grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 14px;
}
.help-grid-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 14px;
}

.info-box {
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  font-size: 0.84rem;
  line-height: 1.55;
}
.info-box h4 {
  font-size: 0.9rem;
  margin-bottom: 8px;
  color: var(--text-primary);
}
.info-box ul {
  margin-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.step-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
}
.step-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #FFFFFF;
  font-weight: 700;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.step-body {
  font-size: 0.84rem;
  line-height: 1.5;
}
.step-body h4 {
  font-size: 0.9rem;
  margin-bottom: 4px;
  color: var(--text-primary);
}
.step-body ul {
  margin-left: 18px;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.method-card {
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  font-size: 0.83rem;
  line-height: 1.5;
}
.method-tag {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-primary);
  background: rgba(106, 27, 154, 0.08);
  padding: 2px 8px;
  border-radius: 9999px;
  margin-bottom: 6px;
}
.method-card h4 {
  font-size: 0.92rem;
  margin-bottom: 6px;
}
.method-card ul {
  margin-left: 16px;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workflow-steps {
  display: flex;
  align-items: stretch;
  gap: 10px;
  flex-wrap: wrap;
}
.wf-step {
  flex: 1;
  min-width: 180px;
  background: #FFFFFF;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  display: flex;
  gap: 10px;
  font-size: 0.82rem;
  line-height: 1.45;
}
.wf-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #FFFFFF;
  font-weight: 700;
  font-size: 0.78rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wf-arrow {
  display: flex;
  align-items: center;
  font-weight: 700;
  color: var(--text-muted);
}
</style>
