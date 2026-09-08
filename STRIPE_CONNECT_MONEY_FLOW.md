# Hestiat — flujo de dinero

El PaymentIntent usa Destination Charges cuando el anfitrión tiene `stripeAccountId`:
- `amount`: total pagado por el huésped.
- `application_fee_amount`: comisión Hestiat.
- `transfer_data.destination`: cuenta Connect del anfitrión.

El webhook `payment_intent.succeeded` es la fuente de verdad para pasar Booking a CONFIRMED.

Pendiente:
- instalar/configurar `@stripe/stripe-js` y `@stripe/react-stripe-js`;
- montar Payment Element con el `clientSecret`;
- guardar/usar Customer cuando exista auth;
- política de captura/escrow compatible con el modelo de negocio;
- refunds/cancelaciones;
- validación de que la cuenta Connect está habilitada;
- expiración de PENDING;
- tests de concurrencia y webhooks;
- secretos y claves reales en producción.
