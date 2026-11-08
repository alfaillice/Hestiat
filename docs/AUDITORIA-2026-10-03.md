# Auditoría fresca y estado de copias — 2026-10-03 (16:29 UTC)

Ejecutada dentro del servidor con la IP del entorno de trabajo ya desbloqueada.
Solo lectura, salvo el backup (que escribe en `/home/ppxgfdyc/backups`). Sin secretos.

---

## 1. Veredicto de precondiciones: **FALTA 2 cosas**

```
[ LISTO ] el bucket existe y exige credenciales (HTTP 400 sin firmar)
[ FALTA ] sin permisos sobre ppxgfdyc_hestiat2
[ FALTA ] escritura en el bucket privado: HTTP 403
[ LISTO ] el sitio responde desde el servidor (HTTP 200)
[  INFO ] SSH puerto 22: cerrado
```

### 1.1 La base de datos nueva no está lista

```
Access denied for user 'ppxgfdyc_hestiat'@'localhost' to database 'ppxgfdyc_hestiat2'
```

La base `ppxgfdyc_hestiat2` **no existe o el usuario no tiene permisos sobre ella**. Hasta que se cree en cPanel y se añada el usuario con todos los privilegios, **el script de restauración se negará a ejecutarse** — y hace bien.

### 1.2 El bucket existe, pero mis credenciales no pueden escribir en él

- Sin firmar responde **400**, lo que confirma que **el bucket `hestiat-backups` existe y no es público**.
- Pero la escritura firmada devolvió **403**.

**Diagnóstico:** las credenciales de R2 guardadas en el entorno están **restringidas al bucket `hestiat`**. No alcanzan a `hestiat-backups`.

**Solución:** crear un token de API de R2 que incluya el bucket nuevo (o una clave con alcance de cuenta) y actualizar `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` en el `.env` del servidor. Si se cambian, hay que **reiniciar el pool de la aplicación** para que la tome.

### 1.3 Lo que sí está en orden

El sitio responde; SSH sigue cerrado pero **no es necesario**: los scripts se ejecutan desde la Terminal de cPanel.

---

## 2. La restauración y el acta real: **NO EJECUTADAS**

Consecuencia directa de 1.1: no existe destino donde restaurar. **La prohibición de borrar sigue vigente.** No se ha generado ningún acta real; el documento `docs/EJEMPLO-ACTA-COPIA-VERIFICADA.md` es solo formato.

---

## 3. Auditoría del sistema desplegado

### 3.1 Build

```
entry .output/server/index.mjs   38.870 B · 2026-10-03 17:46 · sha cffeed6c0f13c814
índices de cliente               1  →  index-BHBG3R2_.js (446.020 B)
manifiestos                      1
.output.old                      presente (respaldo)
```

Un solo índice y un solo manifiesto: el árbol está coherente.

### 3.2 Qué sirve realmente la aplicación

```
home HTTP 200 · 260.698 B · pide /assets/index-BHBG3R2_.js
ese índice en disco: SÍ
¿coincide con el build desplegado? SÍ
título: "Hestiat — Alojamientos con carácter en toda España"
```

**El proceso sirve exactamente el build desplegado.** La hidratación es coherente.

### 3.3 Rutas

| Ruta | HTTP | Tiempo |
|---|---|---|
| `/` | 200 | **3,58 s** |
| `/search` | 200 | 0,16 s |
| `/experiencias` | 200 | **2,99 s** |
| `/servicios` | 200 | 0,30 s |
| `/login` | 200 | 0,02 s |
| `/host` | 307 | 0,02 s |
| `/admin` | 307 | 0,02 s |
| `/api/mantenimiento` | 401 | 0,02 s |
| `/no-existe-xyz` | 404 | 0,02 s |

Todo correcto. **Dos avisos de rendimiento**: la portada y `/experiencias` tardan casi 3-4 segundos en frío; el buscador responde en 0,16 s. Hay que investigar las consultas de la portada y de experiencias.

### 3.4 Inventario del docroot

Desechable: `.despliegue/` (resto de un despliegue propio), `LEEME-DESPLIEGUE.txt`, `error_log`, `sitemap-*.xml` (se reemplazan), `app.js`.
Conservar: `scripts/` (desplegador atómico y utilidades), `db/`, `vendor/`, `tmp/`, `.output.old`.
**No tocar:** `mse_config.php` (ajeno), `amc/`, `cat/` (pertenencia sin confirmar).
Mío y pendiente de retirar: `ACTA-CIERRE.md`.

### 3.5 Corrección de una afirmación anterior

En un informe previo dije que **el front desplegado había cambiado** respecto a mi auditoría. **Me equivoqué.** El build desplegado es el mismo (`index-BHBG3R2_.js`, entry `cffeed6c…`) y la portada siempre tuvo ese diseño: confundí el título de la portada con el del buscador. Queda corregido.

---

## 4. Backup de la aplicación: **HECHO Y VERIFICADO**

```
fichero:  /home/ppxgfdyc/backups/app/hestiat-app-20261003-112913.tar.gz
tamaño:   3.106.370 B
sha256:   adc6fd0e49b10e1ac6409f8d366b5add4f19cdb32d5d0861c6880ca0186067cf
prueba:   314 ficheros extraídos · entry presente · entry IDÉNTICO al de producción
```

Con esto queda cerrado el requisito «copia de la aplicación con hash y prueba de extracción» de `HESTIAT-OPERATIONS.md`, que hasta ahora estaba marcado como **NO CONFIRMADO**.

---

## 5. Estado de las copias tras esta auditoría

| Copia | Estado |
|---|---|
| Base de datos | Hecha · integridad y contenido verificados |
| Verificación por restauración | **PENDIENTE** (falta la base destino) |
| Aplicación (código desplegado) | **HECHA Y VERIFICADA** (hash + extracción) |
| Configuración (`.env` + copias) | Copiada en la primera pasada, pendiente de confirmar |
| Esquema | Capturado en `db/migrations/001_init.sql` |
| Inventario de R2 | 0 objetos en el bucket público |

---

## 6. Siguiente acción, en orden

1. **cPanel → Bases de datos MySQL**: crear `hestiat2` (quedará `ppxgfdyc_hestiat2`) y añadir el usuario con **todos los privilegios**.
2. **R2**: crear un token que incluya `hestiat-backups` y actualizar las claves del `.env` (+ reiniciar el pool).
3. Volver a comprobar: `comprobar-precondiciones.sh --destino ppxgfdyc_hestiat2 --bucket hestiat-backups`.
4. Cuando diga **LISTO**, lanzar la restauración y generar el acta real → **eso levanta la prohibición de borrar**.
