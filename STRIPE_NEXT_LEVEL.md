# Hestiat — Stripe + Connect

Flujo:
1. `Booking` se crea como `PENDING`.
2. `/api/reservas/[id]/pago` crea un PaymentIntent.
3. El cliente confirma el pago con Stripe.js/Payment Element.
4. Stripe llama a `/api/stripe/webhook`.
5. `payment_intent.succeeded` cambia la reserva a `CONFIRMED`.
6. `payment_intent.payment_failed` la pasa a `EXPIRED`.

Stripe Connect:
- `/api/anfitrion/stripe` inicia onboarding Express para un anfitrión.

Pendiente para producción:
- guardar `stripeAccountId` en User;
- crear Destination Charges/transferencias y `application_fee_amount`;
- retener/capturar pagos según política;
- idempotencia de webhooks/eventos;
- Payment Element real en checkout;
- autenticación y autorización;
- expiración automática de reservas PENDING;
- reembolsos y cancelaciones;
- facturación/impuestos según jurisdicción.
