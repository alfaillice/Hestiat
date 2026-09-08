# Hestiat V40 — E2E Testing & Release Gate

## Objetivo

V40 no añade funcionalidades de producto. Su objetivo es convertir V39 en una versión verificable mediante un **release gate** que separa claramente lo comprobado de lo que necesita infraestructura real.

## Gate automático

```bash
npm run test:v40
```

El gate comprueba de forma estática:

- rutas críticas de huésped y anfitrión;
- APIs de búsqueda, disponibilidad, cotización, reserva y pago;
- autenticación/sesiones;
- transacción Serializable + advisory lock para evitar doble reserva;
- reservas externas y bloqueos manuales;
- idempotencia de PaymentIntent y webhooks Stripe;
- cancelaciones/refunds;
- variables de entorno críticas;
- ausencia de URLs `localhost` hard-coded en `app/` y `src/`;
- protección del dev-login en producción.

## Smoke HTTP opcional

Con una instancia desplegada:

```bash
E2E_BASE_URL=https://staging.hestiat.com npm run test:v40
```

Comprueba que `/`, `/resultados`, `/login` y `/anfitrion` no devuelven HTTP 5xx.

## Prueba E2E real pendiente de infraestructura

Estas pruebas no se consideran aprobadas hasta ejecutarlas contra PostgreSQL/PostGIS, Redis y Stripe de prueba:

1. Huésped busca alojamiento y obtiene resultados.
2. Selecciona fechas disponibles y obtiene cotización.
3. Crea PENDING.
4. Se crea PaymentIntent de forma idempotente.
5. `payment_intent.succeeded` convierte PENDING → CONFIRMED.
6. El webhook duplicado no duplica efectos.
7. Dos checkouts concurrentes para las mismas fechas: exactamente uno consigue la reserva.
8. Reserva externa iCal bloquea inventario.
9. Bloqueo manual impide reserva.
10. PENDING expirado deja de bloquear.
11. Pago fallido permite reintento.
12. Cancelación aplica FLEXIBLE/MODERATE/FIRM correctamente.
13. Refund actualiza el ledger.
14. Host cancellation devuelve el dinero cuando corresponde.
15. Payout no se libera antes de COMPLETED + 24h.
16. iCal outbound refleja reservas y bloqueos.
17. Login magic-link crea sesión segura y logout la elimina.
18. Flujo móvil completo funciona sin overflow horizontal.

## Criterio de salida

V40 se puede considerar **release candidate** solo cuando:

- `npm run db:validate` pasa;
- `npm run typecheck` pasa;
- `npm run test:v32` pasa;
- `npm run test:v35` pasa;
- `npm run test:v40` pasa;
- PostgreSQL/PostGIS y Redis están operativos;
- las pruebas Stripe se ejecutan en modo test;
- los escenarios E2E anteriores pasan en staging;
- no existen errores críticos abiertos.

No se debe declarar producción lista basándose únicamente en el gate estático.
