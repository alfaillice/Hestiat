# Hestiat — cuenta sin fricción

La cuenta se trata como una consecuencia del uso, no como una barrera:
- el huésped puede entrar con magic link;
- `Mi cuenta` muestra email, perfil y accesos relevantes;
- `/api/auth/bookings` devuelve solo las reservas del usuario autenticado;
- `/api/anfitrion/alojamientos/mios` devuelve solo los alojamientos del anfitrión autenticado.

Objetivo UX:
- no pedir datos que Hestiat ya conoce;
- no separar registro y reserva innecesariamente;
- mostrar solo acciones relevantes para el rol;
- mantener el acceso a viajes/anfitrión a un toque.
