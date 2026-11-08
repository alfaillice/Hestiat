# Hestiat AI Manager — inventario de lo que YA existe

Comprobado contra producción el 9 de octubre de 2026. Rama `nueva-web` · https://hestiat.com
Complementa a `docs/IA-MANAGER.md` (arquitectura y guía). Aquí solo hay inventario y estado real.

---

## 1. API de IA — PENDIENTE DE CONFIGURAR

| Cosa | Estado |
|---|---|
| Credencial del modelo | **NO configurada**: no existe ninguna variable de IA en el entorno del servicio |
| Código del núcleo | Listo y desplegado: `lib/ia.server.ts` (protocolo compatible con OpenAI, herramientas, contexto, errores, límites, coste) |
| Variables que hay que poner | `IA_API_KEY` (imprescindible) · `IA_BASE_URL` · `IA_PROVEEDOR` · `IA_MODELO_ECONOMICO` · `IA_MODELO_POTENTE` · `IA_LIMITE_ENVIOS_DIA` · `IA_TIEMPO_MAXIMO_MS` |
| Comportamiento sin clave | **Bloquea y lo dice** (`sin_credenciales`). Probado: no finge una conversación |
| Prueba real de conexión | Botón en `/admin/ia`. Una llamada de verdad; hasta que funciona, la consola no da la integración por conectada |
| Caminos de error probados | Credencial rechazada (401 real del proveedor) · proveedor inalcanzable · respuesta inválida |
| Límites | 120 llamadas/hora y 5 USD/día por defecto, editables; gasto registrado por tokens y modelo |

## 2. Sistema de correo — EN PIE

| Cosa | Estado |
|---|---|
| Servidor de envío | Configurado (TLS implícito, puerto 465). Remitente `hola@hestiat.com` |
| Correo transaccional | Funciona: avisos de reserva (anfitrión, huésped y copia) y verificación de correo |
| Camino de salida único | El agente reutiliza `enviarCorreo`, el mismo de las reservas |
| Campaña anterior | Tabla real con **6.013 envíos**; de ahí salen las estadísticas que consulta el agente |
| Envío comercial automático | **NO existe.** Hace falta aprobación de un administrador real (se comprueba contra la tabla de usuarios) |
| Exclusiones y rebotes | Tabla `email_exclusion`; las bajas y los rebotes se respetan y se registran |
| SPF, DKIM y DMARC | **Sin comprobar**: requiere acceso al panel del dominio |

## 3. Autenticación y permisos — EN PIE Y REUTILIZADOS

- Usuarios reales: **3** (1 administración, 2 anfitriones). Roles: `huesped`, `anfitrion`, `admin`.
- Sesiones en la base original, token de 64 caracteres, cookie `HttpOnly` + `Secure` + `SameSite=Lax`.
- Guardas en servidor: `requireAdmin()` y `requireHost()`; propiedad de un alojamiento con
  `ownsListing()`.
- La API del agente responde **403** sin sesión de administración (probado con anfitrión y sin sesión).
- El panel `/admin/ia` redirige a acceso si no hay sesión de administración (307).

## 4. Herramientas sobre publicaciones — LECTURA SÍ, ESCRITURA NO (a propósito)

| Cosa | Estado |
|---|---|
| Consultar publicaciones | Sí: `search_publications` y `get_publication` (alojamientos, experiencias y servicios) |
| Modificar o eliminar publicaciones | **No existe ninguna herramienta.** El agente no puede, ni por petición en una conversación |
| Edición real hoy | Solo administración, desde el editor único (`/admin/editar/[tipo]/[id]`) con columnas permitidas |
| Botón público «Editar publicación» | Sigue siendo **solo para administradores**. Esa regla no se ha tocado |
| Futuro acceso de propietarios | Sin desarrollar: exigirá verificación de identidad y titularidad, aparte del agente |

## 5. CRM e incidencias — CREADOS Y FUNCIONANDO

- `lead` (potencial cliente) con estados DETECTED…OPT_OUT, `lead_contacto` (historial).
- Deduplicación real por **email, dominio y nombre+localidad**; y comprobación de si el negocio ya
  está publicado (si lo está, no se crea).
- `ticket` + `ticket_mensaje`, con estados OPEN, IN_PROGRESS, WAITING_FOR_USER, RESOLVED, CLOSED,
  código legible `HT-XXXXXXXX`, categoría, prioridad, responsable y resolución.
- `ia_campana` para borradores. **Ninguna campaña se envía automáticamente.**
- Comprobado: crear, consultar, cerrar, estado inválido rechazado, duplicado no creado.

## 6. Registro de acciones — EN PIE

- Cada acción del agente va a **`admin_auditoria`** (la traza que ya usaba la administración) con el
  prefijo `ia:`: acción, entidad, objeto y detalle con herramienta, argumentos acotados, resultado,
  error, modelo y coste.
- El consumo va aparte a **`ia_consumo`** (modelo, tokens, coste estimado).
- Nunca se guardan claves, contraseñas ni conversaciones completas.
- Se puede desactivar la auditoría? **No**: no existe ninguna herramienta ni opción para ello.

## 7. Variables de entorno y credenciales pendientes

| Variable | Estado |
|---|---|
| `IA_API_KEY` | **PENDIENTE** — es lo único que falta para que el agente converse |
| `IA_BASE_URL`, `IA_MODELO_*`, `IA_LIMITE_ENVIOS_DIA` | Opcionales, con valores por defecto razonables |
| Correo (`SMTP_*`) | Configurado y funcionando |
| Almacén (`R2_*`) | Configurado; las imágenes nuevas salen con caché de un año |
| Base de datos (`DB_*`) | Configurado; el usuario de la aplicación **no puede crear bases** (bien) |
| Google OAuth (`GOOGLE_CLIENT_ID/SECRET`) | Configurado; el acceso con Google no se ha probado de punta a punta |
| Dominio (SPF/DKIM/DMARC) | **Sin comprobar** — hace falta acceso al panel del dominio |

Los valores no se muestran nunca: solo si están puestos y, en el caso del modelo, si una llamada real
ha funcionado.

---

## Lo que NO está hecho, y no se ha simulado

1. Conversación real con el modelo (falta la clave).
2. Canal público de atención al cliente (hoy la consola es solo de administración).
3. Campañas comerciales reales (requieren base jurídica revisada y aprobación por lotes).
4. Comprobación de SPF, DKIM y DMARC.
5. Edición de publicaciones por parte del agente (no se va a hacer: exige titularidad acreditada).
