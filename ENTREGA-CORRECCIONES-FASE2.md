# Fase 2 — Correcciones finales antes de publicar

**Ninguna guía se ha publicado.** Las doce siguen en `en_revision`, devuelven 404 y están fuera del sitemap. Las tres publicadas (Madrid, Granada, Santiago de Compostela) no se han alterado. Rama `nueva-web`.

## A. Correcciones de contenido (5 guías)

Se han aplicado sobre la fila de la base de datos, con las cifras recalculadas filtrando por ciudad **y** provincia.

**Barcelona** — Los dos servicios enlazados iban sin texto. Ahora llevan su nombre del catálogo: *56 - Portal de Santa Madrona* y *we bike rent*. También he quitado una interpretación que no estaba verificada («que en la práctica son alquiler de bicis y empresas de actividades»), porque describir a qué se dedica un negocio no es un dato del catálogo.

**Sevilla** — Los dos servicios llevan ya su nombre (*089 Calle Adriano* y *062 Plaza de Armas*). Y la comparación confusa se ha sustituido por una verificada: «Hay 18 fichas de alojamiento con ficha completa, la cifra más alta entre las ciudades andaluzas de esta fase: Málaga tiene 11 y Córdoba 1».

**Santander** — La comparación imprecisa se ha cambiado por las tres cifras reales: «Córdoba tiene 1 ficha completa sobre 87 publicadas, A Coruña 1 sobre 43 y Santander 2 sobre 83».

**Salamanca** — Bloque de datos completo recalculado, título y resumen revisados:

```
ANTES (sin filtrar por provincia)        AHORA (ciudad + provincia de Salamanca)
93 alojamientos publicados               84 alojamientos publicados
  37 hoteles                               30 hoteles
  21 hostales                              21 hostales
  15 apartamentos                          14 apartamentos
  9 casas de invitados                     9 casas de invitados
  5 pensiones                              5 pensiones
  3 albergues                              3 albergues
                                            1 apartahotel   (faltaba)
                                            1 parador       (faltaba)
resumen: «93 alojamientos publicados»    resumen: «84 alojamientos publicados» (144 car.)
```

Y las dos afirmaciones falsas, corregidas: **ya no dice** que sea la ciudad con menos experiencias (Benidorm tiene 32 frente a 36) ni con menos servicios (València tiene 0). Ahora dice, con datos: «Salamanca es de las ciudades de esta fase con menos contenido alrededor del alojamiento: 36 experiencias y 27 servicios, frente a las 95 experiencias de Zaragoza o los 129 servicios de Burgos».

Las demás cifras de Salamanca ya eran correctas y se han vuelto a comprobar: 36 experiencias, 27 servicios, 4 fichas completas, los desgloses por categoría y la zona de Alba de Tormes (10,8 km, 3 alojamientos, 7 experiencias y 6 servicios).

**Zaragoza** — Título y resumen nuevos, sin cifras que caduquen:
```
Título anterior:  Zaragoza: 95 experiencias y solo 31 alojamientos
Título actual:    Zaragoza: qué ver y cómo elegir dónde dormir
Resumen actual:   Guía de Zaragoza para preparar el viaje: qué hay publicado en Hestiat, qué ver y
                  cómo elegir alojamiento entre la oferta disponible. (132 car.)
```

## B. Mejoras técnicas (commit 433c7c5)

1. **Encabezados `<h2>` reales.** Los títulos de sección del cuerpo se sirven como encabezados. Antes la página tenía un `<h1>` y ningún encabezado más. La detección es conservadora (línea en mayúsculas, cuatro letras o más, que no sea una dirección) y el aspecto no cambia: el encabezado hereda tamaño y peso y los saltos de línea se conservan. Comprobado con los doce cuerpos: cada guía genera **entre 5 y 6 encabezados** y el texto reconstruido sigue siendo idéntico al guardado.
2. **Fechas en ISO 8601.** `datePublished` y `dateModified` pasan de `"2026-10-09 19:31:12"` a `"2026-10-09T19:31:12+00:00"`. El servidor y MariaDB van en UTC (zona `Etc/UTC` y `NOW()` igual a `UTC_TIMESTAMP()`, comprobado), así que se usa `+00:00`. Si una guía no tiene fecha, no se inventa ninguna.
3. **Imagen en el dato estructurado.** El `Article` declara la imagen de referencia cuando existe, con `creditText` que aclara que no es una fotografía del establecimiento. Si no hay imagen, no se declara nada.
4. **Enlace entre página de ciudad y guía.** Nueva función que enlaza `/guia/...` desde `/destino/...` **solo si la guía está publicada**. Comprobado contra la base de datos: `Madrid → madrid`, `Granada → granada`, y `Barcelona`, `València` y `A Coruña` no generan enlace porque sus guías son borradores.

## Pruebas

```
SUPERADAS
· Compilación del proyecto                                          OK
· fechaISO('2026-10-09 19:31:12') = 2026-10-09T19:31:12+00:00       OK · y undefined si no hay fecha
· esTituloDeSeccion: títulos sí, líneas de datos y frases no        OK (probado con líneas reales)
· Conversor sobre los doce cuerpos: texto idéntico al guardado      OK (12 de 12)
· Cifras de los doce textos contra el catálogo (ciudad+provincia)   OK · 0 incidencias
· Enlaces de los doce (158 distintos)                               OK · todos 200
· Las doce devuelven 404 y no están en el sitemap                   OK
· Las tres publicadas: mismos textos, títulos y fechas              OK
· Pruebas de SEO del sitio (7 comprobaciones)                       OK · todas pasan
· Resto de la web (portada, search, destinos, experiencias, guía)   OK · 200

NO COMPROBADO TODAVÍA (necesita desplegar)
· Los <h2>, la fecha ISO y la imagen en el dato estructurado en producción. Ahora mismo /guia/madrid
  sigue sirviendo 0 etiquetas <h2> y datePublished en el formato antiguo, porque producción ejecuta
  el código anterior (20261009-193345). No he desplegado: lo explico abajo y espero tu autorización.
```

## Archivos modificados y commits

```
frontend/lib/guia-render.ts                  (+33) esTituloDeSeccion y fechaISO
frontend/app/guia/[slug]/page.tsx            (+42/-10) encabezados, fechas ISO, imagen en el Article
frontend/app/destino/[ciudad]/page.tsx       (+20) enlace a la guía solo si está publicada

COMMIT: 433c7c5 (3 archivos, 85 inserciones, 10 supresiones) · empujado a nueva-web
RAMA:   nueva-web · main, legacy-hestiat, hestiat-marketplace y backup-nueva-web sin tocar
```

## Lo que necesito de ti

**Hace falta un despliegue para que las mejoras técnicas se vean**, y no lo he hecho porque me lo pediste expresamente. El motivo: los tres primeros cambios son de plantilla, así que hasta que no se despliegue, `/guia/madrid` seguirá sin `<h2>`, con la fecha en formato antiguo y sin imagen declarada, y las páginas de ciudad no enlazarán su guía. Las correcciones de contenido sí están ya guardadas, pero tampoco se ven porque los doce borradores responden 404 a propósito.

Si lo autorizas, despliego con el procedimiento habitual (con vuelta atrás automática si la web no responde 200) y verifico después: las siete comprobaciones de SEO, los `<h2>` y la fecha ISO en Madrid, el enlace desde `/destino/madrid`, las direcciones de las doce publicadas y que los doce borradores siguen en 404.

**No afirmo que Google haya indexado nada.** Tres guías están publicadas y declaradas en el sitemap; doce están en revisión y fuera de él. La indexación real solo se ve en Search Console.
