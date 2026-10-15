# ⚡ Liquid Studio — Developer & Multi-Host Console (Vue 3 + Vite)

Panel de administración, consola de desarrollo e introspección de base de datos Oracle 11g para el ecosistema de Liquidación de Sueldos Municipal.

---

## 🚀 Características Principales

1. **Selector Global Multi-Municipio (Multi-Host):**
   * Alterna en tiempo real entre los 5 entornos municipales:
     * **Trancas:** `ServerTrancas:3005` (Púrpura `#6A1B9A`)
     * **Tafí Viejo:** `tafiviejo:3007` (Cian `#00838F`)
     * **Concepción:** `concecpcion:3007` (Azul `#1976D2`)
     * **Burruyacú:** `Burru:3003` (Verde `#2E7D32`)
     * **Desarrollo:** `desarrollo:3005` (Violeta `#7C4DFF`)
     * **Custom:** Permite indicar cualquier IP o puerto personalizado.
   * Diagnóstico de conexión en vivo con Oracle Database (`/api/admin/health?testDb=true`).

2. **📋 Catálogo y Ejecutor de Vistas (`/views`):**
   * Listado en vivo de todas las consultas (`/api/view/list`).
   * Visualización del SQL real ejecutado en Oracle 11g.
   * Formularios automáticos según los `whereFields` de la consulta.
   * Paginación (`limit`, `offset`), filtros y exportación a JSON/CSV.
   * Sincronización masiva de `mapperViews.js` a Oracle (`POST /api/view/seed-from-file`).

3. **⚡ Stored Procedures y Funciones (`/procedures`):**
   * Catálogo de los más de 700 procedimientos y funciones.
   * Generación reactiva del bloque PL/SQL (`BEGIN ... END;`) con interpolación de valores en vivo.
   * Visualización de binds de salida (`outBinds`) y reporte detallado de errores Oracle (ej. `PLS-00306`).

4. **✏️ SQL Studio (`/sql-studio`):**
   * Editor de sentencias SQL puras (`SELECT ... FROM ... WHERE ...`).
   * Ejecución directa para previsualizar datos.
   * Guardado permanente en la tabla `API_VIEW_MAPPER` de Oracle (`POST /api/view/save`) sin reiniciar el backend.

5. **🌐 API Explorer (`/explorer`):**
   * Probador tipo Postman para cualquier endpoint (GET, POST, PUT, DELETE).
   * Generador de comandos cURL con cabeceras `x-project-key`, `x-project-port` y `X-Admin-Key`.

6. **📁 Importador Masivo (`/importer`):**
   * Carga masiva por lotes de `.xlsx`, `.csv` hacia tablas físicas en Oracle.
   * Vista previa de filas y mapeo visual de columnas.

---

## 🛠️ Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo en http://localhost:5180
npm run dev

# Compilar para producción (en dist/)
npm run build

# Previsualizar compilación
npm run preview
```
