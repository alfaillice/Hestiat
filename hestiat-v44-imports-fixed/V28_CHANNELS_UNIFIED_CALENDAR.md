# Hestiat V28 — Canales y calendario unificado

- iCal entrante idempotente por proveedor + UID.
- iCal saliente con reservas Hestiat y bloqueos manuales.
- ETag/304 para reducir polling.
- Desconexión explícita de canales.
- Sincronización manual protegida por propiedad del alojamiento.
- Adaptadores separados de la autoridad de disponibilidad.
- Airbnb, Booking.com y channel managers quedan preparados, sin fingir conectividad directa sin acceso autorizado de partner/API.
- Un canal desconectado deja de publicar el feed y conserva historial.

La disponibilidad unificada de Hestiat sigue siendo la autoridad para vender en Hestiat. Las reservas externas importadas bloquean inventario y los conflictos no se venden.
