# Hestiat V8 — Reservation Flow

## Implementado
- Checkout consume `listingId`, `checkIn`, `checkOut` y `guests` reales de la URL.
- Consulta precio/disponibilidad en `/api/alojamientos/[id]/cotizacion` antes de mostrar pago.
- Carga datos reales del alojamiento mediante `/api/alojamientos/[id]`.
- Carga usuario autenticado desde `/api/auth/me` y reutiliza nombre/email/teléfono cuando existen.
- Eliminados nombre/email demo del checkout.
- El usuario solo introduce los datos que faltan.
- Resumen lateral muestra fechas, huéspedes y desglose calculado por servidor.
- La reserva vuelve a validar disponibilidad y precio en servidor antes de crear `PENDING`.
- Payment Element de Stripe sigue siendo el paso posterior.
- Tras pago correcto redirige a `/confirmacion?bookingId=...`.
- El enlace de vuelta conserva el alojamiento seleccionado.

## Nota de validación
Se intentó ejecutar el build completo; la instalación/generación de dependencias superó el límite de ejecución disponible. El código se entrega como V8 y debe ejecutarse `pnpm install && pnpm build` en el entorno del proyecto antes de desplegar.

## Pendiente para producción
- Integrar selector de fechas real en ficha, en vez de los valores iniciales de demo.
- Conectar datos de ficha 100% al listing real en lugar del contenido editorial de Casa Olivo.
- Autenticación real de producción y creación automática de cuenta sin fricción.
- Expiración de PENDING, reembolsos/cancelaciones y pruebas E2E Stripe.
