# Hestiat V22 — E2E Validation

V22 añade una prueba de integración contra PostgreSQL que valida el recorrido crítico del sistema sin depender de servicios externos.

## Escenarios

1. Dos checkouts simultáneos para las mismas fechas: solo uno gana.
2. La autoridad de disponibilidad reconoce `PENDING` activo.
3. Una reserva externa bloquea las mismas fechas.
4. Un bloqueo manual bloquea las fechas.
5. Un `PENDING` expirado deja de bloquear antes de que actúe el worker.
6. Parser y generación iCal.
7. `dedupeKey` evita crear jobs duplicados.
8. Job fallido → `EventJobRun` + Dead Letter Queue.
9. Lease `PROCESSING` antiguo se recupera y vuelve a ejecutarse.

## Ejecución

Requiere PostgreSQL configurado y dependencias instaladas:

```bash
pnpm install
pnpm db:generate
pnpm db:push
pnpm test:v22
```

La prueba crea datos temporales con prefijo `v22-` y los elimina al finalizar.

## Límite deliberado

Esta prueba no simula Stripe ni Meta/WhatsApp contra sus APIs reales. Esos E2E requieren credenciales de sandbox y deben ejecutarse en un entorno de staging. V22 valida primero el núcleo transaccional y de operaciones local.
