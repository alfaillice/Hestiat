# Entrega: tres borradores piloto de guías de destino

**Estado: en revisión. No publicados. No visibles al público. No incluidos en el sitemap.**
Fecha de la medición de datos: 9 de octubre de 2026. Rama de trabajo: `nueva-web` (sin cambios de código).

---

## 1. Qué se entrega

Tres guías redactadas y guardadas en la tabla `guia` con estado **`en_revision`**:

| slug | Título | Resumen (car.) | Cuerpo (car.) | Enlaces internos |
|---|---|---|---|---|
| `madrid` | Qué mirar antes de alojarse en Madrid: zonas, tipos y fichas reales | 144 | 7.511 | 17 |
| `granada` | Dónde alojarse en Granada: oferta pequeña, qué significa al reservar | 132 | 6.237 | 17 |
| `santiago-de-compostela` | Albergue, hostal o hotel en Santiago de Compostela: cómo decidir | 144 | 5.782 | 11 |

Los tres resúmenes están por debajo de 160 caracteres, que es el límite que usa la propia plantilla
para la metadescripción: no se cortan a mitad.

**Cada guía tiene un ángulo distinto, no una plantilla repetida:**
- **Madrid** se centra en **elegir zona** (18 entradas de localidad con distancia real medida) y en el reparto por tipo (hotel + hostal = 82% de la oferta publicada).
- **Granada** se centra en que **la oferta es de formato pequeño** (148 de 199 fichas son hotel, hostal, casa de invitados o pensión) y en que **el catálogo no tiene entradas de barrio** en esta ciudad, solo municipios del entorno.
- **Santiago** se centra en **albergue, hostal o hotel** (18 albergues de 108 fichas, la proporción más alta de las tres) y en sus zonas internas reales (O Ensanche, Vite, As Fontiñas).

## 2. Estado y visibilidad (comprobado ahora mismo, no supuesto)

```
/guia/madrid                      → 404
/guia/granada                     → 404
/guia/santiago-de-compostela      → 404
apariciones de "/guia/" en los 5 sitemaps → 0
paginas.xml declara                → 23 URLs (las mismas que antes: no ha cambiado)
filas en la tabla guia             → 3, todas en_revision  (0 publicadas)
/guia (índice público)             → 200, y por código solo lista estado='publicada'
```

## 3. Fuente de cada afirmación

| Afirmación en las guías | Fuente |
|---|---|
| Nº de alojamientos publicados y reparto por tipo (637/199/108 y sus tipos) | Consulta directa a `accommodation` con `status='published'` y `city` = la ciudad, agrupada por `type`. 9-oct-2026 |
| Nº de experiencias activas y reparto por categoría (413/72/17) | Consulta directa a `experiencia` con `is_active=1` y `municipality` = la ciudad, agrupada por `category`. 9-oct-2026 |
| Nº de servicios activos y reparto por categoría (79/89/0) | Consulta directa a `servicio_turistico` con `is_active=1` y `municipality` = la ciudad. 9-oct-2026 |
| "57 / 15 / 9 fichas cumplen el criterio de ficha completa" | El mismo criterio que usa la web para indexar (coordenadas + foto propia o precio + 3 o más servicios declarados), aplicado a esas ciudades |
| Distancias en km y zonas | `ST_Distance_Sphere` sobre las coordenadas de las propias fichas del catálogo, entre el centro de las fichas de la ciudad y el centro de las fichas de esa entrada de localidad |
| Cada ficha enlazada (nombre y dirección) | La propia fila del catálogo (nombre/título real) y su URL, comprobada ese día con código HTTP 200 |
| "sin sorpresas y sin comisiones" | La descripción con la que Hestiat se presenta en su propia web |
| "si una ficha no tiene foto propia se muestra una imagen de referencia de la localidad, marcada como tal" | Comportamiento actual del catálogo: tabla `localidad_imagen` y la etiqueta "Imagen de referencia" de las tarjetas |
| Nº de experiencias con valoración (0) y de alojamientos con foto propia (145 en todo el país) | Consulta directa. Es la razón de que las guías no ordenen por nota y de que no se prometa foto propia |

**Lo que NO se ha escrito, porque no está comprobado:** cifras de demanda, visitantes u ocupación;
precios; horarios; temporadas; aforos; distancias a pie entre sitios; valoraciones; y cualquier
característica de un negocio que no esté en su ficha. Las guías lo dicen expresamente.

## 4. Comprobaciones realizadas

```
[OK] 42 enlaces internos de las tres guías comprobados uno a uno contra producción → 42 de 42 con 200
[OK] Slugs resueltos consultando la base de datos por nombre exacto: ninguno inventado
[OK] Los tres borradores devuelven 404 al público (la ruta exige estado='publicada')
[OK] Ninguno de los tres aparece en los 5 sitemaps; paginas.xml sigue declarando 23 URLs
[OK] Títulos propios y distintos (64-68 caracteres), sin duplicar ninguno
[OK] Metadescripciones propias (132-144 caracteres), por debajo del corte de 160
[OK] Los cuerpos no contienen restos de marcado (0 asteriscos, 0 almohadillas, 0 enlaces markdown)
[OK] Canonical: la plantilla emite /guia/<slug> para cada guía (verificado por código; se sirve al publicar)
[OK] Datos estructurados: la plantilla emite BreadcrumbList + Article (verificado por código; se sirve al publicar)
[--] Los dos puntos anteriores NO se pueden comprobar en vivo mientras estén en revisión, porque
     estas páginas responden 404 a propósito. Se comprobarán al publicarlas, si las apruebas.
[--] No se ha comprobado nada en Search Console (índice, cobertura, CWV de campo): no es visible desde aquí
```

## 5. Correcciones respecto a la propuesta que aprobaste (importantes)

1. **Los recuentos de la propuesta eran de fichas publicadas, no de fichas indexables.** Lo etiqueté mal.
   Lo correcto, medido hoy: Madrid tiene **637 alojamientos publicados** (de ellos 57 cumplen el criterio
   completo), Granada **199** (de ellos 15), Santiago **108** (de ellos 9). Las guías citan ahora las dos
   cifras y explican la diferencia, en vez de dar solo la grande.
2. **Ninguna experiencia del catálogo tiene valoración** (0). Por eso ninguna guía ordena por nota, y lo
   dicen explícitamente. La propuesta insinuaba un orden por valoración que no era posible.
3. **Solo 145 fichas de alojamiento de todo el país tienen foto propia.** Por eso las guías no destacan
   fotos y no se ha usado ninguna imagen en el cuerpo.
4. **Granada no tiene entradas de barrio en el catálogo**: lo que aparecía eran municipios del entorno
   (Armilla, Huétel Vega, La Zubia, Monachil, Atarfe, Santa Fe, Cumbres Verdes). La guía lo explica así.
5. **Ojo con la entrada "Salamanca"** del catálogo: sus fichas están en la provincia de Madrid, es un
   distrito de Madrid, no la ciudad de Salamanca. No se ha usado en la guía de Madrid, y se tendrá en
   cuenta antes de escribir la guía de Salamanca.
6. **Discrepancia menor de una ficha en Santiago**: la tabla precalculada que usa la web dice 18
   experiencias y la medición directa da 17. La guía cita 17 y lo advierte en el propio texto.

## 6. Dos cosas que necesitan un cambio pequeño de código (no las he hecho, esperan tu autorización)

Tu punto 5 (usar la imagen de referencia de la ciudad cuando existe) **no se puede cumplir hoy**:
la plantilla de guía no muestra ninguna imagen, solo título, resumen, cuerpo y el pie de revisión.

Y los enlaces del cuerpo se sirven como texto, así que se leen como direcciones y no son clicables
(aunque el pie de página sí añade solo un enlace automático a `/destino/<ciudad>`).

**Sin esos dos cambios, las guías funcionan y son útiles, pero no enseñan cabecera y los enlaces no
se pueden pulsar.** Si me autorizas, el cambio sería: renderizar la imagen de `localidad_imagen` (con su
etiqueta de "imagen de referencia") en la cabecera de la guía, y convertir las direcciones del cuerpo en
enlaces. Son dos cambios localizados en `app/guia/[slug]/page.tsx` y nada más. No los toco sin tu OK.

**Imágenes disponibles para cuando decidas:** Madrid y Granada sí tienen imagen de referencia en el
catálogo (procedencia: Wikipedia, se cita en cada caso). **Santiago no la tiene**, así que su guía iría
sin fotografía, tal como pediste, y no se generará ninguna imagen que pueda parecer real.

## 7. Qué NO se ha hecho

- No se ha escrito ninguna de las otras doce guías.
- No se ha publicado nada ni se ha añadido nada al sitemap.
- No se ha creado ninguna página de categoría.
- No se ha tocado el catálogo, ni precios, ni publicaciones, ni reservas.
- No se ha cambiado código ni configuración de producción.
- No se ha generado ninguna imagen.

## 8. Cómo se publicaría, cuando lo apruebes

Por cada guía: cambiar `estado` a `publicada` y rellenar `revisor`, `revisado_en` y `publicado_en`.
Con eso, la página deja de dar 404, pide indexación, entra en el sitemap de guías y el pie de página
muestra quién la revisó. Nada más. Si quieres, lo hago yo guía por guía cuando me digas.

## 9. Los enlaces comprobados (todos con 200 el 9 de octubre de 2026)

**Madrid — alojamiento (6 fichas)**
- [Apartamentos Recoletos](https://hestiat.com/alojamiento/apartamentos-recoletos-node3826680862)
- [Hostal Don Pedro](https://hestiat.com/alojamiento/hostal-don-pedro-node1437313178)
- [Hostal Siesta & Go Nuevos Ministerios](https://hestiat.com/alojamiento/hostal-siesta-go-nuevos-ministerios-node6861422022)
- [Radisson Blu Hotel, Madrid Prado](https://hestiat.com/alojamiento/radisson-blu-hotel-madrid-prado-node2552492976)
- [Shibari by Justine Apartments](https://hestiat.com/alojamiento/shibari-by-justine-apartments-node9019247694)
- [ibis Madrid Centro las Ventas](https://hestiat.com/alojamiento/ibis-madrid-centro-las-ventas-node2149714696)

**Madrid — experiencias (6 fichas)**
- [Andén Cero - Estación de Chamberí](https://hestiat.com/experiencias/anden-cero-estacion-de-chamberi-936505939)
- [Casa Museo del Ratón Pérez](https://hestiat.com/experiencias/casa-museo-del-raton-perez-2449728815)
- [Museo ABC](https://hestiat.com/experiencias/museo-abc-2669198766)
- [Museo Arqueológico Nacional](https://hestiat.com/experiencias/museo-arqueologico-nacional-255288522)
- [Museo de Arte Contemporáneo](https://hestiat.com/experiencias/museo-de-arte-contemporaneo-4173744335)
- [Museo de Cera](https://hestiat.com/experiencias/museo-de-cera-4213142633)

**Madrid — servicios (4 fichas)**
- [Barquillo Yoga](https://hestiat.com/servicios/barquillo-yoga-12424954938)
- [Fit Club Madrid](https://hestiat.com/servicios/fit-club-madrid-4703521772)
- [Speed Queen](https://hestiat.com/servicios/speed-queen-14079327601)
- [Tinte y Planchado Americano](https://hestiat.com/servicios/tinte-y-planchado-americano-13810921384)

**Granada — alojamiento (6 fichas)**
- [Apartamentos Turísticos Carmen de Ramilla](https://hestiat.com/alojamiento/apartamentos-turisticos-carmen-de-ramilla-node5407385121)
- [Be Suites Centro](https://hestiat.com/alojamiento/be-suites-centro-node8701081092)
- [Hostal Atenas](https://hestiat.com/alojamiento/hostal-atenas-node5816279043)
- [Hostal Costa Azul](https://hestiat.com/alojamiento/hostal-costa-azul-node8704905188)
- [Hotel Alixares](https://hestiat.com/alojamiento/hotel-alixares-way862446377)
- [Sercotel HMO Martina](https://hestiat.com/alojamiento/sercotel-hmo-martina-node13464010499)

**Granada — experiencias (6 fichas)**
- [Aljibe de San Miguel](https://hestiat.com/experiencias/aljibe-de-san-miguel-4368828494)
- [Centro de Exposiciones CajaGranada-Puerta Real](https://hestiat.com/experiencias/centro-de-exposiciones-cajagranada-puerta-real-6019478061)
- [Cerámica Los Arrayanes](https://hestiat.com/experiencias/ceramica-los-arrayanes-5892816686)
- [Museo Cuevas del Sacromonte](https://hestiat.com/experiencias/museo-cuevas-del-sacromonte-2816220886)
- [Palacio de los Olvidados](https://hestiat.com/experiencias/palacio-de-los-olvidados-4932003408)
- [Sol y Agua Spa](https://hestiat.com/experiencias/sol-y-agua-spa-5918692786)

**Granada — servicios (4 fichas)**
- [Club Ortiz](https://hestiat.com/servicios/club-ortiz-9563213153)
- [Lavo tu Ropa](https://hestiat.com/servicios/lavo-tu-ropa-5256286622)
- [Nature Yoga](https://hestiat.com/servicios/nature-yoga-13742133517)
- [Speed Queen](https://hestiat.com/servicios/speed-queen-5766363754)

**Santiago de Compostela — alojamiento (6 fichas)**
- [A Tafona do Peregrino](https://hestiat.com/alojamiento/a-tafona-do-peregrino-node766499552)
- [Albergue The Last Stamp](https://hestiat.com/alojamiento/albergue-the-last-stamp-node2553661633)
- [Albergue do Seminario Menor da Asunción](https://hestiat.com/alojamiento/albergue-do-seminario-menor-da-asuncion-node766498721)
- [Capitol Boutique Hotel](https://hestiat.com/alojamiento/capitol-boutique-hotel-way1126783839)
- [La Credencial](https://hestiat.com/alojamiento/la-credencial-node11858960603)
- [Meiga Backpackers](https://hestiat.com/alojamiento/meiga-backpackers-node6609802063)

**Santiago de Compostela — experiencias (4 fichas)**
- [ERUOM](https://hestiat.com/experiencias/eruom-14158595929)
- [Galería Patio de Luz](https://hestiat.com/experiencias/galeria-patio-de-luz-5649111124)
- [Multicines Compostela](https://hestiat.com/experiencias/multicines-compostela-4489360707)
- [Museo de Arte Sacra da Colexiata de Santa María a Real de Sar](https://hestiat.com/experiencias/museo-de-arte-sacra-da-colexiata-de-santa-maria-a-real-de-sar-12690763846)

**Santiago de Compostela — servicios:** ninguno publicado en el catálogo, por eso la guía no tiene esa sección.

Además, las tres guías enlazan estas páginas, también comprobadas: `/destino/madrid`,
`/destino/granada`, `/destino/santiago-de-compostela`, `/experiencias`, `/servicios` y `/guia`.
