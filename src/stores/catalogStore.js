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
    selectedViews: [],
    selectedSp: [],
    selectedFn: [],
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
    tablesCount: (state) => (state.tables || []).length,
    selectedViewsCount: (state) => (state.selectedViews || []).length,
    selectedSpCount: (state) => (state.selectedSp || []).length,
    selectedFnCount: (state) => (state.selectedFn || []).length,
    totalSelectedForAgent: (state) =>
      (state.selectedViews || []).length +
      (state.selectedSp || []).length +
      (state.selectedFn || []).length
  },

  actions: {
    toggleViewSelection(name) {
      if (!name) return
      const idx = this.selectedViews.indexOf(name)
      if (idx >= 0) {
        this.selectedViews.splice(idx, 1)
      } else {
        this.selectedViews.push(name)
      }
    },

    selectViews(names = []) {
      const set = new Set([...this.selectedViews, ...names])
      this.selectedViews = Array.from(set)
    },

    clearSelectedViews() {
      this.selectedViews = []
    },

    toggleProcSelection(type = 'sp', name) {
      if (!name) return
      const list = type === 'fn' ? this.selectedFn : this.selectedSp
      const idx = list.indexOf(name)
      if (idx >= 0) {
        list.splice(idx, 1)
      } else {
        list.push(name)
      }
    },

    selectProcs(type = 'sp', names = []) {
      if (type === 'fn') {
        this.selectedFn = Array.from(new Set([...this.selectedFn, ...names]))
      } else {
        this.selectedSp = Array.from(new Set([...this.selectedSp, ...names]))
      }
    },

    clearSelectedProcs(type = 'all') {
      if (type === 'sp' || type === 'all') this.selectedSp = []
      if (type === 'fn' || type === 'all') this.selectedFn = []
    },

    clearAllSelections() {
      this.selectedViews = []
      this.selectedSp = []
      this.selectedFn = []
    },

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

    exportViewsJson(onlyNames = null) {
      const hostStore = useHostStore()
      if (!this.views || Object.keys(this.views).length === 0) {
        hostStore.showToast('No hay vistas cargadas en el catálogo para exportar', 'warning')
        return
      }

      const targetNames = Array.isArray(onlyNames)
        ? onlyNames
        : (this.selectedViews.length > 0 ? this.selectedViews : null)

      let payload = {}
      if (targetNames && targetNames.length > 0) {
        targetNames.forEach(name => {
          if (this.views[name]) {
            payload[name] = {
              ...this.views[name],
              sqlQuery: buildSqlFromViewConfig(this.views[name])
            }
          }
        })
      } else {
        payload = this.views
      }

      const exportedCount = Object.keys(payload).length
      if (exportedCount === 0) {
        hostStore.showToast('No se encontraron vistas válidas en la selección para exportar', 'warning')
        return
      }

      const jsonStr = JSON.stringify(payload, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toISOString().slice(0, 10)
      const hostSlug = hostStore.activeHost.id || 'server'
      const suffix = targetNames && targetNames.length === 1
        ? `_${targetNames[0]}`
        : (targetNames && targetNames.length > 1 ? `_selected_${exportedCount}` : '_catalog')
      a.download = `views${suffix}_${hostSlug}_${dateStr}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      hostStore.showToast(`JSON de ${exportedCount} vista(s) exportado exitosamente`, 'success')
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

    exportProceduresJson(type = 'sp', onlyNames = null) {
      const hostStore = useHostStore()
      const dateStr = new Date().toISOString().slice(0, 10)
      const hostSlug = hostStore.activeHost.id || 'server'

      let payload = null
      let fileName = ''
      let label = ''

      const filterMap = (sourceMap, namesList) => {
        if (!namesList || namesList.length === 0) return sourceMap || {}
        const out = {}
        namesList.forEach(n => {
          if (sourceMap && sourceMap[n]) out[n] = sourceMap[n]
        })
        return out
      }

      if (type === 'fn') {
        const targetNames = Array.isArray(onlyNames)
          ? onlyNames
          : (this.selectedFn.length > 0 ? this.selectedFn : null)
        payload = filterMap(this.fn, targetNames)
        const count = Object.keys(payload).length
        if (count === 0) {
          hostStore.showToast('No hay funciones cargadas o seleccionadas para exportar', 'warning')
          return
        }
        const suffix = targetNames && targetNames.length === 1
          ? `_${targetNames[0]}`
          : (targetNames && targetNames.length > 1 ? `_selected_${count}` : '_catalog')
        fileName = `fn${suffix}_${hostSlug}_${dateStr}.json`
        label = `${count} función(es)`
      } else if (type === 'all') {
        const spSub = filterMap(this.sp, this.selectedSp.length > 0 ? this.selectedSp : null)
        const fnSub = filterMap(this.fn, this.selectedFn.length > 0 ? this.selectedFn : null)
        const spC = Object.keys(spSub).length
        const fnC = Object.keys(fnSub).length
        if (spC === 0 && fnC === 0) {
          hostStore.showToast('No hay procedimientos ni funciones para exportar', 'warning')
          return
        }
        payload = {
          jsonStoreProcedure: spSub,
          jsonStoreFunction: fnSub
        }
        const isPartial = this.selectedSp.length > 0 || this.selectedFn.length > 0
        fileName = `procedures_${isPartial ? `selected_${spC + fnC}` : 'catalog'}_${hostSlug}_${dateStr}.json`
        label = `${spC} SP(s) y ${fnC} función(es)`
      } else {
        const targetNames = Array.isArray(onlyNames)
          ? onlyNames
          : (this.selectedSp.length > 0 ? this.selectedSp : null)
        payload = filterMap(this.sp, targetNames)
        const count = Object.keys(payload).length
        if (count === 0) {
          hostStore.showToast('No hay Stored Procedures cargados o seleccionados para exportar', 'warning')
          return
        }
        const suffix = targetNames && targetNames.length === 1
          ? `_${targetNames[0]}`
          : (targetNames && targetNames.length > 1 ? `_selected_${count}` : '_catalog')
        fileName = `sp${suffix}_${hostSlug}_${dateStr}.json`
        label = `${count} Stored Procedure(s)`
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
      hostStore.showToast(`JSON de ${label} descargado exitosamente (${fileName})`, 'success')
    },

    buildAgentAnalysisBundle(fallback = null) {
      const hostStore = useHostStore()
      let viewNames = [...this.selectedViews]
      let spNames = [...this.selectedSp]
      let fnNames = [...this.selectedFn]

      if (viewNames.length === 0 && spNames.length === 0 && fnNames.length === 0 && fallback) {
        if (fallback.view && this.views[fallback.view]) viewNames = [fallback.view]
        if (fallback.sp && this.sp[fallback.sp]) spNames = [fallback.sp]
        if (fallback.fn && this.fn[fallback.fn]) fnNames = [fallback.fn]
      }

      const viewsSection = {}
      viewNames.forEach(name => {
        const cfg = this.views[name]
        if (!cfg) return
        viewsSection[name] = {
          endpoint: `GET /api/view/${name}`,
          description: cfg.description || '',
          sqlQuery: buildSqlFromViewConfig(cfg),
          whereParameters: Object.keys(cfg.sql?.whereFields || {}),
          columnsCount: Object.keys(cfg.fields || {}).length,
          fields: cfg.fields || {},
          sql: cfg.sql || {}
        }
      })

      const formatPlSqlCall = (target, inParams, outParams, isFn = false) => {
        const args = [
          ...inParams.map(p => `:${p} /* IN */`),
          ...(!isFn ? outParams.map(p => `:${p} /* OUT */`) : [])
        ]
        if (isFn) {
          const outVar = outParams[0] || 'value'
          return `BEGIN :${outVar} := ${target}(${args.join(', ')}); END;`
        }
        return `BEGIN ${target}(${args.join(', ')}); END;`
      }

      const spSection = {}
      spNames.forEach(name => {
        const cfg = this.sp[name]
        if (!cfg) return
        const inList = Array.isArray(cfg.in_param) ? cfg.in_param : Object.keys(cfg.in_param || {})
        const outList = Array.isArray(cfg.out_param) ? cfg.out_param : (cfg.out_param?.varName ? [cfg.out_param.varName] : [])
        const target = cfg.sp_name || name
        spSection[name] = {
          endpoint: `POST /api/sp/${name}`,
          sp_name: target,
          plsqlCall: formatPlSqlCall(target, inList, outList, false),
          in_param: inList,
          out_param: outList
        }
      })

      const fnSection = {}
      fnNames.forEach(name => {
        const cfg = this.fn[name]
        if (!cfg) return
        const inList = Array.isArray(cfg.in_param) ? cfg.in_param : Object.keys(cfg.in_param || {})
        const outList = Array.isArray(cfg.out_param) ? cfg.out_param : (cfg.out_param?.varName ? [cfg.out_param.varName] : ['value'])
        const target = cfg.fn_name || name
        fnSection[name] = {
          endpoint: `POST /api/fn/${name}`,
          fn_name: target,
          plsqlCall: formatPlSqlCall(target, inList, outList, true),
          in_param: inList,
          out_param: cfg.out_param || { varName: 'value', Type: 'NUMBER' }
        }
      })

      return {
        _agentContext: {
          purpose: 'Contexto técnico de Vistas SQL y Procedimientos PL/SQL de node-apiliq (Oracle 11gR2) para análisis por Agente IA',
          exportedAt: new Date().toISOString(),
          sourceServer: {
            id: hostStore.activeHost.id,
            name: hostStore.activeHost.name,
            baseUrl: hostStore.baseUrl
          },
          domainRules: [
            'REGLA OBLIGATORIA DE PERÍODO: En toda esta API, cualquier parámetro o filtro de período (Periodo, vPERIODO, PeriodoLiq, PeriodoDDJJ, vPERIODO_HASTA, vPER) utiliza SIEMPRE el día 01 (01/MM/YYYY). Solamente cambian el mes y el año.',
            'En Vistas (GET /api/view/:name): los filtros de período se envían como 01/MM/YYYY.',
            'En Stored Procedures (POST /api/sp/:name): los parámetros DATE de período se vinculan en el día 01 del mes a las 00:00:00 hora local.'
          ],
          counts: {
            views: Object.keys(viewsSection).length,
            storedProcedures: Object.keys(spSection).length,
            functions: Object.keys(fnSection).length
          }
        },
        views: viewsSection,
        jsonStoreProcedure: spSection,
        jsonStoreFunction: fnSection
      }
    },

    exportAgentBundleJson(fallback = null) {
      const hostStore = useHostStore()
      const bundle = this.buildAgentAnalysisBundle(fallback)
      const total =
        bundle._agentContext.counts.views +
        bundle._agentContext.counts.storedProcedures +
        bundle._agentContext.counts.functions

      if (total === 0) {
        hostStore.showToast('Selecciona al menos una Vista o Procedimiento (con los checkboxes) para exportar al Agente IA', 'warning')
        return
      }

      const jsonStr = JSON.stringify(bundle, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toISOString().slice(0, 10)
      const hostSlug = hostStore.activeHost.id || 'server'
      a.download = `agent_context_${total}_items_${hostSlug}_${dateStr}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      hostStore.showToast(
        `🤖 Bundle para Agente IA descargado (${bundle._agentContext.counts.views} Vistas, ${bundle._agentContext.counts.storedProcedures} SPs, ${bundle._agentContext.counts.functions} FNs)`,
        'success'
      )
    },

    async copyAgentBundleClipboard(fallback = null) {
      const hostStore = useHostStore()
      const bundle = this.buildAgentAnalysisBundle(fallback)
      const total =
        bundle._agentContext.counts.views +
        bundle._agentContext.counts.storedProcedures +
        bundle._agentContext.counts.functions

      if (total === 0) {
        hostStore.showToast('Selecciona al menos una Vista o Procedimiento para copiar al portapapeles', 'warning')
        return
      }

      const jsonStr = JSON.stringify(bundle, null, 2)
      await navigator.clipboard.writeText(jsonStr)
      hostStore.showToast(
        `🤖 Contexto JSON copiado al portapapeles (${bundle._agentContext.counts.views} Vistas, ${bundle._agentContext.counts.storedProcedures} SPs, ${bundle._agentContext.counts.functions} FNs) — Listo para pegar en tu Agente IA`,
        'success'
      )
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
