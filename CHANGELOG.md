# Registro de cambios — Hestiat

Cambios que afectan al comportamiento de la web, escritos para el equipo de producto y de soporte.
Cada entrada dice qué se ha corregido, por qué ocurría y qué debe esperar ahora quien use la web.

---

## 2026-10-10 · Reservas, catálogo y limpieza de datos de prueba

### 1. Solicitud de reserva: se ha eliminado un error del servidor

**Qué pasaba.** Si alguien enviaba una solicitud de reserva con un formato que la web no espera —por
ejemplo una petición automática con datos en otro formato, o un cuerpo cortado—, el servidor
respondía con un **error interno (500)**. Es decir: un fallo de aspecto técnico, sin mensaje, en la
página más importante del marketplace.

**Por qué ocurría.** La ruta leía el contenido de la solicitud **antes** de tenerlo protegido. Si esa
lectura no podía completarse, la excepción se escapaba y salía como error interno del servidor. La
falta de sesión **no** era la causa: la web permite reservar sin cuenta a propósito, y eso sigue
igual.

**Qué cambia para quien usa la web.**

- Una solicitud con formato inesperado recibe ahora una respuesta clara (código 400, «La solicitud no
  tiene el formato esperado»). Nunca más un error interno.
- Si falta el alojamiento o no es válido, la persona vuelve a la página de reserva con el aviso
  «Solicitud no válida», sin perder los datos que había escrito.
- **Sigue siendo posible reservar sin cuenta**, exactamente como antes.

**Qué debe saber soporte.** Ya no hay motivo para que una reserva termine en una página de error sin
explicación. Si alguien informa de un error al reservar, ahora verá siempre un mensaje concreto.

### 2. Listas del catálogo: el tipo de contenido ya no se confunde

**Qué pasaba.** El listado del catálogo (el que carga más fichas al bajar por la página) distinguía
experiencias y servicios por una palabra clave. Si esa palabra no coincidía **exactamente** con la
esperada, el sistema **devolvía experiencias sin avisar**: la respuesta parecía correcta, pero el
contenido era el equivocado. En la práctica, pedir «servicios» podía devolver «experiencias».

**Por qué ocurría.** Solo se reconocía el valor en inglés (`service`). Cualquier otro valor —incluido
el español `servicio`, que es el que usa nuestro propio panel— caía en el caso por defecto.

**Qué cambia para quien usa la web.**

- Se aceptan los valores en inglés y en español: `service`, `servicio`, `servicios` y `experience`,
  `experiencia`, `experiencias`. También sin distinguir mayúsculas.
- Un valor no reconocido devuelve ahora un **error claro (código 400)** con el mensaje «Tipo de
  catálogo no válido. Usa «experiencia» o «servicio»», en vez de datos equivocados con apariencia
  correcta.
- Sin indicar tipo, se sigue mostrando experiencias, como antes, para no romper nada.

**Qué debe saber soporte.** Si un listado muestra el contenido equivocado, ahora se detecta en el
acto: o sale el contenido correcto o sale un error explícito. Ya no hay término medio silencioso.

### 3. Limpieza de cuatro fichas de prueba en el catálogo de experiencias

**Qué se ha hecho.** Se han eliminado cuatro experiencias que eran residuos de pruebas:
`Prueba De Artista` (Arte, Madrid), `punto prueba` (Naturaleza, Chipiona), `Cueva de Prueba Valiente`
y `Fuente de Prueba Valiente` (Naturaleza, Segovia). El catálogo de experiencias pasa de 262.804 a
262.800 fichas.

**Comprobaciones previas.** Ninguna aparecía en el buscador público, ninguna estaba enlazada desde el
mapa del sitio y ninguna tenía referencias de usuarios ni de alojamientos. Se guardó una copia de
seguridad de las cuatro fichas y de sus tres filas de clasificación antes de borrarlas.

**Qué debe saber soporte.** Son fichas que nunca han sido visibles para el público. No hay nada que
explicar a nadie y no afecta a ningún anfitrión ni proveedor.

### 4. Pruebas automáticas añadidas

- **Unitarias** (sin servidor ni base de datos): la interpretación del tipo de catálogo y la
  validación de la solicitud de reserva. Se ejecutan con `npm run test:unit`.
- **De integración** (contra el servicio real, sin crear datos): 28 comprobaciones sobre reservas,
  catálogo, guardias de sesión y lecturas públicas. Se ejecutan con `node scripts/pruebas-api.mjs`.

### 5. Revisión del resto de la API: cuatro casos pendientes

Se han revisado los 38 puntos de la API pública buscando el mismo defecto. **Cuatro todavía
devuelven error interno (500) cuando reciben un cuerpo malformado sin sesión**:

| Punto | Qué es | Qué debe pasar cuando se corrija |
|---|---|---|
| `/api/auth/login` | Inicio de sesión | Negativa clara en vez de error interno |
| `/api/auth/registro` | Alta de cuenta | Negativa clara en vez de error interno |
| `/api/reclamar` | Reclamar la ficha de un alojamiento | Negativa clara en vez de error interno |
| `/api/host/reservas` | Reservas del panel de anfitrión | Negativa clara en vez de error interno |

**Todos los demás responden correctamente** (400, 401, 403 o redirección) y **ninguno escribe datos**
cuando la petición es inválida. Están detectados y a la espera de autorización para corregirlos.
