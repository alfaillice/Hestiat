# Hestiat V27 — Reservas, cancelaciones y reembolsos

## Política comercial V1
- FLEXIBLE: 100% hasta 24h antes de entrada; 0% después.
- MODERATE: 100% hasta 5 días antes; 50% entre 24h y 5 días; 0% después.
- FIRM: 100% hasta 30 días antes; 50% entre 7 y 30 días; 0% después.

Las reglas están centralizadas en `src/server/modules/cancellations/policy.ts`.

## Flujo
- Huésped puede cancelar PENDING o CONFIRMED.
- PENDING cancela el PaymentIntent si existe.
- CONFIRMED calcula el reembolso y crea un `RefundRecord` por cada devolución Stripe.
- Repeticiones no vuelven a reembolsar el importe ya devuelto.
- Anfitrión puede cancelar y, si existe pago, se devuelve el importe restante al huésped.
- Si ya hubo payout al anfitrión, no se hace una reversión silenciosa: queda marcado para conciliación manual.
- Un payout solo se puede ejecutar para una reserva COMPLETED.

## Estados financieros
Booking ↔ PaymentRecord ↔ RefundRecord ↔ HostPayout se mantienen separados para evitar duplicidad y conservar trazabilidad.

## Pendientes de producción
- Política legal/fiscal definitiva por jurisdicción.
- Disputas/chargebacks.
- Reversión automática de transferencias Connect cuando sea jurídicamente y financieramente segura.
- Tests E2E contra Stripe test mode + PostgreSQL real.

## Payout tras reembolso parcial
El payout se calcula sobre el importe del anfitrión proporcionalmente reducido por los reembolsos ya realizados. Una reserva con reembolso parcial sigue siendo liquidable cuando queda saldo para el anfitrión.
