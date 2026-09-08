# Hestiat V39 — Entorno de pruebas real

## Objetivo
Preparar Hestiat para una primera prueba completa de extremo a extremo, reduciendo riesgos sin introducir cambios innecesarios en disponibilidad, reservas, pagos o canales.

## Flujo huésped a validar
1. Home → búsqueda
2. Resultados → filtros
3. Alojamiento → fechas y disponibilidad
4. Cotización → desglose y total
5. Reserva → creación PENDING
6. Pago → PaymentIntent / Stripe
7. Confirmación → estado confirmado
8. Mi viaje → consulta y cancelación según política

## Flujo anfitrión a validar
1. Acceso
2. Dashboard
3. Crear/editar alojamiento
4. Publicar
5. Calendario
6. Reservas
7. Canales/iCal
8. Ingresos/pagos

## Comprobaciones V39 añadidas
- Smoke test de estructura crítica (`npm run test:smoke`).
- `APP_URL` explícita para URLs transaccionales.
- `test:release` incluye el smoke test después de las pruebas existentes.
- Versión del proyecto: `0.39.0`.

## Estado de verificación
### Verificable en entorno local
- Smoke estructural: ejecutable sin dependencias externas.
- Validación Prisma: requiere dependencias Node instaladas.
- Typecheck/build: requieren dependencias Node instaladas.

### Requiere infraestructura real
- PostgreSQL + PostGIS.
- Redis.
- Stripe en modo test y webhook.
- Email transaccional.
- WhatsApp si se prueba ese canal.
- R2 si se prueba subida de imágenes.

## Criterio de salida
V39 no se considera producción hasta ejecutar en un entorno limpio:
- `npm ci`
- `npm run db:generate`
- `npm run db:validate`
- `npm run typecheck`
- `npm run build`
- `npm run test:smoke`
- tests V20/V22/V23/V27/V28/V32/V35
- prueba E2E huésped completa
- prueba E2E anfitrión completa
- prueba Stripe test mode
- prueba iCal bidireccional

No marcar una comprobación como PASS si no se ha ejecutado realmente.
