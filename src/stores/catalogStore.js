import { defineStore } from 'pinia'
import { api } from '@/services/api'
import { useHostStore } from '@/stores/hostStore'

export function buildSqlFromViewConfig(config) {
  if (!config) return ''
  if (config.rawSql) return config.rawSql

  const fields = config.fields || {}
  const fieldEntries = Object.entries(fields)
  let sql = 'SELECT\n'
  if (fieldEntries.length === 0) {
    sql += '    *\n'
  } else {
    const fieldLines = fieldEntries.map(([alias, expr]) => {
      const cleanExpr = String(expr || '').trim()
      const cleanAlias = String(alias || '').trim()
      if (cleanExpr.toLowerCase() === cleanAlias.toLowerCase() || cleanExpr.endsWith('.' + cleanAlias)) {
        return '    ' + cleanExpr
      }
      return '    ' + cleanExpr + ' AS ' + cleanAlias
    })
    sql += fieldLines.join(',\n') + '\n'
  }

  const fromClause = Array.isArray(config.sql?.fromClause)
    ? config.sql.fromClause
    : (config.sql?.fromClause ? [config.sql.fromClause] : [])

  if (fromClause.length > 0) {
    fromClause.forEach((line, idx) => {
      const trimmed = String(line || '').trim()
      if (idx === 0 && !trimmed.toUpperCase().startsWith('FROM')) {
        sql += 'FROM ' + trimmed + '\n'
      } else {
        sql += trimmed + '\n'
      }
    })
  }

  const whereFields = config.sql?.whereFields || {}
  const whereEntries = Object.entries(whereFields)
  if (whereEntries.length > 0) {
    sql += 'WHERE\n'
    const whereLines = whereEntries.map(([param, col]) => String(col || '').trim() + ' = :' + String(param || '').trim())
    sql += '    ' + whereLines.join('\n    AND ') + '\n'
  }

  const groupClause = Array.isArray(config.sql?.groupClause)
    ? config.sql.groupClause
    : (config.sql?.groupClause ? [config.sql.groupClause] : [])
  if (groupClause.length > 0) {
    groupClause.forEach(line => {
      sql += String(line || '').trim() + '\n'
    })
  }

  return sql.trim()
}

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    views: {},
    sp: {},
    fn: {},
    repo: {},
    entities: {},
    tables: [],
    loadingViews: false,
    loadingProcedures: false,
    loadingTables: false,
    loadedHostId: null
  }),

  getters: {
    viewsCount: (state) => Object.keys(state.views || {}).length,
    spCount: (state) => Object.keys(state.sp || {}).length,
    fnCount: (state) => Object.keys(state.fn || {}).length,
    repoCount: (state) => Object.keys(state.repo || {}).length,
    entitiesCount: (state) => Object.keys(state.entities || {}).length,
    tablesCount: (state) => (state.tables || []).length
  },

  actions: {
    async loadAllCatalogs(force = false) {
      const hostStore = useHostStore()
      if (!hostStore.isAuthenticated) return
      if (!force && this.loadedHostId === hostStore.activeHostId && this.viewsCount > 0) {
        return
      }
      this.loadedHostId = hostStore.activeHostId

      await Promise.allSettled([
        this.loadViews(),
        this.loadProcedures(),
        this.loadExtras()
      ])
    },

    async loadViews() {
      this.loadingViews = true
      try {
        const res = await api.get('/api/view/list')
        this.views = res.data || {}
      } catch (err) {
        console.error('Error cargando catálogo de vistas:', err)
      } finally {
        this.loadingViews = false
      }
    },

    async loadProcedures() {
      this.loadingProcedures = true
      try {
        const [spRes, fnRes] = await Promise.allSettled([
          api.get('/api/sp/list'),
          api.get('/api/fn/list')
        ])
        if (spRes.status === 'fulfilled') this.sp = spRes.value.data || {}
        if (fnRes.status === 'fulfilled') this.fn = fnRes.value.data || {}
      } catch (err) {
        console.error('Error cargando procedimientos:', err)
      } finally {
        this.loadingProcedures = false
      }
    },

    async loadExtras() {
      try {
        const [repoRes, enRes] = await Promise.allSettled([
          api.get('/api/repo/list'),
          api.get('/api/en/list')
        ])
        if (repoRes.status === 'fulfilled') this.repo = repoRes.value.data || {}
        if (enRes.status === 'fulfilled') this.entities = enRes.value.data || {}
      } catch (_) {}
    },

    async loadTables() {
      this.loadingTables = true
      try {
        const res = await api.get('/api/import/tables')
        this.tables = res.data?.tables || []
      } catch (err) {
        console.warn('No se pudo cargar lista de tablas Oracle:', err)
      } finally {
        this.loadingTables = false
      }
    },

    exportViewsJson() {
      const hostStore = useHostStore()
      if (!this.views || Object.keys(this.views).length === 0) {
        hostStore.showToast('No hay vistas cargadas en el catálogo para exportar', 'warning')
        return
      }
      const jsonStr = JSON.stringify(this.views, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toISOString().slice(0, 10)
      const hostSlug = hostStore.activeHost.id || 'server'
      a.download = `views_catalog_${hostSlug}_${dateStr}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      hostStore.showToast(`Catálogo de ${this.viewsCount} vistas exportado exitosamente`, 'success')
    },

    async importViewsJsonFile(file) {
      const hostStore = useHostStore()
      if (!file) return false
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        const viewsPayload = (parsed && (parsed.jsonViewMap || parsed.views))
          ? (parsed.jsonViewMap || parsed.views)
          : parsed
        const count = Object.keys(viewsPayload || {}).length
        if (count === 0) {
          hostStore.showToast('El archivo JSON no contiene definiciones de vistas válidas', 'warning')
          return false
        }

        if (!confirm(`Se encontraron ${count} consultas en "${file.name}".\n\n¿Deseas importarlas y guardarlas en la tabla API_VIEW_MAPPER de ${hostStore.activeHost.name}?`)) {
          return false
        }

        hostStore.showToast(`Importando ${count} consultas a Oracle (${hostStore.activeHost.shortName})...`, 'info')
        const res = await api.post('/api/view/import-json', viewsPayload)
        hostStore.showToast(`✅ ${res.data?.message || `${count} vistas importadas exitosamente`}`, 'success')
        await this.loadViews()
        return true
      } catch (err) {
        hostStore.showToast(`Error al importar JSON: ${err.message}`, 'error')
        return false
      }
    },

    exportProceduresJson(type = 'sp') {
      const hostStore = useHostStore()
      const dateStr = new Date().toISOString().slice(0, 10)
      const hostSlug = hostStore.activeHost.id || 'server'

      let payload = null
      let fileName = ''
      let label = ''

      if (type === 'fn') {
        if (!this.fn || Object.keys(this.fn).length === 0) {
          hostStore.showToast('No hay funciones cargadas en el catálogo para exportar', 'warning')
          return
        }
        payload = this.fn
        fileName = `fn_catalog_${hostSlug}_${dateStr}.json`
        label = `${this.fnCount} funciones`
      } else if (type === 'all') {
        if (this.spCount === 0 && this.fnCount === 0) {
          hostStore.showToast('No hay procedimientos ni funciones cargadas para exportar', 'warning')
          return
        }
        payload = {
          jsonStoreProcedure: this.sp || {},
          jsonStoreFunction: this.fn || {}
        }
        fileName = `procedures_catalog_${hostSlug}_${dateStr}.json`
        label = `${this.spCount} SPs y ${this.fnCount} funciones`
      } else {
        if (!this.sp || Object.keys(this.sp).length === 0) {
          hostStore.showToast('No hay Stored Procedures cargados en el catálogo para exportar', 'warning')
          return
        }
        payload = this.sp
        fileName = `sp_catalog_${hostSlug}_${dateStr}.json`
        label = `${this.spCount} Stored Procedures`
      }

      const jsonStr = JSON.stringify(payload, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      hostStore.showToast(`Catálogo de ${label} descargado exitosamente (${fileName})`, 'success')
    },

    async importProceduresJsonFile(file) {
      const hostStore = useHostStore()
      if (!file) return false
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          hostStore.showToast('El archivo JSON no tiene un formato válido de catálogo SP/FN', 'warning')
          return false
        }

        const spMap = {}
        const fnMap = {}

        if (parsed.jsonStoreProcedure || parsed.sp || parsed.jsonStoreFunction || parsed.fn) {
          Object.assign(spMap, parsed.jsonStoreProcedure || parsed.sp || {})
          Object.assign(fnMap, parsed.jsonStoreFunction || parsed.fn || {})
        } else {
          for (const [k, v] of Object.entries(parsed)) {
            if (!v || typeof v !== 'object') continue
            if (v.fn_name) {
              fnMap[k] = v
            } else if (v.sp_name) {
              spMap[k] = v
            }
          }
        }

        const spTotal = Object.keys(spMap).length
        const fnTotal = Object.keys(fnMap).length
        if (spTotal === 0 && fnTotal === 0) {
          hostStore.showToast('No se encontraron definiciones de SPs (sp_name) ni Funciones (fn_name) en el archivo', 'warning')
          return false
        }

        if (!confirm(`Se encontraron ${spTotal} Stored Procedure(s) y ${fnTotal} Función(es) en "${file.name}".\n\n¿Deseas importarlos en el catálogo de ${hostStore.activeHost.name}?`)) {
          return false
        }

        // Actualizar catálogo inmediatamente en memoria del cliente
        if (spTotal > 0) {
          this.sp = { ...this.sp, ...spMap }
        }
        if (fnTotal > 0) {
          this.fn = { ...this.fn, ...fnMap }
        }

        try {
          await api.post('/api/sp/import-json', {
            jsonStoreProcedure: spMap,
            jsonStoreFunction: fnMap
          })
          await this.loadProcedures()
        } catch (_) {
          // Si el backend remoto aún no expone /api/sp/import-json, se mantiene activo en el catálogo local de la sesión
        }

        hostStore.showToast(`✅ Catálogo actualizado: ${spTotal} SP(s) y ${fnTotal} Función(es) importadas`, 'success')
        return true
      } catch (err) {
        hostStore.showToast(`Error al importar JSON de procedimientos: ${err.message}`, 'error')
        return false
      }
    },

    async syncProceduresFromOracle(packageName = '') {
      const hostStore = useHostStore()
      this.loadingProcedures = true
      try {
        hostStore.showToast(`Introspeccionando ALL_ARGUMENTS en Oracle (${hostStore.activeHost.shortName})...`, 'info')
        const res = await api.post('/api/sp/sync-oracle', packageName ? { packageName } : {})
        await this.loadProcedures()
        hostStore.showToast(`✅ ${res.data?.message || `Catálogo sincronizado (${this.spCount} SPs y ${this.fnCount} Funciones)`}`, 'success')
        return true
      } catch (err) {
        hostStore.showToast(`No se pudo sincronizar desde Oracle: ${err.message}`, 'warning')
        return false
      } finally {
        this.loadingProcedures = false
      }
    }
  }
})
