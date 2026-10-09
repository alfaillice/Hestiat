# Hestiat AI Manager — arquitectura y guía de puesta en marcha

Fase 4 del proyecto Hestiat 2.0. Rama `nueva-web` → https://hestiat.com

---

## 1. Qué es

Un agente operativo (no un chatbot decorativo) que trabaja con **herramientas controladas sobre las
APIs y los datos que Hestiat ya tenía**: no escribe SQL, no toca credenciales y no puede modificar
ni borrar publicaciones. Cada acción que hace queda registrada.

Cubre cinco papeles: marketing/CRM, atención al cliente, asistente de propietarios y proveedores,
gestión del CRM y asistente de operaciones.

---

## 2. Piezas (y dónde están)

| Pieza | Fichero | Qué hace |
|---|---|---|
| Núcleo de IA | `lib/ia.server.ts` | Habla con el modelo, ejecuta el bucle de herramientas, gestiona contexto, errores, límites y coste. |
| Herramientas | `lib/ia-herramientas.server.ts` | Las 16 herramientas con esquema, nivel de autonomía, validación y auditoría. |
| Datos | `lib/ia-datos.server.ts` | Todo el acceso a datos, parametrizado. El modelo nunca ve SQL. |
| Auditoría y límites | `lib/ia-auditoria.server.ts` | Registro en `admin_auditoria`, consumo en `ia_consumo`, límites por hora y por gasto. |
| Conocimiento | `lib/conocimiento.ts` | FAQ y artículos reales de Hestiat (misma fuente que la web pública). |
| Correo | `lib/ia-correo.server.ts` | Borradores, aprobación humana, exclusiones, rebotes. Envía por el mismo correo que las reservas. |
| API | `app/api/admin/ia/route.ts` | Una sola puerta, cerrada a administración (403 sin sesión). |
| Consola | `app/admin/ia/page.tsx` + `components/ia-consola.tsx` | Estado, herramientas, actividad, coste, pendientes y chat. |
| Esquema | `scripts/ia-esquema.sql` | 10 tablas nuevas (solo se añaden). |

### Por qué el protocolo compatible con OpenAI

Se usa `/chat/completions` con llamadas a funciones y `IA_BASE_URL` configurable. Es la opción **menos
acoplada**: sirve para OpenAI, Azure y cualquier proveedor o servidor propio que hable ese protocolo.
La API «Responses» de OpenAI es específica de ese proveedor; atarse a ella habría atado toda la
aplicación. Cambiar de proveedor es cambiar dos variables de entorno.

**Modelos**: uno económico para lo rutinario (por defecto) y uno potente a petición expresa.

---

## 3. Lo que tiene que aportar el administrador

Hoy **no hay ninguna clave configurada**, así que el agente todavía no puede conversar. Es lo único
que falta para que funcione. En `/opt/hestiat/shared/.env` (permisos `640 root:hestiat`):

```
IA_API_KEY=...                      # la clave del proveedor (obligatoria)
IA_BASE_URL=https://api.openai.com/v1   # opcional (por defecto, OpenAI)
IA_PROVEEDOR=OpenAI                 # etiqueta para la consola, opcional
IA_MODELO_ECONOMICO=gpt-4.1-mini    # opcional
IA_MODELO_POTENTE=gpt-4.1           # opcional
IA_LIMITE_ENVIOS_DIA=20             # opcional: tope de correos comerciales al día
IA_TIEMPO_MAXIMO_MS=60000           # opcional
```

Después: `systemctl restart hestiat` y pulsar **«Probar conexión»** en la consola. La consola no da
la integración por buena hasta que esa prueba (una llamada real) ha funcionado; y nunca muestra la
clave.

**Límites por defecto** (editables desde la consola): 120 llamadas/hora y 5 USD/día. Superados, el
agente deja de llamar al modelo y lo dice: no sigue gastando.

**Coste**: el gasto se estima con una tabla de precios de referencia por modelo
(`IA_PRECIO_<MODELO>_ENTRADA` / `_SALIDA` para ajustarla). Es una estimación: el consumo real lo fija
el proveedor.

---

## 4. Herramientas (16)

Lectura (nivel 1): `search_publications`, `get_publication`, `search_public_faq`,
`get_help_article`, `search_leads`, `get_lead`, `get_campaign_stats`, `get_email_status`,
`check_email_exclusion`, `get_support_ticket`.

Ejecución (nivel 3): `create_lead`, `update_lead`, `add_email_exclusion`, `create_support_ticket`,
`update_support_ticket`, `draft_outreach_email` (esta última es **sensible**: exige autorización
explícita).

**No existe ninguna herramienta capaz de modificar o eliminar una publicación**, ni de ejecutar SQL.
Es por diseño: el botón público «Editar publicación» sigue siendo solo para administradores y esa
regla no se toca.

---

## 5. Niveles de autonomía

| Nivel | Permite | Cómo se pone |
|---|---|---|
| 1 | Solo lectura | `ia_config.nivel_autonomia = 1` |
| 2 | Leer y preparar (borradores, propuestas), sin ejecutar | `= 2` |
| 3 | Ejecutar lo autorizado por las políticas | `= 3` (por defecto) |

Con nivel 3, las acciones **sensibles** siguen exigiendo confirmación explícita y queda registrado
quién la dio. Ningún envío comercial sale sin aprobación humana
(`ia_config.envios_requieren_aprobacion = 1`).

Lo que el agente no puede hacer nunca: SQL libre, leer secretos, cambiar sus permisos, desactivar la
auditoría, saltarse la autenticación, borrar en masa, enviar campañas sin aprobación, ni modificar
publicaciones.

**Inyección de instrucciones**: el contenido de correos, webs y resultados de herramientas se trata
como DATOS. Las instrucciones del sistema lo dicen expresamente y el agente debe avisar si detecta
un intento de manipulación.

---

## 6. Auditoría

Cada acción del agente se registra en **`admin_auditoria`** (la traza que ya usaba la administración,
para no tener dos historiales), con el prefijo `ia:`: acción, entidad, objeto, y en el detalle la
herramienta, los argumentos acotados, el resultado, el error si lo hubo, el modelo y el coste.
El consumo se guarda aparte en **`ia_consumo`** (modelo, tokens, coste estimado).

Nunca se guardan claves, contraseñas, cuerpos enteros de correo ni conversaciones completas en el
detalle de auditoría.

---

## 7. Pruebas ejecutadas (reales, contra producción)

`scripts/pruebas-ia.sh` y `scripts/pruebas-ia-errores.sh` / `scripts/pruebas-ia-detalle.sh`.

| Caso | Resultado |
|---|---|
| Sin sesión / anfitrión (no admin) | **403** en ambos |
| Administrador | 200 · 16 herramientas · niveles 1 y 3 |
| Herramienta inexistente (`update_publication`, `query_sql`) | rechazada, «No existe la herramienta» |
| Publicaciones ajenas | no existe herramienta que las modifique |
| Argumentos inválidos (falta campo, enum, campo de más) | rechazados los tres |
| CRM: alta, duplicado, cambio, estado inventado | creado · no duplica · actualizado · rechazado |
| Exclusión de correo | se niega a redactar para una dirección dada de baja |
| Acción sensible sin autorización | rechazada; con autorización, queda **pendiente de aprobación** |
| Tickets: crear, consultar, cerrar, estado inválido | funciona · estado inválido rechazado |
| Sin credenciales del modelo | bloqueo claro y documentado (**no simula**) |
| Credencial rechazada por el proveedor real | detectada (401 del proveedor) |
| Proveedor inalcanzable | detectado |
| Respuesta inválida del proveedor | detectada y registrada |
| Correo comercial | **no se envió ninguno**: solo se probó que se niega |
| Límite de peticiones | 70 seguidas → 42×200 y 28×429 |
| Auditoría | acciones registradas y consultables |
| Limpieza | todo lo creado por las pruebas, borrado; base igual que antes |

---

## 8. Lo que falta para la siguiente fase

1. **Poner la clave** del modelo y probar la conversación completa (es lo único que bloquea hoy).
2. Abrir un canal público de atención al cliente (hoy la consola es solo para administración).
3. Envío real de campañas **con base jurídica revisada** y despliegue por lotes con aprobación.
4. Comprobación de SPF, DKIM y DMARC (requiere acceso al panel del dominio).
5. Migrar los límites en memoria a un almacén compartido si algún día hay varios procesos.
