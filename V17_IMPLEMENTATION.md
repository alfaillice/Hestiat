# Hestiat V17 — iCal implementation

Esta entrega contiene implementación física sobre la base V11:

- Prisma: ListingChannelConnection, ExternalReservation, ChannelSyncEvent.
- Migración `0011_channel_sync`.
- Parser iCalendar sin dependencia adicional.
- Sincronización iCal inbound mediante fetch con timeout y protección básica SSRF.
- Upsert idempotente de reservas externas.
- Reconciliación de eventos desaparecidos.
- API de conexión iCal para anfitriones.
- API para solicitar sincronización mediante EventJob.
- API de calendario del anfitrión.
- Feed iCal público de Hestiat para que un canal externo pueda consumir las reservas.
- Dispatcher integrado con Operations Worker.

## Importante

iCal no ofrece un mecanismo universal de push. El feed de Hestiat es consumido por el canal externo según su frecuencia. La sincronización inbound de un calendario externo se ejecuta mediante Operations Worker.

Airbnb/Booking.com todavía requieren el adapter y las credenciales/programas de conectividad correspondientes; V17 no finge tener acceso directo a esas APIs.

## Validación local

Con PostgreSQL configurado:

```bash
pnpm install
pnpm db:generate
pnpm db:push
pnpm worker:once
pnpm build
```
