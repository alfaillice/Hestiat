# Hestiat IA — Tools V1

La IA ya puede utilizar herramientas server-side, siempre después de comprobar que la reserva pertenece al huésped.

Herramientas:
- `get_trip_details`: consulta datos reales de la reserva/alojamiento.
- `create_support_request`: abre una incidencia Hestiat cuando el huésped necesita ayuda.

Seguridad:
- cada request se autentica;
- `bookingId` se valida contra `guestId`;
- las herramientas no aceptan datos de otro huésped;
- la IA no puede marcar reservas como pagadas/confirmadas;
- las acciones sensibles se mantienen fuera de la IA en esta V1.

Próximas herramientas:
- consultar disponibilidad;
- mensajes con anfitrión;
- instrucciones de check-in;
- recomendaciones cercanas;
- solicitar cambios de reserva;
- cancelación/refund, siempre con confirmación explícita del usuario.
