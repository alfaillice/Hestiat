# Hestiat V41 — Staging Runbook

## Objetivo
Levantar un entorno aislado de staging y ejecutar la primera validación real de infraestructura.

## 1. Preparar variables
Copiar `.env.staging.example` a `.env.staging` y completar secretos de **Stripe Test Mode**, Resend/WhatsApp si se prueban, y el secreto de operaciones.

Nunca introducir claves `sk_live_` en staging.

## 2. Infraestructura
```bash
docker compose up -d postgres redis
docker compose ps
```

Esperar a que Postgres y Redis aparezcan como `healthy`.

## 3. Prisma
Primera ejecución controlada:
```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:validate
```

**Importante:** el repositorio actual no contiene una migración `0001_*` y tiene tres migraciones con prefijo `0005_*`. No ejecutar `prisma migrate deploy` sobre producción hasta reconstruir/consolidar el historial.

Para un staging efímero se puede usar, previa revisión del schema:
```bash
pnpm db:push
```

## 4. Aplicación
```bash
pnpm build
pnpm start
```

En otra terminal:
```bash
E2E_BASE_URL=https://staging.hestiat.com pnpm test:v40
pnpm test:v41
```

## 5. Worker
Con Redis disponible:
```bash
pnpm worker:once
```

Después validar que los jobs procesados no se duplican y que un job fallido puede reintentarse.

## 6. Stripe Test Mode
Probar:
- PaymentIntent correcto.
- PaymentIntent rechazado.
- webhook `payment_intent.succeeded`.
- webhook duplicado.
- refund total/parcial.
- cancelación del huésped.
- cancelación del anfitrión.
- payout posterior al checkout + ventana de seguridad.

## 7. Reserva concurrente
Lanzar dos intentos de reserva para el mismo alojamiento y fechas. Resultado esperado: **exactamente uno** puede ganar.

## 8. Canales
Probar iCal entrante con UID estable, reserva externa que bloquee inventario, feed saliente y ETag/304.

## Gate V41
No pasar a producción hasta que estén en PASS:
- `db:validate`
- `typecheck`
- `build`
- smoke HTTP staging
- reserva concurrente
- Stripe Test Mode + webhooks
- worker + Redis
- iCal
- revisión de migraciones
