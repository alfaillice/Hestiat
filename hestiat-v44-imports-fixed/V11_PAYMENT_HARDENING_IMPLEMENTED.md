# Hestiat V11 — Checkout & Payment Hardening

Partimos de V9 y endurecemos el checkout Stripe.

- Reserva PENDING con expiración de 30 minutos.
- Se crea sesión passwordless automáticamente para un huésped sin sesión.
- PaymentIntent idempotente por reserva.
- Si ya existe PaymentIntent, se recupera su client secret y estado.
- `payment_intent.succeeded` confirma y registra `paidAt`.
- `payment_intent.payment_failed` conserva la reserva pendiente para permitir reintento mientras no expire.
- `payment_intent.canceled` expira la reserva.
- Webhook procesa evento + cambio de reserva en una transacción.
- Endpoint seguro de estado de pago para el huésped autenticado.
- Checkout distingue pago confirmado, procesamiento y fallo.
- Worker de expiración cancela PaymentIntents aún cancelables antes de liberar la reserva.
- Si el worker encuentra un PaymentIntent ya satisfecho, confirma la reserva en lugar de expirar una reserva pagada.
- Confirmación carga la reserva real y no contiene Casa Olivo ni importes demo.

No se considera producción hasta configurar Stripe real, webhook firmado, HTTPS, autenticación de producción, pruebas E2E y política de expiración/refund/captura validada legal y financieramente.
