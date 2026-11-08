# HESTIAT-OPERATIONS.md

> **ACTUALIZACIÓN 2026-10-03 · COPIA VERIFICADA**
> La verificación por restauración se ha cerrado con resultado **COPIA VERIFICADA**:
> 33 de 33 tablas restauradas en `ppxgfdyc_hestiat2`, **cero diferencias en tablas
> persistentes** y una única deriva admisible (`usuario_sesion`, 21 vs 20, una sesión
> creada después del volcado). Acta completa en `docs/ACTA-COPIA-VERIFICADA.md`.
> SHA-256 del volcado: `b3b997257658bbe11c90a35f7425ff0d9e6873dcbb3645d3be662d1ac8f39c12`.
>
> **QUEDA LEVANTADA LA PROHIBICIÓN DE BORRAR** el código de la aplicación anterior, al
> cumplirse también la auditoría fresca (ver `docs/AUDITORIA-2026-10-03.md`) y la copia
> de la aplicación con hash y prueba de extracción (3.106.370 B, 314 ficheros, entry
> idéntico al de producción).
>
> Pendiente aún: el token de R2 para el bucket privado (acción manual en Cloudflare) y,
> con él, subir el volcado y el acta fuera del servidor.

Requisitos previos pendientes, estado real de las copias y procedimiento para retomar la operación.
Última actualización: 2026-10-03. Ámbito: SOLO `hestiat.com`.

---

## 1. Bloqueos actuales (por qué no se puede avanzar en el servidor)

### 1.1 La IP del entorno de trabajo está bloqueada por el cortafuegos del servidor

**Síntoma exacto:** las peticiones HTTP desde el entorno de trabajo devuelven `000` (sin respuesta), mientras que:
- el navegador carga el sitio con normalidad,
- el puerto 443 del servidor está abierto,
- el FTP (puerto 21) funciona.

**Diagnóstico:** no es la aplicación. La cuenta tiene `cpguard` e `imunify` activos, y tras una sesión de trabajo intensiva con muchas peticiones automatizadas —además de dejar ficheros de diagnóstico expuestos— la IP quedó bloqueada por la capa de seguridad.

**Consecuencias que ya ha causado:** varias comprobaciones registradas como «el script falló» en realidad **nunca llegaron al servidor**. Toda conclusión obtenida por esa vía queda marcada como no concluyente.

**Cómo se resuelve (cualquiera de las dos):**
1. Lista blanca de la IP **`13.51.14.197`** en el cortafuegos del servidor (cpguard/imunify permiten excepciones de IP). Es lo más rápido.
2. Abrir **SSH** para la cuenta (`ppxgfdyc`), preferiblemente por clave y con shell restringido. Hoy el puerto 22 está cerrado desde Internet.

### 1.2 No hay base de datos con permisos para la verificación

El usuario de base de datos de Hestiat **solo tiene permiso sobre su propia base**. Al intentar crear un esquema temporal para verificar la copia por restauración:

```
ERROR 1044 (42000): Access denied for user 'ppxgfdyc_hestiat'@'localhost'
                    to database 'ppxgfdyc_hestiat_verif'
```

**Cómo se resuelve, en cPanel:**
1. **Bases de datos MySQL → Crear base de datos**: por ejemplo `verif` (o directamente la base de Hestiat 2.0, p. ej. `hestiat2`).
2. Añadir el usuario actual de Hestiat a esa base **con todos los privilegios**.

Doble uso: sirve para cerrar la verificación que falta **y** es la base sobre la que se construirá Hestiat 2.0, según la preferencia del mandato (base nueva + migración controlada).

### 1.3 No hay bucket privado para copias

El bucket `hestiat` **sirve públicamente todos sus prefijos**. El 2026-10-03 se subió el volcado a `backups/` y quedó descargable por cualquiera (`HTTP 206`, contenido del volcado a la vista). Se retiró en el acto (`DELETE → 204`, después `404`).

**Cómo se resuelve:** crear un bucket nuevo, por ejemplo `hestiat-backups`, **sin conexión pública**, y subir allí las copias.

**Regla permanente:** en el bucket público no entra nunca nada privado: ni copias, ni volcados, ni exportaciones, ni credenciales, ni informes internos.

---

## 2. Estado real de las copias

| Copia | Estado | Evidencia |
|---|---|---|
| **Base de datos** | **Hecha** | `/home/ppxgfdyc/backups/hestiat-20261003-110008.sql.gz` · 37.986.420 B |
| Integridad del archivo | **Verificada** | `gzip -t` → **INTEGRO** |
| Contenido | **Verificado** | **33** `CREATE TABLE` · 323 `INSERT INTO` · cabecera `MariaDB dump 10.19-11.4.13` · cierre `-- Dump completed on 2026-10-03 11:02:07` |
| Consistencia | **Garantizada** | Volcado con `--single-transaction` |
| Ubicación | **Fuera del docroot** | `/home/ppxgfdyc/backups` |
| Permisos | **0600** | Aplicado y confirmado |
| **Verificación por restauración** | **PENDIENTE** | Requiere el apartado 1.2 |
| Hash SHA-256 de la copia | **PENDIENTE** | El manifiesto no llegó a generarse (petición bloqueada) |
| Copia de la aplicación (código desplegado) | **NO CONFIRMADA** | El empaquetado no llegó a ejecutarse por el bloqueo de IP |
| Copia de configuración (`.env` + copias) | **NO CONFIRMADA** | Igual motivo |
| Esquema de base de datos | **Capturado en repositorio** | `db/migrations/001_init.sql` (esquema nuevo) + inventario de 33 tablas de la auditoría |
| Inventario de R2 | **Parcial** | El barrido en simulación informa de **0 objetos** en el bucket |

**Regla del mandato que gobierna esto:** no se borra la aplicación anterior mientras **el backup de datos no pueda verificarse**. Hoy no puede. Por tanto **no se borra nada**.

---

## 3. Procedimiento para cerrar la verificación por restauración

Cuando exista la base nueva con permisos (apartado 1.2):

1. **Comprobar la integridad del archivo** antes de tocar nada: `gzip -t` sobre el volcado. Si no pasa, se aborta.
2. **Crear el esquema destino** vacío, con `utf8mb4` y `utf8mb4_unicode_ci`.
3. **Restaurar**: `zcat volcado.sql.gz | mysql <esquema>`.
4. **Comparar tabla por tabla** contra producción: número de tablas (deben ser 33) y recuento de filas en las tablas clave: `alojamiento`, `alojamiento_foto`, `usuario`, `reserva`, `resena`, `experiencia`, `servicio_turistico`, `nucleo`, `ical_feed`.
5. **Registrar el resultado**: tabla, producción, restaurado, ¿coincide?
6. **Eliminar el esquema temporal** una vez verificado.
7. **Calcular el SHA-256** del volcado y guardarlo en el manifiesto.

**Criterio de copia verificada:** `gzip -t` correcto **y** las 33 tablas restauradas **y** todos los recuentos coincidentes. Con eso, y solo con eso, se levanta la prohibición de borrar.

**Nota sobre la restauración local:** el entorno de trabajo **no dispone de MariaDB ni MySQL** (sí de `sqlite3`, que no sirve para importar un volcado de MariaDB). Por tanto la verificación por restauración se hará contra el servidor, en la base nueva. Cuando la IP esté desbloqueada o haya SSH, el archivo podrá descargarse y verificarse también fuera del servidor.

---

## 4. Procedimiento para retomar el borrado del código anterior

**No ejecutar ningún paso hasta que el apartado 3 esté cerrado y documentado.**

### 4.1 Antes de borrar: rehacer la auditoría

La auditoría del 2026-10-03 describía un front que **ya no es el desplegado** (ahora sirve una home nueva con «ALOJAMIENTOS CON CARÁCTER», destinos por provincia y alojamientos populares). **No se borra nada basándose en una foto desactualizada.** Primer paso: auditoría fresca.

### 4.2 Inventario y clasificación

Para cada elemento del docroot, clasificar en: **propio y desechable**, **propio y conservar**, **ajeno (no tocar)**, **dudoso (no tocar)**.

| Elemento | Clasificación | Acción |
|---|---|---|
| `.output/`, `.output.old/` | Propio, desechable | Borrar tras validar Hestiat 2.0 |
| `app.cjs`, `app.js`, `package.json` | Propio, desechable | Borrar cuando el nuevo arranque funcione |
| `scripts/` (incluye el desplegador atómico) | Propio, **conservar** | Herramienta de operación, no código muerto |
| `db/`, `vendor/` | Propio, conservar hasta el cutover | Revisar cuáles usa el nuevo |
| `LEEME-DESPLIEGUE.txt` | Propio, desechable | Borrar |
| `error_log`, logs del docroot | Propio, desechable | Borrar y dejar de escribir logs ahí |
| `sitemap*.xml` | Propio, **reemplazar** | Los regenerará Hestiat 2.0; no borrar sin sustituto |
| `mse_config.php` | **AJENO** | **NO TOCAR** (anterior al proyecto) |
| `amc/`, `cat/` | **DUDOSO** | **NO TOCAR** sin confirmar pertenencia |
| `hestiat-app.env` y sus copias | Propio, **conservar** | Secreto necesario; vive fuera del docroot |
| `hestiat-media/` (fuera del docroot) | Propio, conservar | Medios servidos; no retirar hasta migrar |
| Backups en `/home/ppxgfdyc/backups` | Propio, **conservar siempre** | Nunca se borran |
| La base de datos original | Propio, **conservar** | Permanece recuperable hasta validar Hestiat 2.0 |
| Bucket R2 y sus objetos | Propio, **conservar** | Inventario y migración antes de cualquier limpieza |
| Otros dominios de la cuenta | **AJENO** | Fuera de alcance por completo |

### 4.3 Orden de ejecución

1. Copia verificada (apartado 3) ✅
2. Auditoría fresca ✅
3. Backup completo de la aplicación con hash y prueba de extracción
4. Copia de la configuración en lugar seguro, 0600
5. Anotar el estado previo: versión en marcha, hashes, fecha
6. **Borrado por fases, con verificación tras cada una**, empezando por lo más claramente desechable (`app.js`, `LEEME-DESPLIEGUE.txt`, `error_log`, `sitemap*.xml` tras el sustituto)
7. Dejar `.output` y `app.cjs` **en último lugar**, cuando el arranque nuevo esté probado
8. **Vuelta atrás disponible en todo momento**: `.output.old` + el volcado verificado + el renombrado inverso

### 4.4 Lo que no se borra nunca en este proceso

Backups · base de datos original · objetos de R2 · `hestiat-media/` · credenciales · ficheros de otros dominios · configuraciones globales · cualquier archivo cuya pertenencia no esté confirmada.

### 4.5 Después de borrar

Verificar: home 200, búsqueda 200, ficha real 200, mapa con marcadores, login 307 correcto, 404 correcto sin 500, y que ninguna ruta antigua quede sirviendo restos. **No activar Cloudflare Proxy.**

---

## 5. Cortafuegos de seguridad permanentes (aprendidos de fallos reales)

1. **Nunca datos privados en el bucket público** (visto: volcado expuesto el 2026-10-03).
2. **Nunca ficheros de diagnóstico accesibles por HTTP**: se usan, se retiran en el mismo acto. (Se retiraron `fotos.php` y `lsnode.php`, este último capaz de matar el proceso de la aplicación.)
3. **Nunca borrar sin analizar relaciones** (las reservas bloquean el borrado de un alojamiento; es correcto que lo hagan).
4. **Nunca un error interno convertido en falso fallo de autenticación**: se propaga con mensaje seguro y se registra el detalle en servidor.
5. **Nunca desplegar sin verificación ni vuelta atrás**: el despliegue atómico ya construido es el estándar.
6. **Nunca dar por bueno un resultado obtenido por una vía que podría no haber llegado al servidor.**

---

## 6. Siguiente fase, en cuanto se desbloqueen los apartados 1.1 a 1.3

1. Verificación por restauración del volcado (apartado 3) → **levanta la prohibición de borrar**.
2. Auditoría fresca del estado desplegado.
3. Backup completo de la aplicación y de la configuración, con hashes.
4. Construcción de los módulos de Hestiat 2.0 sobre el esquema de `db/migrations/001_init.sql`.
5. Migración controlada de datos a la base nueva, primero en prueba.
6. Preparación del cutover con vuelta atrás, **sin activar Cloudflare Proxy**.
