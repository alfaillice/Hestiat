# Hestiat — Reservas Next Level

Se incorpora:
- cotización exacta por fechas;
- precios diarios desde `AvailabilityDay` con fallback al precio base;
- noches mínimas;
- límite de huéspedes;
- bloqueos manuales;
- detección de reservas solapadas;
- creación transaccional de `Booking`;
- estado inicial `PENDING`;
- comisión Hestiat configurable (actualmente 8% en esta V1);
- endpoint de reserva listo para conectarse a Stripe.

Importante: `PENDING` no debe considerarse cobro confirmado. El siguiente paso es crear PaymentIntent/Stripe Connect y confirmar la reserva mediante webhook, no desde el navegador.
