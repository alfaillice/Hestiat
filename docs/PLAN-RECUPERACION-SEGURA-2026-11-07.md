# Recuperación segura de Hestiat en producción — 2026-11-07

## Estado comprobado

- La web pública `https://hestiat.com` usa **Next.js + NGINX**. Se han observado respuestas HTTP 200 en `/`, `/search`, `/experiencias`, `/servicios`, `/search?vista=mapa` y una ficha de alojamiento. Esto no prueba funcionalidad end-to-end.
- `https://shop.hestiat.com` responde HTTP 200 y usa Shopify: **fuera de alcance**.
- Las vistas `/experiencias` y `/servicios` anuncian cero resultados aunque sus filtros enumeran recuentos históricos por provincias. Se desconoce la causa.
- La ficha inspeccionada `/alojamiento/casa-de-campo-en-elche` abre, pero presenta imágenes etiquetadas como referencia externa. No se ha comprobado el acceso a fotos reales ni la disponibilidad fiable.
- `alfaillice/Hestiat:main` es un proyecto **TanStack Start/Vite** con alojamientos de demostración en `app/src/routes/index.tsx`; **no** es el código completo del Next.js actual y no debe instalarse sobre el VPS como restauración del marketplace.
- `alfaillice/Hestiat:nueva-web` y `backup-nueva-web` contienen documentación y migración fundacional Hestiat 2.0, pero no el Next.js completo: faltan por ejemplo `package.json` y `app/package.json` en ambas.
- `main` y `nueva-web` **no tienen ancestro común** según GitHub. Queda prohibido sobrescribir o forzar push entre ambas como si fueran variantes de la misma aplicación.
- El informe histórico `docs/ACTA-COPIA-VERIFICADA.md` documenta un volcado MariaDB del **2026-10-03** con 33 tablas restauradas en prueba y hash SHA-256 `b3b997257658bbe11c90a35f7425ff0d9e6873dcbb3645d3be662d1ac8f39c12`. **No prueba** que el archivo exista hoy en el VPS nuevo ni cubre cambios posteriores, fotos R2 o código.
- La sesión de Higgsfield Supercomputer utilizada por el propietario tiene, según él, acceso al VPS. El conector Higgsfield de ChatGPT **no hereda** automáticamente ese acceso SSH; su sandbox remoto es separado.

## Objetivo autorizado

Restaurar la última **versión realmente operativa** del marketplace Hestiat, conservando los datos y configuraciones presentes, para revisar luego si conviene reiniciar el producto desde cero. El usuario autoriza instalación y publicación **solo después** de verificar candidato y respaldo. No autoriza borrar los datos.

## Orden técnica para la sesión Supercomputer conectada al VPS

### Paso 1: diagnóstico en modo lectura

1. Identificar proveedor, hostname, aplicación de producción y sus procesos, directorios de despliegue y configuración efectiva de NGINX.
2. Anotar ruta actual, versión/build exacta y timestamp; `git remote -v`, rama, SHA si existe, working tree y archivos locales no confirmados. **Nunca imprimir ni copiar secretos**.
3. Inventariar releases históricos, snapshots, `.next`, posibles `current/previous`, unidades systemd, copias locales y externas. Una ruta heredada de HostingNice no implica que exista en el VPS actual.
4. Comprobar *por existencia y permisos*, sin revelar valores, que el runtime dispone de variables de acceso a MariaDB, R2, almacenamiento de imágenes y servicios requeridos; verificar conectividad en lectura y logs de errores.
5. Determinar si los síntomas de fichas sin fotos y listados a cero proceden de un fallo de conexión/configuración del runtime, del contenido, de permisos o del código. **No alterar una DB por suposición.**

### Paso 2: recuperación y protección

1. Generar snapshot de despliegue y configuración actual y, si hay datos persistentes en el VPS, respaldo de ellos. Verificar integridad y posibilidad de restauración antes de cambios.
2. Preservar imágenes y sus referencias, credenciales existentes *solo en almacenamiento seguro*, reservas, cuentas, datos de contacto, correos y servicio Shopify. Prohibido publicar dumps en almacenamiento público o GitHub.
3. Evaluar candidatos de reversión de **más reciente a más antiguo**: releases locales previos, snapshot del proveedor, artefactos CI existentes y copias históricas comprobadas.
4. Para cada candidato, comprobar **código completo** (incluido `package.json`, lockfile y archivos de configuración sin secretos), compatibilidad de Node, esquema DB, migraciones, servicio de imágenes y variables esperadas.
5. **No tomar `main` de GitHub como último estado operativo**: contiene demo con datos estáticos. **No tomar `nueva-web` como app instalable**: es fundacional. Si ningún candidato completo supera pruebas, detenerse sin desplegar.

### Paso 3: ensayo y despliegue reversible

1. Instalar un candidato completo en **directorio de release nuevo**, aislado de producción. No hacer `git reset --hard` ni `rm -rf` sobre la aplicación en marcha.
2. Usar el mismo esquema y servicios reales en modo de lectura para pruebas, o copia/restauración aislada cuando corresponda. No ejecutar migraciones de escritura automáticamente.
3. Ejecutar instalación de dependencias, TypeScript, build y pruebas funcionales.
4. Verificar en staging: home; listado con resultados coherentes; ficha individual, fotografías autorizadas reales, precio, mapa, filtros y enlaces; Experiencias y Servicios; login/ADMIN sin revelar sesiones; respuesta del subdominio Shopify.
5. Si un candidato supera las pruebas y se conserva rollback, ejecutar despliegue atómico en producción. El usuario ha autorizado recuperar la versión operativa y publicar **siempre que la versión está identificada y validada**.
6. Smoke test externo post-despliegue. Si hay regresión crítica, revertir inmediatamente el puntero al release anterior. Nunca borrar el release anterior hasta después de la aceptación.
7. Registrar hash del artefacto, commit de origen (si existe), hora y pruebas; sincronizar fuente completo y sin secretos a una rama segura del repositorio sin sobrescribir otros historiales ni usar force push.

### Comprobaciones de aceptación

- `/`, `/search`, ficha de alojamiento seleccionada, `/experiencias`, `/servicios` responden y funcionan con contenido **auténtico** donde corresponda.
- Fotos **auténticas y accesibles**, sin confundir imágenes de ambiente con fotos reales de propiedades.
- Mapa carga y sus marcadores se corresponden con resultados válidos.
- Login y zona ADMIN se mantienen protegidos; sin afirmar pruebas autenticadas si no se dispone de sesión.
- No hay errores 500 ni fallos JavaScript críticos; `shop.hestiat.com` y correo continúan independientes y operativos.
- Existe rollback real comprobable.

## Qué comunicar al usuario

Entregar tabla de candidatos con origen, fecha, stack, integridad y resultado de pruebas, escoger el más reciente **que funciona**, detallar si se desplegó o se detuvo por un bloqueo y explicar la acción siguiente sin pedir que el propietario abra una consola.

**No eliminar ni reiniciar desde cero el proyecto y la base de datos en esta operación.** Esa decisión se abordará después, con una solicitud independiente y comprobación de obligaciones legales de conservación.
