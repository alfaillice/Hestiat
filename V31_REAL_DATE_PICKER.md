# Hestiat V31 — Real Date Picker

- Selector de entrada/salida real en la ficha del alojamiento.
- Dos meses en escritorio y un mes en móvil.
- Bloquea noches con reservas internas, reservas externas, bloqueos manuales o sin precio.
- Respeta `minNights`.
- No permite saltarse una noche no disponible al seleccionar el rango.
- Las fechas elegidas se conservan en la URL hacia checkout.
- Nueva API: `GET /api/alojamientos/[id]/disponibilidad?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- Checkout sigue siendo la autoridad final: vuelve a cotizar y revalida disponibilidad en servidor.
