# Hestiat V21 — Operations Worker + Idempotencia + Resiliencia

V21 consolida el worker de operaciones sobre V20 y convierte la cola persistente en una base más resistente para reservas, comunicaciones y sincronización de canales.

## Código incluido
- Worker V3 basado en `EventJob`.
- `FOR UPDATE SKIP LOCKED` + recuperación de leases existentes.
- Dedupe persistente mediante `dedupeKey`.
- Backoff progresivo y reintentos.
- `EventJobRun` para trazabilidad de cada intento.
- `EventDeadLetter` cuando se agotan los reintentos.
- Circuit breaker por proveedor (`CLOSED`, `OPEN`, `HALF_OPEN`).
- iCal registra cada feed procesado con hash y evita duplicar el evento de sincronización.
- Estado del canal pasa a `ATTENTION` ante errores y vuelve a `CONNECTED` tras sincronización correcta.
- Endpoint de health expone jobs, DLQ, circuitos y últimas ejecuciones.

## Regla de producción
Los handlers deben ser idempotentes. Reintentar un evento no puede provocar un efecto irreversible duplicado.

## Validación
Esta entrega se ha inspeccionado estáticamente. No se pudo ejecutar `npm install` completo en el entorno de trabajo porque agotó el tiempo disponible; por ello no se afirma que `prisma validate` o `next build` hayan pasado todavía.
