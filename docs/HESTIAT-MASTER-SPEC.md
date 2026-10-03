# HESTIAT-MASTER-SPEC.md

Especificación maestra de Hestiat 2.0. Documento vivo y autoritativo.
Versión 0.1 · 2026-10-03 · Fase: fundación (sin tocar producción)

---

## 1. Visión

Hestiat es un marketplace de alojamiento con carácter: rural, natural, singular y de experiencias. No es una web de alojamiento más, ni un clon de Airbnb o Booking. Es un producto tecnológico que hace que **descubrir dónde dormir** sea una experiencia agradable, honesta y rápida.

Frase que resume el producto: **«Encuentra dónde quedarte, sin sorpresas y sin comisiones.»**

El criterio de éxito no es que compile: es que funcionen de verdad los datos, las fotos, el mapa, la búsqueda, los anfitriones, la administración, los calendarios y las reservas, con seguridad validada y rendimiento correcto.

## 2. Principios de producto

1. **Simple antes que completo.** Menos campos, menos pasos, menos decisiones. Buscar → descubrir → ver → reservar.
2. **Honesto con los datos.** Precio real frente a orientativo, siempre etiquetado y con su fuente. Nunca valoraciones inventadas: sin reseñas se muestra «Nuevo», no un cero.
3. **Seguridad e integridad primero.** Antes que la velocidad de desarrollo. Ninguna operación destructiva sin copia verificada y vuelta atrás.
4. **Las imágenes son el producto.** Sin fotos no hay marketplace. El sistema de medios es infraestructura crítica, no un accesorio.
5. **Móvil primero.** El teléfono es el caso principal, no una adaptación.
6. **El mapa es ciudadano de primera.** Lista y mapa sincronizados en ambos sentidos.
7. **Rápido sin excusas.** El rendimiento no se negocia por efectos visuales.
8. **Todo lo importante se autoriza en el servidor.** El front nunca es la última línea de defensa.

## 3. Arquitectura

### 3.1 Decisión de stack

La versión anterior (React 19 + TanStack Start + Nitro sobre LiteSpeed/lsnode, despliegue por FTP) funcionaba, pero arrastró dos problemas estructurales: **canal de despliegue frágil** (FTP fichero a fichero, sin atomicidad, perdiendo ficheros grandes en silencio) y **medios hotlinkeados de terceros** (17.619 fotos apuntando a servidores ajenos).

Hestiat 2.0 mantiene el lenguaje y el ecosistema ya probado —TypeScript, React, SSR— porque es lo que permite reutilizar conocimiento y no partir de cero en la parte que ya funciona, y cambia lo que estaba mal:

| Capa | Hestiat 1.0 | Hestiat 2.0 |
|---|---|---|
| Aplicación | TanStack Start + Nitro | **Repositorio limpio, misma familia** (TypeScript + SSR), estructura modular por dominio |
| Despliegue | FTP fichero a fichero | **Repositorio → build → despliegue atómico verificado** con vuelta atrás |
| Medios | URLs externas de terceros | **R2 propio**: original + variantes + miniaturas, origen guardado como referencia |
| Datos | Esquema acumulado, cambios manuales | **Esquema nuevo + migraciones versionadas** y migración controlada desde el original |
| Secretos | `.env` (correcto) | Igual, más `ENVIRONMENT.md` y revisión de exposición |
| Autorización | En servidor (verificado) | Igual, con pruebas automáticas por rol |

### 3.2 Estructura del repositorio

```
hestiat2/
  docs/            documentación (esta especificación y compañía)
  db/migrations/   migraciones versionadas, numeradas y reversibles
  scripts/         migrador, verificadores, utilidades de operación
  src/             aplicación (se construye en la siguiente fase)
  .gitignore       nunca entra: .env, backups, dumps, credenciales, builds
```

Regla dura: **el repositorio se puede reconstruir desde cero y no contiene secretos.** Un `grep` de credenciales sobre el árbol debe salir limpio siempre.

### 3.3 Módulos (fronteras de dominio)

`auth` · `users` · `accommodations` · `media` · `search` · `map` · `availability` · `reservations` · `calendars` · `owners` · `admin` · `ai` · `ops`

Cada módulo expone una API propia y no llama a las tripas de otro. La lógica de negocio compartida vive en un módulo común, **una sola vez**: el fallo de tener dos sistemas de fotos duplicados (uno de admin y otro de propietarios) no se repite.

## 4. Sistema de diseño

Identidad propia, no plantilla. Principios y valores en `UI-UX.md` (documento de diseño ya aprobado en su dirección):

- **Paleta**: hueso `#FAF7F2` · oliva `#2F4A3C` · terracota `#C4552D` (reservado a la acción de reservar, una vez por pantalla) · apoyo `#F1EBE2` y `#6E655C`.
- **Tipografía**: serif de alto contraste para titulares, sans geométrica para interfaz, **cifras tabulares** en precios y capacidades.
- **Movimiento con propósito**: 120 ms micro, 240 ms entrada, 320 ms transición tarjeta→ficha, con `prefers-reduced-motion`.
- **Titular de portada**: «¿Dónde quieres despertar?»
- **Nada de**: morado, degradados decorativos, glassmorphism por defecto, aspecto de plantilla.

## 5. Modelo de datos

Esquema nuevo, limpio, con claves, índices, claves foráneas, restricciones y marcas de tiempo. `db/migrations/001_init.sql` contiene la base. Correspondencia con el original:

| Nuevo | Origen en `ppxgfdyc_hestiat` | Notas |
|---|---|---|
| `accommodation` | `alojamiento` (64 columnas) | Se normalizan servicios y características |
| `accommodation_photo` | `alojamiento_foto` | `storage_key` propio; `origin_url` guarda la fuente externa |
| `user` | `usuario` | + roles explícitos |
| `user_session` | `usuario_sesion` | |
| `reservation` | `reserva` (23 columnas) | Con estados de ciclo de vida |
| `review` | `resena` | + desglose por criterio y agregados |
| `calendar_feed` | `ical_feed` | Canales con aislamiento por alojamiento |
| `availability` | `disponibilidad` | |
| `audit_log` | `admin_auditoria` | |
| `service`, `experience` | `servicio`, `experiencia` | Fase posterior |

Decisiones: **ninguna valoración inventada**; el origen de cada dato de precio queda registrado; las fotos guardan su procedencia externa para trazabilidad legal.

## 6. API

Fronteras separadas por audiencia: **pública**, **usuario autenticado**, **anfitrión**, **administración**, **interna de operación**. Toda entrada validada, toda autorización comprobada en servidor, errores predecibles y **sin filtrar** trazas, SQL, rutas del sistema ni credenciales.

## 7. Seguridad

Prioridad uno. Controles: inyección SQL, XSS, CSRF, SSRF, IDOR, autorización por rol, aislamiento de propietarios, subida de ficheros, R2, sesiones, cookies, cabeceras, limitación de tasa, exposición de ficheros, variables de entorno, endpoints administrativos, registros y copias.

Reglas heredadas de los fallos reales de la versión anterior, ahora estructurales:

- Los **medios privados nunca van al bucket público**. La copia de seguridad expuesta el 2026-10-03 enseñó que el bucket `hestiat` sirve todos sus prefijos.
- Cero ficheros de diagnóstico accesibles por HTTP. Los que se usen, se retiran al terminar.
- Nada de `catch → null` que convierta un error interno en un falso fallo de autenticación.
- Ningún borrado sin analizar relaciones.

## 8. Medios (R2)

Un solo sistema para todos los roles: subida validada, variantes y miniaturas, orden, principal, borrado con comprobación de referencias, detección de huérfanos y limpieza con simulación previa, registro y auditoría.

Estructura: `accommodations/<id>/<hash>` con sufijos de variante, `avatars/`, y **`backups/` solo en un bucket privado aparte** —jamás en el público.

## 9. Calendarios, disponibilidad y reservas

iCal profesional: conexión, sincronización, desconexión, estado, errores, última sincronización y auditoría, con **aislamiento por alojamiento** (un canal roto no corrompe a otro; un anfitrión no ve calendarios ajenos). Reservas con prevención de doble reserva, concurrencia, estados, cancelaciones e historial, preparadas para pago.

## 10. SEO, accesibilidad y rendimiento

URLs limpias, metadatos, Open Graph, sitemap, canónicas y datos estructurados de alojamiento; foco visible, contraste AA, formularios etiquetados y alternativa de teclado al mapa; Core Web Vitals, imágenes optimizadas, consultas indexadas, caché y carga diferida. **La portada no debe depender de un vídeo para su elemento principal.**

## 11. Despliegue y operación

Pipeline: fuente → build → pruebas → comprobación de seguridad → comprobación de base de datos → despliegue → comprobación de salud → prueba de humo → confirmación. Si falla, vuelta atrás.

Herramientas ya construidas y probadas que se incorporan al flujo: **despliegue atómico** (ZIP por HTTP, verificación previa, dos renombrados, reinicio del pool, verificación posterior) y **verificación de coherencia** (manifiesto → índice → existe → 200).

Estado de copias y verificación: ver `HESTIAT-OPERATIONS.md`.

## 12. Pruebas

Autenticación, autorización, CRUD de alojamientos, fotografías, R2, reservas, iCal, usuarios, administración, búsqueda, filtros, mapa y APIs. **Con casos negativos**: el anfitrión A nunca accede a lo del anfitrión B. Una función no está terminada hasta que está probada en real.

## 13. IA

Preparada para Hestiat IA: descubrir, responder, recomendar, explicar, ayudar en la reserva y al anfitrión. Siempre por APIs con permisos controlados. **Nunca acceso ilimitado al servidor.**

## 14. Documentación exigida

`README.md`, `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `DEPLOYMENT.md`, `MIGRATION.md`, `OPERATIONS.md`, `TESTING.md`, `ENVIRONMENT.md` y este `HESTIAT-MASTER-SPEC.md`.

## 15. Estado actual y límites

- Esta fase **no toca producción**: repositorio, arquitectura, esquema y documentación.
- **Bloqueos externos** que impiden avanzar en el servidor: IP del entorno de trabajo bloqueada por el cortafuegos, ausencia de base de datos con permisos para la verificación, y falta de un bucket privado para copias. Detalle y procedimiento en `HESTIAT-OPERATIONS.md`.
- **El borrado del código anterior no se ejecuta** hasta que la copia de datos esté verificada por restauración, según la regla del propio mandato.
