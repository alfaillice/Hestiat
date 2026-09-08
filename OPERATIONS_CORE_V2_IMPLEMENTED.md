# Hestiat Operations Core V2 — implementado

## Implementado
- Cola persistente `EventJob` en PostgreSQL.
- Dispatcher por tipo de evento.
- Worker con polling continuo o `--once`.
- Reclamo concurrente con `FOR UPDATE SKIP LOCKED`.
- Lease y recuperación de jobs `PROCESSING` abandonados.
- Backoff: 1m / 2m / 5m / 15m / 30m / 60m.
- Idempotencia por `dedupeKey`.
- Continuación automática de conversaciones huésped/anfitrión.
- Webhook WhatsApp desacoplado: responde rápido y encola el procesamiento.
- Mensajes con canal y `providerMessageId`.
- Expiración de reservas PENDING de más de 30 minutos.
- Endpoint interno de health/estado de jobs.

## Eventos soportados
- `AI_HOST_REPLY_CONTINUATION`
- `WHATSAPP_INBOUND_PROCESS`
- `NOTIFICATION_DISPATCH`
- `BOOKING_EXPIRE_PENDING`

## Arranque
```bash
pnpm install
pnpm db:generate
pnpm db:push
pnpm worker:events
```

Para una ejecución única:
```bash
pnpm worker:once
```

## Próxima capa
El sistema queda preparado para añadir jobs de WhatsApp outbound y email outbound sin bloquear API/web, y posteriormente ejecutar workers separados por prioridad.

## Producción
No se considera producción listo hasta configurar PostgreSQL real, secretos, proveedor WhatsApp/email, observabilidad, límites de reintentos ajustados, despliegue supervisado del worker y pruebas E2E.
