# Hestiat — estado real y relevo técnico (7 de noviembre de 2026)

> Auditoría **en modo lectura** desde navegador automatizado. Sin acceso SSH al VPS. No sustituye la inspección del código desplegado ni la validación con cuenta ADMIN.

## Objetivo autorizado

Retomar el rediseño de Hestiat.com en tres fases, con la identidad visual propia de Hestiat y tomando como referencia la calidad de navegación de Airbnb, sin copiar recursos protegidos:

1. **Home y header**, incluido acceso a **Tienda → https://shop.hestiat.com**.
2. **Explorador, filtros y mapa**.
3. **Fichas de alojamiento, galería, comodidades, contacto/reserva y mapa**.

El usuario desea despliegues progresivos verificables en el dominio real. No realizar borrados de datos durante el rediseño. No tocar otros dominios, DNS, correo ni Shopify.

## Comprobaciones realizadas desde fuera del VPS

| Ruta / servicio | Evidencia |
| --- | --- |
| `https://hestiat.com/` | HTTP 200; Next.js sobre NGINX. Home visible en navegador de 1440 px y 390 px; sin errores JavaScript durante la carga. |
| Header | Enlaces a Alojamientos (`/search`), Experiencias (`/experiencias`), Servicios (`/servicios`), Entrar, Publica tu espacio y **Tienda** (`https://shop.hestiat.com/`). |
| `https://shop.hestiat.com/` | HTTP 200; cabeceras características de Shopify. **No modificar** durante el rediseño turístico. |
| `/search` | HTTP 200; título «Explorar alojamientos»; filtros por provincia, precio, ordenación y comodidades. |
| `/search?vista=mapa` | HTTP 200; página indica «48 alojamientos en el mapa»; no se ha confirmado visualmente el funcionamiento completo de marcadores ni interacción. |
| `/alojamiento/casa-de-campo-en-elche` | HTTP 200; galería, descripción, comodidades, calendario y enlaces de solicitud de reserva presentes. |
| `/experiencias` | HTTP 200, pero la interfaz anuncia «0 planes reales» mientras su selector enumera miles de registros por provincia. Investigar si es efecto de filtros, estado de publicación o fallo de consulta. No afirmar causa sin comprobar. |
| `/servicios` | HTTP 200, pero la interfaz anuncia «0 servicios reales» mientras su selector enumera miles de registros por provincia. Investigar con la misma cautela. |

La prueba anónima no valida autenticación, permisos administrativos, persistencia, disponibilidad ni reservas. Las etiquetas visibles «60 de los próximos 60 días libres» en una ficha requieren verificar su procedencia antes de presentarlas como disponibilidad real.

## Bloqueo principal: origen de código no sincronizado

El repositorio conectado es `alfaillice/Hestiat` y existe la rama `nueva-web`.

**Hecho verificado:** las ramas `main` y `nueva-web` no tienen ancestro común, según la comparación de GitHub. `main` contiene una aplicación Higgsfield de TanStack/Cloudflare Worker, mientras que `nueva-web` contiene documentación de la fundación Hestiat 2.0 y migraciones. **No se ha demostrado que ninguna de esas dos ramas contenga el Next.js que corre hoy en el VPS.**

La sesión Supercomputer de Higgsfield del propietario puede tener acceso SSH al VPS, pero ese acceso no se transfiere automáticamente a ChatGPT ni al sandbox de la integración Higgsfield.

**No ejecutar push forzado ni sobrescribir el directorio de producción desde un repositorio sin verificar su correspondencia.**

## Siguiente intervención desde la sesión Supercomputer que ya está conectada al VPS

Solo inspección y sincronización controlada, sin cambiar servicios:

1. Identificar directorio de despliegue actual, remoto Git, rama, commit actual y estado de los archivos locales del proyecto Next.js en el VPS.
2. Identificar archivos modificados y no confirmados, así como cambios que aún no están en GitHub.
3. Realizar una copia/snapshot del código, recursos y configuración necesaria (sin subir secretos al repositorio).
4. Determinar si `nueva-web` coincide realmente con el código de producción. Si difiere, **no sobrescribir**: proponer un mecanismo seguro para importar el estado real a una rama de trabajo o conciliar historiales. Mantener `nueva-web` como objetivo autorizado, sin tocar `main`.
5. Publicar el código recuperable y sin secretos de forma revisable, con commit y hash; documentar exactamente el commit que corre en producción.
6. Facilitar acceso de revisión por GitHub a ChatGPT; solamente después editar el frontend.
7. Publicar cambios progresivos tras build, pruebas, snapshot y smoke tests reales.

## Criterios de seguridad

- No borrar bases de datos, alojamientos, experiencias, servicios, usuarios, fotos, reservas o logs de interés legal.
- No modificar `shop.hestiat.com` ni sus credenciales, DNS o correo.
- No publicar supuestos datos de demostración como reales.
- No copiar logotipos, iconos exclusivos, fotografías ni textos de Airbnb.
- Comprobar móvil y escritorio, rutas públicas, panel ADMIN (si se dispone de sesión autorizada) y posibilidad de rollback.
- No declarar una fase concluida únicamente por compilar o por leer código; verificar producción.

## Estado del relevo

La auditoría pública puede continuar desde ChatGPT, pero el desarrollo de la aplicación Next.js y su despliegue directo requieren **sincronizar primero el código real que Higgsfield opera en el VPS**. Este documento deja la situación registrada sin poner en peligro los cambios existentes.
