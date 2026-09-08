# Hestiat V32 — Precio dinámico en tiempo real

## Objetivo
La ficha del alojamiento consulta la cotización real del servidor cuando cambian entrada, salida o huéspedes.

## Flujo
1. El huésped selecciona fechas.
2. La UI espera brevemente para evitar peticiones durante cada clic.
3. `GET /api/alojamientos/[id]/cotizacion` comprueba disponibilidad, estancia mínima, capacidad y precios diarios.
4. El servidor devuelve desglose de alojamiento, limpieza, impuestos, servicio Hestiat y total.
5. La ficha actualiza el resumen sin recargar.
6. El checkout vuelve a consultar la cotización y la reserva vuelve a validar en servidor.

## Seguridad
El navegador nunca es la fuente de verdad del precio. El importe mostrado es informativo hasta la creación de la reserva; la creación y el pago usan el cálculo del servidor.
