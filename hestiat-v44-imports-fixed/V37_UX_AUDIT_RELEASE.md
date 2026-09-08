# Hestiat V37 — UX Audit & Release Hardening

Base: V36 Mobile & Responsive Final.

## Objetivo
Última pasada de experiencia antes de las pruebas reales: eliminar fricción móvil, evitar controles difíciles de tocar y preparar el producto para una validación funcional completa.

## Ajustes aplicados
- Corregido el layout móvil del buscador de `/resultados`: sus campos son `<label>` y ahora reciben la maquetación responsive correcta.
- Inputs y selects móviles mantienen un tamaño de texto de 16px para evitar zoom automático y mejorar legibilidad.
- Añadido foco visible accesible para botones, enlaces y campos.
- Añadida protección global frente a overflow horizontal de medios y controles.
- Mejorado el desplazamiento táctil de filtros en móvil.
- El listado de resultados deja de depender de un contenedor interno con scroll en móvil.
- CTA de reserva móvil conserva una altura táctil cómoda.
- Versión del proyecto actualizada a `0.37.0`.

## Recorrido funcional a validar
### Huésped
Home → búsqueda → filtros → alojamiento → fechas → cotización → reserva → pago Stripe → confirmación → Mi viaje → cancelación.

### Anfitrión
Login → dashboard → nuevo alojamiento → publicación → calendario → canales → reservas → completar → ingresos/payout.

### Operaciones
Health → jobs → worker → retries → DLQ → circuit breaker → sincronización iCal.

## Bloqueos conocidos antes de producción
- Ejecutar `pnpm install`/instalación limpia y después `pnpm typecheck` y `pnpm build` en un entorno con Node y dependencias disponibles.
- Ejecutar PostgreSQL/PostGIS + Redis y las pruebas V20/V22/V23/V27/V28/V32/V35.
- Revisar y consolidar el orden de migraciones Prisma antes de producción.
- Completar revisión legal/fiscal, disputas/chargebacks y reconciliación financiera.
- Reforzar SSRF contra DNS rebinding/IPv6 en el importador iCal.

## Criterio de salida V37
La UX queda preparada para pruebas reales, pero no se declara "production ready" hasta ejecutar las validaciones de infraestructura indicadas arriba.
