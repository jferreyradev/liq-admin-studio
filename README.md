# ⚡ Liquid Studio — Consola Multi-Host & Manual de Uso (Vue 3 + Vite)

Panel de administración, consola de desarrollo e introspección en tiempo real para **Oracle Database 11g / 19c** del ecosistema de Liquidación de Sueldos Municipal (`api_liquid`).

---

## 🧭 Índice

1. [Arquitectura Multi-Host y Modos de Conexión](#-1-arquitectura-multi-host-y-modos-de-conexión)
2. [Manual de Uso Paso a Paso](#-2-manual-de-uso-paso-a-paso)
   - [2.1 Acceso y Selección de Municipio / Servidor](#21-acceso-y-selección-de-municipio--servidor)
   - [2.2 Barra Superior: Estado Oracle, Caché RAM y Sincronización](#22-barra-superior-estado-oracle-caché-ram-y-sincronización)
   - [2.3 Módulo 1: Vistas y Consultas (`/views`)](#23-módulo-1-vistas-y-consultas-views)
   - [2.4 Módulo 2: SQL Studio y Creación/Importación de Vistas (`/sql-studio`)](#24-módulo-2-sql-studio-y-creaciónimportación-de-vistas-sql-studio)
   - [2.5 Módulo 3: Stored Procedures y Funciones (`/procedures`)](#25-módulo-3-stored-procedures-y-funciones-procedures)
   - [2.6 Módulo 4: API Explorer (`/explorer`)](#26-módulo-4-api-explorer-explorer)
   - [2.7 Módulo 5: Importador Masivo Excel/CSV a Oracle (`/importer`)](#27-módulo-5-importador-masivo-excelcsv-a-oracle-importer)
3. [Guía de Migración y Clonación de Vistas entre Municipios](#-3-guía-de-migración-y-clonación-de-vistas-entre-municipios)
4. [Instalación, Desarrollo y Despliegue (Netlify / Vite)](#-4-instalación-desarrollo-y-despliegue-netlify--vite)

---

## 🌐 1. Arquitectura Multi-Host y Modos de Conexión

**Liquid Studio** permite administrar múltiples servidores de liquidación desde una única interfaz web sin cambiar de URL:

| Servidor / Municipio | Identificador (`x-project-key`) | Puerto | Modo de Enrutamiento |
| :--- | :--- | :--- | :--- |
| **Servidor Local (`api_liquid`)** | `local` | `3005` | Conexión directa a `http://localhost:3005` |
| **Municipalidad de Trancas** | `ServerTrancas` | `3005` | Vía Pasarela Deno Bridge (`https://deno-hono-proxy.jferreyradev.deno.net`) |
| **Municipalidad de Tafí Viejo** | `tafiviejo` | `3007` | Vía Pasarela Deno Bridge |
| **Municipalidad de Concepción** | `concecpcion` | `3007` | Vía Pasarela Deno Bridge |
| **Municipalidad de Burruyacú** | `Burru` | `3003` | Vía Pasarela Deno Bridge |
| **Servidor de Desarrollo** | `desarrollo` | `3005` | Vía Pasarela Deno Bridge |
| **Servidor Personalizado** | Configurable | Configurable | Soporta tanto **URL Directa** (ej. `http://192.168.1.50:3005`) como **Deno Bridge** |

---

## 📖 2. Manual de Uso Paso a Paso

### 2.1 Acceso y Selección de Municipio / Servidor
1. Al abrir la aplicación (`/login`), selecciona el **Servidor / Municipio Destino** en el desplegable.
   * Si eliges **⚙️ Servidor Personalizado...**, podrás ingresar una URL directa (por ejemplo un servidor en tu red local) o una clave `x-project-key` y puerto del puente Deno.
2. Ingresa la **Clave de Administración (`X-Admin-Key`)** configurada en la variable `ADMIN_ACCESS_KEY` del archivo `.env` del backend (por defecto en entornos locales: `admin_liq_2026`).
3. Marca **"Recordar clave en este navegador"** si deseas persistir la sesión en `localStorage`, o déjala desmarcada para que dure solo mientras la pestaña esté abierta (`sessionStorage`).
4. Pulsa **🔐 Ingresar a la Consola**.

---

### 2.2 Barra Superior: Estado Oracle, Caché RAM y Sincronización
Una vez dentro, el encabezado cambia dinámicamente al color institucional del municipio activo:

* **🏢 Selector de Servidor:** Cambia de municipio en cualquier momento. Al hacerlo, el Studio recarga automáticamente el catálogo de vistas, procedimientos, funciones, reportes y tablas de ese servidor.
* **🟢 Píldora `DB: USUARIO@HOST/SID`:** Muestra el estado de la conexión con Oracle. Haz clic sobre ella para ejecutar una prueba de conexión en vivo (`GET /api/admin/health?testDb=true`).
* **📥 Sincronizar mapperViews:** Lee el archivo local `config/mapperViews.js` (o `mapperViews.local.js`) en el servidor destino y guarda o actualiza todas sus vistas en la tabla `API_VIEW_MAPPER` de Oracle (`POST /api/view/seed-from-file`).
* **🔄 Recargar Caché RAM:** Vacía la caché en memoria del backend Node.js (`POST /api/view/refresh`) y vuelve a consultar `API_VIEW_MAPPER` y `ALL_ARGUMENTS` en Oracle sin reiniciar el proceso PM2.
* **⚙️ Config:** Permite cambiar la URL de la pasarela Deno, actualizar la `X-Admin-Key` o ajustar los parámetros del servidor personalizado.

---

### 2.3 Módulo 1: Vistas y Consultas (`/views`)
Permite explorar, parametrizar y ejecutar cualquiera de las consultas registradas en la API:

1. **Búsqueda y Clasificación:**
   * En la barra lateral izquierda puedes buscar por nombre de vista, descripción o tabla origen (`FROM`).
   * Cada ítem muestra una etiqueta:
     * **`WHERE` (Parámetros Fijos):** La vista tiene filtros predefinidos en `whereFields` (ej. `IdRep`, `Periodo`).
     * **`OPEN` (Filtros Abiertos):** La vista no tiene `whereFields` fijos y permite filtrar por **cualquiera de sus columnas**.
2. **Inspección de Sentencia SQL:**
   * Muestra el `SELECT ... FROM ... WHERE ...` real que se ejecuta en Oracle 11g.
   * Con **📋 Copiar SQL** copias la consulta, y con **✏️ Editar en SQL Studio** la abres directamente en el editor para modificarla.
3. **Proyección de Columnas (`fields`):**
   * Haz clic en **"Seleccionar columnas"** para mostrar píldoras interactivas con todas las columnas de la vista.
   * Marca solo las columnas que necesites para reducir el tráfico de red (se envían en `?fields=Col1,Col2`), o haz clic en **Todas** para traer el registro completo.
4. **Filtros Avanzados y Paginación (`baseQuery`):**
   * **Parámetros / Columnas:** Completa cualquier campo y presiona `Enter` o **▶ Ejecutar Consulta**.
   * **📅 Regla de Períodos (Día `01` Fijo):** Para trabajar con esta API, **siempre el día es `01`** y solo cambian el mes y el año. En cualquier filtro `Periodo` puedes escribir `09/2026`, `2026-09`, `202609` o `01/09/2026` y se normalizará automáticamente a `01/09/2026`.
   * **Búsqueda parcial (`search`):** Usa el formato `NombreColumna:texto` para aplicar un `LIKE '%texto%'` en Oracle.
   * **Ordenamiento (`sort`):** Usa formato JSON como `{"Apellido":"asc"}` o `{"Periodo":"desc"}`.
   * **Paginación (`limit` / `offset`):** Ajusta la cantidad de registros por página y navega con los botones **◀** y **▶**.
5. **Resultados y Exportación:**
   * Alterna entre **📊 Tabla** (con buscador instantáneo y ordenamiento haciendo clic en las cabeceras) y **{ } JSON**.
   * Exporta los datos con **📋 JSON**, **📋 CSV** o **📥 Descargar CSV**.
6. **Exportación Selectiva, Análisis para Agentes IA e Importación de Catálogo JSON:**
   * Cada vista de la lista lateral incluye una **casilla de selección (`checkbox`)** para marcar únicamente las consultas que te interesan (o pulsar `☑️ Marcar filtradas`).
   * **🤖 Selección para Agente IA:** Al marcar una o más vistas (puedes combinarlas también con Stored Procedures o Funciones desde `/procedures`), aparece el cuadro **🤖 Selección para Agente IA** con los botones **🤖 Descargar JSON Agente** y **📋 Copiar**, que generan un único JSON con el SQL reconstruido (`sqlQuery`), columnas, parámetros `WHERE`, llamadas PL/SQL y las reglas de dominio de la API.
   * **📤 Exportación de Catálogo:** Si hay vistas marcadas, **📤** descarga únicamente las seleccionadas; si no hay ninguna marcada, descarga el catálogo completo. También puedes descargar una sola vista con el botón **📤 JSON Vista** en su cabecera.

---

### 2.4 Módulo 2: SQL Studio y Creación/Importación de Vistas (`/sql-studio`)
Permite crear nuevas vistas o actualizar existentes en la tabla `API_VIEW_MAPPER` sin tocar código ni reiniciar el servidor:

1. **Crear o Editar desde una sentencia `SELECT`:**
   * Puedes partir desde cero, pulsar **💡 Ejemplo**, o elegir una consulta en **"-- Cargar vista existente como base --"**.
   * Escribe el **Nombre de la Vista** (ej. `empleadosPorRep`), una **Descripción** y la sentencia `SELECT ... FROM ...`.
   * **Detección automática de parámetros `:bind`:** Si escribes `WHERE c.idrep = :IdRep`, SQL Studio detecta automáticamente `:IdRep` y muestra un cuadro de **"🧪 Valores de Prueba para Parámetros Bind"** para que puedas probar la consulta en vivo antes de guardarla.
   * Haz clic en **▶ Probar Consulta en Vivo** para verificar los resultados reales desde Oracle.
   * Haz clic en **⚡ Previsualizar Parseo JSON** para inspeccionar cómo `sqlViewParser` desglosa `fields`, `fromClause`, `whereFields` y `groupClause`.
   * Haz clic en **🚀 Guardar en Oracle (API_VIEW_MAPPER)** para dejar el endpoint `GET /api/view/<nombre>` publicado inmediatamente.
2. **Importar desde una Vista o Tabla Física de Oracle (`oracleView`):**
   * Si ya existe una vista o tabla en el esquema Oracle (ej. `US_SUELDO.V_RESUMEN_LIQ`), ingresa el **Nombre de la Vista**, escribe `US_SUELDO.V_RESUMEN_LIQ` en el bloque **"🏛️ Importar desde Vista o Tabla física de Oracle"** y pulsa **⚡ Generar desde Objeto Oracle**.
   * La API consultará `ALL_TAB_COLUMNS` en Oracle, armará todos los campos automáticamente y registrará la vista.
3. **Subir / Descargar Lotes de Vistas JSON:**
   * Usa los botones inferiores **📁 Subir Vistas JSON a BD** y **📤 Exportar Vistas a JSON**.

---

### 2.5 Módulo 3: Stored Procedures y Funciones (`/procedures`)
Permite inspeccionar y ejecutar los más de 700 procedimientos almacenados y funciones PL/SQL:

1. **Selector SP / Funciones:** Alterna entre **⚡ Stored Procedures** (`/api/sp/*`) y **ƒ(x) Funciones** (`/api/fn/*`) en la barra lateral.
2. **Bloque PL/SQL en Tiempo Real:** A medida que completas los parámetros de entrada (`IN`), verás cómo se construye el bloque anónimo `BEGIN ... END;` y la cantidad de argumentos `IN` y `OUT`.
3. **📅 Regla Obligatoria de Períodos (Día `01` Fijo):** Todos los parámetros de período (`vPERIODO`, `Periodo`, `vPER`) fuerzan siempre el **día `01` a las `00:00:00` en hora local** (cambia únicamente el mes y el año), aceptando formatos `MM/YYYY` (`09/2026`), `YYYY-MM` (`2026-09`), `YYYYMM` (`202609`) o `DD/MM/YYYY` (`01/09/2026`).
4. **Ejecución Segura con Cronómetro:**
   * Al pulsar **▶ Ejecutar en Oracle**, se inicia un contador de segundos en tiempo real (`Tiempo transcurrido: Xs`) y se bloquean temporalmente los inputs para evitar ejecuciones duplicadas en procesos largos de liquidación.
5. **Inspección de Salida y Diagnóstico:**
   * Muestra los parámetros de salida (`OUT Binds`), el JSON completo y, si el procedimiento devuelve filas o un cursor, renderiza automáticamente la **Tabla de Resultados** exportable a CSV.
   * Si ocurre un error `ORA-06550` / `PLS-00306` (diferencia en cantidad o tipos de argumentos), muestra un cuadro de diagnóstico detallando el bloque PL/SQL y los binds enviados.
6. **Selección por Checkbox, Exportación para Agente IA, Importación y Sincronización de SPs y Funciones:**
   * **Selección individual o múltiple:** Marca con los checkboxes de la lista lateral qué Stored Procedures y/o Funciones deseas incluir (o usa `☑️ Marcar filtrados`).
   * **🤖 Bundle para Agente IA:** Descarga (**🤖 Descargar JSON Agente**) o copia al portapapeles (**📋 Copiar**) un JSON combinado con las Vistas + SPs + Funciones seleccionadas (incluyendo su bloque `BEGIN ... END;`, parámetros `IN`/`OUT` y reglas de dominio) listo para entregar a un Agente IA para análisis.
   * **📤 Descargar JSON (SPs o Funciones):** Exporta únicamente los procedimientos marcados (o todo el catálogo activo si no marcaste ninguno). También puedes descargar solo el procedimiento actual con **📤 JSON SP**.
   * **📦 Descargar Paquete Completo:** Exporta un único archivo `procedures_...json` con ambos catálogos (`jsonStoreProcedure` y `jsonStoreFunction`).
   * **📁 Importar JSON:** Carga un archivo JSON de procedimientos/funciones en el servidor activo (`POST /api/sp/import-json`).
   * **🔎 Sincronizar desde Oracle (`ALL_ARGUMENTS`):** Descubre en vivo todos los procedimientos y funciones del esquema en Oracle (`POST /api/sp/sync-oracle`).

---

### 2.6 Módulo 4: API Explorer (`/explorer`)
Cliente HTTP integrado (estilo Postman) diseñado específicamente para los endpoints de `api_liquid`:

1. **Catálogo Lateral Integrado:** Filtra por categoría (**🔧 Sistema**, **📋 Vistas**, **⚡ SPs**, **ƒ(x) Funciones**, **📊 Reportes**, **🗃️ Entidades**). Al hacer clic en cualquier endpoint, se cargan automáticamente su método HTTP, ruta, parámetros sugeridos o plantilla JSON del body.
2. **Constructor de Query Params:**
   * Activa o desactiva parámetros individualmente con su casilla de verificación.
   * Usa los atajos rápidos: `+ fields`, `+ limit`, `+ offset`, `+ search`, `+ sort`.
3. **Cuerpo JSON y Encabezados:**
   * Incluye el botón **🧹 Formatear JSON** para validar e indentar el payload antes de enviarlo.
   * Permite activar o desactivar el envío de `X-Admin-Key` para probar permisos públicos vs. administrativos.
4. **Generador de URL y cURL:** Copia la URL final o el comando `curl` completo (con las cabeceras `x-project-key`, `x-project-port` y `X-Admin-Key` listas para ejecutar en terminal).
5. **Visor Dual de Respuesta:** Muestra código de estado HTTP, latencia en `ms`, peso en `KB` y permite alternar entre **📊 Tabla** y **{ } JSON**.

---

### 2.7 Módulo 5: Importador Masivo Excel/CSV a Oracle (`/importer`)
Permite cargar planillas `.xlsx`, `.xls`, `.csv`, `.tsv` o `.txt` (hasta 50 MB) hacia tablas físicas en Oracle usando `executeMany` por lotes de 2000 registros:

1. **Paso 1 — Subir Archivo y Elegir Hoja:**
   * Arrastra tu archivo al área de carga o haz clic para seleccionarlo.
   * Si es un libro Excel con varias pestañas, aparecerá el selector **Hoja Excel** para elegir qué hoja procesar.
   * Verás inmediatamente una muestra con las primeras 10 filas del archivo.
2. **Paso 2 — Seleccionar Tabla Destino e Inspeccionar Columnas:**
   * Haz clic en cualquier tabla del panel lateral izquierdo (**📊 Tablas en Oracle**) o escribe su nombre (ej. `US_SUELDO.HOJA_NOV`) y pulsa **🔍 Inspeccionar Columnas**.
   * El sistema consultará `ALL_TAB_COLUMNS` en Oracle para obtener los nombres exactos y tipos de datos (`NUMBER`, `VARCHAR2(100)`, `DATE`).
3. **Paso 3 — Mapeo de Columnas (Archivo ➔ Oracle):**
   * El importador realiza un **Auto-Mapeo inteligente** emparejando las columnas del archivo con las de Oracle.
   * Puedes ajustar manualmente cualquier columna mediante el desplegable o elegir **`(No importar / Ignorar)`** para omitir columnas del Excel que no deban insertarse.
4. **Paso 4 — Opciones Transaccionales y Ejecución:**
   * **⚠️ Vaciar tabla antes de insertar (`TRUNCATE`):** Limpia la tabla destino antes de cargar los nuevos registros (solicita confirmación de seguridad).
   * **🔒 Modo Transaccional Atómico:** Activado por defecto; si cualquier fila presenta un error de tipos o restricción en Oracle, realiza un `ROLLBACK` total garantizando cero datos corruptos o cargas a medias.
   * Pulsa **🚀 Iniciar Carga Masiva a Oracle** para ejecutar la importación y ver el resumen de filas insertadas y tiempo de ejecución.

---

## 🔄 3. Guía de Migración y Clonación de Vistas y Procedimientos entre Municipios

Para llevar todas las **vistas** o el catálogo de **Stored Procedures y Funciones** desde **Desarrollo** (o **Localhost**) hacia un municipio en producción (ej. **Trancas** o **Concepción**):

1. En el selector superior (`🏢 Servidor`), selecciona **Desarrollo** (o **Localhost**).
2. **Para Vistas:** Ve a **📋 Vistas y Consultas** y haz clic en **📤 (Exportar JSON)** arriba de la lista lateral (`views_catalog_<servidor>_YYYY-MM-DD.json`).
   **Para Stored Procedures y Funciones:** Ve a **⚡ Stored Procedures & FNs** y haz clic en **📤** (para exportar SPs o Funciones por separado) o en **📦** (para descargar el paquete completo `procedures_catalog_<servidor>_YYYY-MM-DD.json`).
3. En el selector superior (`🏢 Servidor`), cambia al municipio destino (ej. **Trancas**).
4. Haz clic en el botón **📁 (Importar JSON)** de la sección correspondiente, selecciona el archivo descargado y confirma.
5. ¡Listo! Todas las vistas y/o procedimientos quedarán registrados y activos en la memoria RAM del servidor destino sin necesidad de conectarse por SSH ni reiniciar el proceso.

---

## 🛠️ 4. Instalación, Desarrollo y Despliegue (Netlify / Vite)

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo local (http://localhost:5180)
npm run dev

# 3. Compilar para producción (genera la carpeta dist/)
npm run build

# 4. Previsualizar compilación de producción localmente
npm run preview
```

### Configuración en Netlify
* **Build command:** `npm run build`
* **Publish directory:** `dist`
* Incluye archivo `public/_redirects` (`/* /index.html 200`) para soporte de rutas SPA con `vue-router`.
