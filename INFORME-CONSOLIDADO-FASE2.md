# Fase 2 — Informe consolidado: las doce guías de destinos publicadas

**Todas publicadas.** 12 guías de la Fase 2 más las 3 del piloto inicial: **15 guías publicadas y 0 en revisión**.

Medición de datos y comprobación de enlaces: 9 de octubre de 2026, contra el catálogo real (filtrando por ciudad **y** provincia) y contra producción.

## Tabla consolidada

| Ciudad | URL | HTTP | h1/h2 | Canónica | Datos estruct. | Imagen | Aloj. | Exp. | Serv. | Fichas completas | Enlaces | Publicada |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Barcelona | https://hestiat.com/guia/barcelona | 200 | 1/5 | https://hestiat.com/guia/barcelona | Article, BreadcrumbList | sí | 281 | 220 | 51 | 35 | 12 | 2026-10-09 22:04:10 |
| Málaga | https://hestiat.com/guia/malaga | 200 | 1/5 | https://hestiat.com/guia/malaga | Article, BreadcrumbList | no | 146 | 101 | 60 | 11 | 12 | 2026-10-09 21:45:18 |
| Sevilla | https://hestiat.com/guia/sevilla | 200 | 1/5 | https://hestiat.com/guia/sevilla | Article, BreadcrumbList | sí | 125 | 88 | 62 | 18 | 12 | 2026-10-09 22:06:35 |
| Córdoba | https://hestiat.com/guia/cordoba | 200 | 1/5 | https://hestiat.com/guia/cordoba | Article, BreadcrumbList | no | 87 | 84 | 18 | 1 | 12 | 2026-10-09 22:09:25 |
| Burgos | https://hestiat.com/guia/burgos | 200 | 1/5 | https://hestiat.com/guia/burgos | Article, BreadcrumbList | no | 71 | 91 | 129 | 3 | 14 | 2026-10-09 22:24:34 |
| Bilbao | https://hestiat.com/guia/bilbao | 200 | 1/5 | https://hestiat.com/guia/bilbao | Article, BreadcrumbList | sí | 90 | 64 | 128 | 4 | 12 | 2026-10-09 21:55:01 |
| Santander | https://hestiat.com/guia/santander | 200 | 1/5 | https://hestiat.com/guia/santander | Article, BreadcrumbList | no | 83 | 57 | 108 | 2 | 12 | 2026-10-09 22:37:50 |
| Salamanca | https://hestiat.com/guia/salamanca | 200 | 1/6 | https://hestiat.com/guia/salamanca | Article, BreadcrumbList | no | 84 | 36 | 27 | 4 | 12 | 2026-10-09 23:11:18 |
| València | https://hestiat.com/guia/valencia | 200 | 1/5 | https://hestiat.com/guia/valencia | Article, BreadcrumbList | sí | 74 | 49 | 0 | 12 | 10 | 2026-10-09 22:41:22 |
| Zaragoza | https://hestiat.com/guia/zaragoza | 200 | 1/5 | https://hestiat.com/guia/zaragoza | Article, BreadcrumbList | sí | 31 | 95 | 120 | 2 | 12 | 2026-10-09 22:53:53 |
| Benidorm | https://hestiat.com/guia/benidorm | 200 | 1/5 | https://hestiat.com/guia/benidorm | Article, BreadcrumbList | sí | 85 | 32 | 124 | 5 | 12 | 2026-10-09 21:57:45 |
| A Coruña | https://hestiat.com/guia/a-coruna | 200 | 1/5 | https://hestiat.com/guia/a-coruna | Article, BreadcrumbList | sí | 43 | 59 | 47 | 1 | 13 | 2026-10-09 23:02:09 |

## Qué se ha verificado en cada una

```
HTTP 200 en las doce · un solo <h1> y encabezados <h2> reales (5 o 6 por guía)
Canónica propia en las doce (/guia/<slug>) · robots: index, follow
Datos estructurados Article + BreadcrumbList con datePublished en ISO 8601
Los 12 desgloses de datos suman exactamente el total declarado (comprobado contra el catálogo)
Enlaces internos: todos responden 200 y llevan a fichas publicadas o activas de la ciudad correcta
Imagen de referencia con su etiqueta donde existe; donde no existe, no se declara ninguna
Sitemap de guías con 15 entradas · índice de sitemaps → guias:15
Páginas de destino: /destino/<ciudad> responde 200 y enlaza a su guía en las doce
Resto del sitio: portada, búsqueda, destinos, experiencias, servicios y /guia → 200
Las siete pruebas de SEO del sitio pasan
```

## Cifras finales verificadas (publicadas y activas en el catálogo)

- **Barcelona**: 281 alojamientos · 220 experiencias · 51 servicios · 35 con ficha completa · imagen de referencia: sí
- **Málaga**: 146 alojamientos · 101 experiencias · 60 servicios · 11 con ficha completa · imagen de referencia: no
- **Sevilla**: 125 alojamientos · 88 experiencias · 62 servicios · 18 con ficha completa · imagen de referencia: sí
- **Córdoba**: 87 alojamientos · 84 experiencias · 18 servicios · 1 con ficha completa · imagen de referencia: no
- **Burgos**: 71 alojamientos · 91 experiencias · 129 servicios · 3 con ficha completa · imagen de referencia: no
- **Bilbao**: 90 alojamientos · 64 experiencias · 128 servicios · 4 con ficha completa · imagen de referencia: sí
- **Santander**: 83 alojamientos · 57 experiencias · 108 servicios · 2 con ficha completa · imagen de referencia: no
- **Salamanca**: 84 alojamientos · 36 experiencias · 27 servicios · 4 con ficha completa · imagen de referencia: no
- **València**: 74 alojamientos · 49 experiencias · 0 servicios · 12 con ficha completa · imagen de referencia: sí
- **Zaragoza**: 31 alojamientos · 95 experiencias · 120 servicios · 2 con ficha completa · imagen de referencia: sí
- **Benidorm**: 85 alojamientos · 32 experiencias · 124 servicios · 5 con ficha completa · imagen de referencia: sí
- **A Coruña**: 43 alojamientos · 59 experiencias · 47 servicios · 1 con ficha completa · imagen de referencia: sí

## Incidencias encontradas y resueltas durante la fase

1. **Salamanca tenía el bloque de datos medido sin filtrar por provincia** (93 alojamientos en lugar de 84, porque incluía el distrito homónimo de Madrid) y dos comparaciones falsas. Recalculado y corregido. Su advertencia sobre el distrito queda verificada: 9 de las fichas con `city='Salamanca'` están en la provincia de Madrid.
2. **Un enlace de Córdoba cayó durante la fase**: la ficha respondía 200 al elegirla y 404 al comprobar al final. Sustituida por otra verificada.
3. **Los desgloses de las doce enumeraban solo los tipos o categorías mayores**, así que no sumaban el total declarado. Completados con las líneas que faltaban, sin modificar ninguna cifra existente y con singular donde la cifra es 1.
4. **Los desgloses de Madrid, Granada, Málaga y Bilbao** (publicadas antes de empezar a completarlos) se completaron después, también solo añadiendo líneas.
5. **Un error mío al completar Zaragoza** insertó la lista dentro de una frase del texto; detectado por el diff, reconstruido desde el original y corregido.
6. **Caché de nginx**: en varias publicaciones el índice de sitemaps y alguna página siguieron sirviendo la versión anterior hasta purgar la caché. Queda como paso operativo a recordar.

## Pendiente, y no lo he tocado

- **Santiago de Compostela** (guía del piloto) declara 108 alojamientos y el catálogo tiene hoy **107**: una ficha cambió después de publicarse. Las guías llevan la fecha de medición, pero conviene revisarlas en bloque de vez en cuando.
- **No se ha solicitado indexación en Google Search Console**: no existe conector ni credenciales para hacerlo desde aquí. Hay que hacerlo desde la interfaz de Search Console (Inspección de URL → Solicitar indexación), guía por guía.
- **Imágenes de referencia optimizadas**: solo la de Benidorm está en nuestro almacenamiento (WebP, 310 KB, sin redirección). Las de Madrid, Granada, Bilbao, Barcelona, Sevilla, València, Zaragoza y A Coruña siguen enlazadas a Commons, entre 128 y 358 KB y con una redirección previa. Se pueden optimizar igual cuando lo autorices.

## Lo que no se ha hecho

No se ha modificado el catálogo, ni precios, ni reservas, ni otras funcionalidades. No se ha tocado ninguna rama distinta de `nueva-web`. No se ha publicado ninguna guía fuera de las autorizadas y no se ha solicitado indexación.

**No afirmo que Google haya indexado ninguna página**: están publicadas, con `index, follow`, canónica propia, datos estructurados válidos y declaradas en el sitemap. La indexación real solo se comprueba en Search Console.
