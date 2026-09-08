# Hestiat V35 — Checkout final

V35 consolida el tramo de conversión del huésped: ficha → checkout → Payment Element → confirmación → Mi viaje.

## Principios
- El servidor es la autoridad para disponibilidad, precio, Booking y PaymentIntent.
- El navegador nunca puede fijar el importe.
- El botón de pago se bloquea durante el procesamiento para evitar dobles envíos.
- `redirect: if_required` permite métodos que necesitan redirección sin forzarla para tarjetas.
- Después de confirmar, el cliente consulta el estado de la reserva; `CONFIRMED` es la única condición para ir a confirmación.
- Estados `processing`/`requires_capture` no generan un segundo pago.
- El usuario puede volver a `Mi viaje` sin perder su reserva.

## Flujo
1. Cotización server-side.
2. Datos del huésped reutilizados desde `/api/auth/me`.
3. Creación transaccional de Booking PENDING.
4. Creación/reutilización idempotente del PaymentIntent.
5. Stripe Payment Element.
6. Webhook confirma Booking + PaymentRecord.
7. Cliente consulta estado.
8. Confirmación únicamente si Booking=CONFIRMED.

## Seguridad
- Booking, PaymentIntent y estado solo son accesibles por el huésped autenticado.
- El checkout vuelve a validar disponibilidad/precio durante la creación de Booking.
- La idempotencia de Stripe usa `booking-payment:${booking.id}`.
- Webhooks Stripe se deduplican por `event.id`.
