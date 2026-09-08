# Hestiat — Checkout Stripe Payment Element

El checkout ya tiene:
- creación de Booking PENDING;
- creación de PaymentIntent;
- Payment Element de Stripe;
- confirmación desde Stripe.js;
- redirección a confirmación cuando el pago termina.

La reserva solo debe considerarse CONFIRMED cuando el webhook de Stripe lo confirme.

Pendiente para producción:
- sustituir datos demo por sesión/auth real;
- obtener listing/datos desde la selección real;
- mostrar cotización exacta antes de pago;
- gestionar estados `processing`, `requires_action` y 3DS;
- bloquear/expirar PENDING;
- pruebas end-to-end con Stripe test mode;
- guardar y validar Connect onboarding antes de crear destination charges.
