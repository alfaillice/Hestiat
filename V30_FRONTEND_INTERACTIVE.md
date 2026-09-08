# Hestiat V30 — Frontend interactivo

V30 conecta las pantallas principales para que el recorrido pueda probarse como usuario real.

## Flujo huésped
Inicio → búsqueda → resultados → filtros/orden → ficha → reserva → pago → confirmación → Mi viaje.

## Cambios
- Buscador de Home con destino, fechas y huéspedes.
- Parámetros de búsqueda persistidos en URL.
- Resultados consumen API real y admiten tipo/precio.
- Orden por precio en cliente.
- Enlaces de tarjetas preservan las fechas y huéspedes.
- Sin datos de Casa Olivo.

## Validación pendiente
Requiere dependencias, PostgreSQL y variables de entorno para ejecutar `pnpm typecheck` y `pnpm build` de forma completa.
