# Hestiat — acceso sin contraseña

Principio UX: un único campo de email. No se pide contraseña.

Flujo:
1. `/login`
2. POST `/api/auth/request-link`
3. Se crea un token de un solo uso, hash SHA-256, 15 minutos.
4. En producción, la URL se envía por el proveedor de email.
5. `/api/auth/verify` valida, consume el token y crea sesión.
6. Cookie httpOnly `hestiat_session`.

En desarrollo el endpoint devuelve `devUrl` para poder probar el flujo sin proveedor de email.

Pendiente antes de producción:
- integrar proveedor de email/transaccional;
- rate limiting y anti-abuse;
- dominio de envío y SPF/DKIM/DMARC;
- páginas de privacidad/términos;
- sesiones rotatorias en vez de usar directamente userId como cookie;
- OAuth opcional (Google/Apple) para aún menos fricción.
