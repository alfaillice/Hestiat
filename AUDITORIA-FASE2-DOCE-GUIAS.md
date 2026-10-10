# Auditoría editorial y SEO de las doce guías en revisión

**Nada se ha publicado ni modificado.** Las doce siguen en `en_revision`, devuelven 404 y están fuera del sitemap. Rama `nueva-web`. Auditoría hecha el 9 de octubre de 2026 contra el catálogo real y contra producción.

## Cómo se ha auditado

No he revisado los textos «a ojo». Para cada guía he vuelto a leer el cuerpo guardado y he comprobado contra la base de datos: cada recuento, cada desglose por tipo de alojamiento, cada categoría de experiencia y de servicio, cada distancia de zona citada, cada enlace (169) y la estructura de la página publicada.

```
Datos que han pasado la comprobación:
· 11 de las 12 guías: todas sus cifras y desgloses coinciden con el catálogo
· 11 guías citan zonas: todas las distancias coinciden con las coordenadas reales del catálogo (0 desviaciones)
· 169 enlaces internos: todos responden 200 y todos llevan a fichas publicadas o activas de la ciudad correcta
· Títulos y resúmenes: 15 de 15 distintos · ninguno supera los 160 caracteres
· Idioma de la página: <html lang="es">, correcto
· Canonical propio y datos estructurados Article + BreadcrumbList en las publicadas
· Imagen de referencia presente donde existe, con su etiqueta «no es una fotografía del establecimiento» y su procedencia enlazada
```

## Tabla resumen

| Ciudad | Nota | Problemas encontrados | Cambios recomendados | Decisión |
|---|---|---|---|---|
| Barcelona | 8/10 | Dos enlaces de servicios sin nombre (56 - Portal de Santa Madrona y we bike rent): la URL aparece sola, sin texto que la explique. | Añadir el nombre delante de cada uno, como en el resto de la guía. | **APTA CON CAMBIOS** |
| Málaga | 9/10 | Ninguno de contenido. Datos, distancias y enlaces verificados. Sin fotografía, correctamente y sin sustituto. | Ninguna obligatoria. | **APTA** |
| Sevilla | 7/10 | Dos enlaces de servicios sin nombre. Una frase confusa e imprecisa: «la cifra más alta de las tres ciudades andaluzas de esta fase después de Córdoba en proporción», que no se entiende y no es correcta. | Nombrar los dos servicios y reescribir esa frase (por ejemplo: «es la ciudad andaluza de esta fase con más fichas completas, 18»). | **APTA CON CAMBIOS** |
| Córdoba | 8/10 | Ninguno de contenido. El título («sin zonas inventadas») es correcto pero suena a justificación interna más que a título para una persona. | Sugerencia: cambiar el título por uno orientado a la decisión del viajero. Opcional. | **APTA** |
| Burgos | 9/10 | Ninguno. Se presenta con transparencia que dos de las cuatro experiencias enlazadas son negocios de bienestar y no visitas. «Rabé de las Calzadas es una localidad del camino» es una afirmación general, no un dato del catálogo. | Sugerencia: marcar esa frase como contexto general. Opcional. | **APTA** |
| Bilbao | 9/10 | Ninguno de contenido. Distancias y cifras verificadas. | Ninguna obligatoria. | **APTA** |
| Santander | 8/10 | Una comparación imprecisa: «es la proporción más baja de esta fase junto con Córdoba». A Coruña tiene 1 ficha completa de 43, proporción casi idéntica a la de Santander (2 de 83). | Reescribir la comparación con las tres cifras o suprimirla. | **APTA CON CAMBIOS** |
| Salamanca | 5/10 | Grave: el bloque de datos usa el recuento SIN filtrar por provincia, así que da 93 alojamientos cuando son 84, 37 hoteles cuando son 30 y 15 apartamentos cuando son 14. Y dos afirmaciones falsas: dice que es la ciudad con menos experiencias (Benidorm tiene 32 frente a 36) y con menos servicios (València tiene 0). | Sustituir el bloque de datos por las cifras filtradas por provincia y corregir o eliminar las dos comparaciones. Es la única guía con datos incorrectos. | **APTA CON CAMBIOS** |
| València | 9/10 | Ninguno de contenido. Dice expresamente que no hay servicios publicados, sin rellenar la sección. El título contiene una afirmación negativa que puede quedar desfasada si el catálogo cambia. | Sugerencia: vigilar el título cuando cambien los datos. Opcional. | **APTA** |
| Zaragoza | 8/10 | El título lleva dos cifras («95 experiencias y solo 31 alojamientos») que quedarán obsoletas en cuanto cambie el catálogo, y el resumen dice «tres veces más», que depende de las mismas cifras. | Cambiar el título por uno sin cifras y reformular el resumen para que no dependa de números exactos. | **APTA CON CAMBIOS** |
| Benidorm | 9/10 | Ninguno de contenido. Se explica con transparencia que la primera categoría del catálogo es bienestar y que eso no es una lista de visitas turísticas. | Ninguna obligatoria. | **APTA** |
| A Coruña | 9/10 | Ninguno de contenido. Cifras, distancias y enlaces verificados. 1 ficha completa de 43, dicho con claridad. | Ninguna obligatoria. | **APTA** |

**Resumen: 7 APTA · 5 APTA CON CAMBIOS · 0 NO APTA TODAVÍA** (media 8,2 sobre 10). Las cinco con cambios son Barcelona, Sevilla, Santander, Salamanca y Zaragoza; Salamanca es la única con datos incorrectos.

Dos hallazgos merecen atención antes de nada:

1. **Salamanca es la única con datos incorrectos.** Al medirla usé el recuento por localidad sin filtrar por provincia, y ese recuento incluye las fichas de un distrito de Madrid que se llama igual. Los enlaces sí están filtrados y son correctos, pero el bloque de datos del texto no: dice 93 alojamientos donde hay 84, 37 hoteles donde hay 30 y 15 apartamentos donde hay 14, y le faltan dos tipos que sí existen (Apartahotel 1 y Parador 1). Además, dos comparaciones son falsas. Es corregible en un momento.
2. **Los encabezados del cuerpo no son encabezados.** En la página publicada hay un `<h1>` y **cero `<h2>`**: todos los títulos de sección del cuerpo («QUÉ HAY PUBLICADO…», «CÓMO ELEGIR ZONA…») son texto normal. Para una persona se lee bien, pero para un buscador y para un lector de pantalla la estructura no existe. Es un cambio de código y de contenido, y afecta a las doce por igual.

## Problemas técnicos que afectan a las doce (no son de contenido)

```
1. Sin encabezados <h2> en el cuerpo                     → convertir los títulos de sección en encabezados reales
2. datePublished en formato no estándar                  → el JSON-LD publica «2026-10-09 19:31:12»; schema.org espera ISO 8601
3. El Article no declara imagen                          → se puede añadir la imagen de referencia cuando exista
4. Las ciudades no enlazan a su guía                     → /destino/barcelona no menciona /guia/barcelona; conviene enlazarlas
5. Posible solapamiento guía / página de ciudad          → la guía decide («dónde alojarme»), la página de ciudad lista el catálogo; con el enlace cruzado y títulos distintos queda claro
6. Bloque de fuentes y método idéntico en las doce       → es deliberado (transparencia), pero conviene saberlo: 2 frases se repiten literalmente en las 12
```

## Detalle por guía

### Barcelona — 8/10 — APTA CON CAMBIOS
- **Problema**: Dos enlaces de servicios sin nombre (56 - Portal de Santa Madrona y we bike rent): la URL aparece sola, sin texto que la explique.
- **Cambio recomendado**: Añadir el nombre delante de cada uno, como en el resto de la guía.

### Málaga — 9/10 — APTA
- **Problema**: Ninguno de contenido. Datos, distancias y enlaces verificados. Sin fotografía, correctamente y sin sustituto.
- **Cambio recomendado**: Ninguna obligatoria.

### Sevilla — 7/10 — APTA CON CAMBIOS
- **Problema**: Dos enlaces de servicios sin nombre. Una frase confusa e imprecisa: «la cifra más alta de las tres ciudades andaluzas de esta fase después de Córdoba en proporción», que no se entiende y no es correcta.
- **Cambio recomendado**: Nombrar los dos servicios y reescribir esa frase (por ejemplo: «es la ciudad andaluza de esta fase con más fichas completas, 18»).

### Córdoba — 8/10 — APTA
- **Problema**: Ninguno de contenido. El título («sin zonas inventadas») es correcto pero suena a justificación interna más que a título para una persona.
- **Cambio recomendado**: Sugerencia: cambiar el título por uno orientado a la decisión del viajero. Opcional.

### Burgos — 9/10 — APTA
- **Problema**: Ninguno. Se presenta con transparencia que dos de las cuatro experiencias enlazadas son negocios de bienestar y no visitas. «Rabé de las Calzadas es una localidad del camino» es una afirmación general, no un dato del catálogo.
- **Cambio recomendado**: Sugerencia: marcar esa frase como contexto general. Opcional.

### Bilbao — 9/10 — APTA
- **Problema**: Ninguno de contenido. Distancias y cifras verificadas.
- **Cambio recomendado**: Ninguna obligatoria.

### Santander — 8/10 — APTA CON CAMBIOS
- **Problema**: Una comparación imprecisa: «es la proporción más baja de esta fase junto con Córdoba». A Coruña tiene 1 ficha completa de 43, proporción casi idéntica a la de Santander (2 de 83).
- **Cambio recomendado**: Reescribir la comparación con las tres cifras o suprimirla.

### Salamanca — 5/10 — APTA CON CAMBIOS
- **Problema**: Grave: el bloque de datos usa el recuento SIN filtrar por provincia, así que da 93 alojamientos cuando son 84, 37 hoteles cuando son 30 y 15 apartamentos cuando son 14. Y dos afirmaciones falsas: dice que es la ciudad con menos experiencias (Benidorm tiene 32 frente a 36) y con menos servicios (València tiene 0).
- **Cambio recomendado**: Sustituir el bloque de datos por las cifras filtradas por provincia y corregir o eliminar las dos comparaciones. Es la única guía con datos incorrectos.

### València — 9/10 — APTA
- **Problema**: Ninguno de contenido. Dice expresamente que no hay servicios publicados, sin rellenar la sección. El título contiene una afirmación negativa que puede quedar desfasada si el catálogo cambia.
- **Cambio recomendado**: Sugerencia: vigilar el título cuando cambien los datos. Opcional.

### Zaragoza — 8/10 — APTA CON CAMBIOS
- **Problema**: El título lleva dos cifras («95 experiencias y solo 31 alojamientos») que quedarán obsoletas en cuanto cambie el catálogo, y el resumen dice «tres veces más», que depende de las mismas cifras.
- **Cambio recomendado**: Cambiar el título por uno sin cifras y reformular el resumen para que no dependa de números exactos.

### Benidorm — 9/10 — APTA
- **Problema**: Ninguno de contenido. Se explica con transparencia que la primera categoría del catálogo es bienestar y que eso no es una lista de visitas turísticas.
- **Cambio recomendado**: Ninguna obligatoria.

### A Coruña — 9/10 — APTA
- **Problema**: Ninguno de contenido. Cifras, distancias y enlaces verificados. 1 ficha completa de 43, dicho con claridad.
- **Cambio recomendado**: Ninguna obligatoria.

## Lo que NO se ha hecho

- No se ha publicado ninguna guía ni se ha cambiado su estado.
- No se ha modificado ningún texto todavía: los cambios propuestos esperan tu aprobación.
- No se ha tocado código, catálogo, precios, reservas ni otras funciones.
- No se ha creado ninguna página de categorías.

## Lo que no afirmo

**No digo que Google haya indexado nada.** Tres guías están publicadas y declaradas en el sitemap, y doce están en revisión y fuera de él. La indexación real solo se comprueba en Search Console, y ahí no he mirado.
