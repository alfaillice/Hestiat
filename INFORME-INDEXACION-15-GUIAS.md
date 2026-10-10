# Estado de indexación y de rastreo de las 15 guías de Hestiat

## Lo primero, sin rodeos: no puedo consultar Search Console

**No tengo acceso a Search Console y no voy a inventar estados de indexación.** Lo comprobé: no existe conector de Search Console en las dos superficies disponibles (solo hay LinkedIn, TikTok, X, Instagram, Threads y TikTok Ads) ni credenciales de Google. La acción «Solicitar indexación» y los informes de cobertura solo existen dentro de la cuenta que tiene la propiedad verificada.

Lo que sí he podido medir, y es real: **los registros de acceso del servidor**. Ahí sí aparece lo que los rastreadores han pedido de verdad.

## Lo que dicen nuestros registros (7 al 9 de octubre de 2026)

```
Googlebot (todo el sitio, 3 días):        4 peticiones · la última, un 301 en «/» el 9 oct a las 20:13
Googlebot a guías (/guia/...):            0 peticiones
Googlebot a sitemaps:                     0 peticiones
Applebot a /guia/:                        0 peticiones
Cualquier bot, spider o crawler a /guia/:  0 peticiones
bingbot y YandexBot:                      0 peticiones en todo el sitio
```

Lectura honesta: **no hay ni una sola visita de Googlebot a las guías**. No significa que estén mal ni que Google las haya rechazado: la mayoría se publicaron el mismo día, horas antes de esta comprobación, y el rastreo de contenido nuevo no es inmediato. Pero conviene saberlo antes de esperar resultados, y por eso no puedo decir que estén indexadas.

## Estado técnico de cada URL (esto sí está comprobado)

| Ciudad | URL | HTTP | h1/h2 | Canónica | En el sitemap | Googlebot en nuestros registros | Indexación en Google |
|---|---|---|---|---|---|---|---|
| Madrid | https://hestiat.com/guia/madrid | 200 | 1/6 | correcta | sí | no consta | **no verificable desde aquí** |
| Granada | https://hestiat.com/guia/granada | 200 | 1/6 | correcta | sí | no consta | **no verificable desde aquí** |
| Santiago de Compostela | https://hestiat.com/guia/santiago-de-compostela | 200 | 1/5 | correcta | sí | no consta | **no verificable desde aquí** |
| Barcelona | https://hestiat.com/guia/barcelona | 200 | 1/5 | correcta | sí | no consta | **no verificable desde aquí** |
| Málaga | https://hestiat.com/guia/malaga | 200 | 1/5 | correcta | sí | no consta | **no verificable desde aquí** |
| Sevilla | https://hestiat.com/guia/sevilla | 200 | 1/5 | correcta | sí | no consta | **no verificable desde aquí** |
| Córdoba | https://hestiat.com/guia/cordoba | 200 | 1/5 | correcta | sí | no consta | **no verificable desde aquí** |
| Burgos | https://hestiat.com/guia/burgos | 200 | 1/5 | correcta | sí | no consta | **no verificable desde aquí** |
| Bilbao | https://hestiat.com/guia/bilbao | 200 | 1/5 | correcta | sí | no consta | **no verificable desde aquí** |
| Santander | https://hestiat.com/guia/santander | 200 | 1/5 | correcta | sí | no consta | **no verificable desde aquí** |
| València | https://hestiat.com/guia/valencia | 200 | 1/5 | correcta | sí | no consta | **no verificable desde aquí** |
| Zaragoza | https://hestiat.com/guia/zaragoza | 200 | 1/5 | correcta | sí | no consta | **no verificable desde aquí** |
| Benidorm | https://hestiat.com/guia/benidorm | 200 | 1/5 | correcta | sí | no consta | **no verificable desde aquí** |
| A Coruña | https://hestiat.com/guia/a-coruna | 200 | 1/5 | correcta | sí | no consta | **no verificable desde aquí** |
| Salamanca | https://hestiat.com/guia/salamanca | 200 | 1/6 | correcta | sí | no consta | **no verificable desde aquí** |

Las quince están publicadas, responden 200, tienen una sola etiqueta `<h1>` con encabezados `<h2>` reales, canónica propia que coincide con la URL y están declaradas en el sitemap de guías.

## Cómo lo compruebas tú en Search Console

Por cada URL: pega la dirección en **Inspección de URL** (arriba a la izquierda) y espera el resultado. Lo que necesitas mirar:

```
«La URL está en Google»                 → indexada
«La URL no está en Google»              → no indexada; debajo dice el motivo exacto
«Detectada: actualmente sin indexar»    → la conoce y aún no la ha rastreado o valorado
«Rastreada: actualmente sin indexar»    → la leyó y decidió no incluirla; ahí sí hay que mirar el motivo
«Excluida»                              → la descarta por una regla concreta (canónica, noindex, duplicada…)
```

Para el conjunto, en **Indexación de páginas** verás cuántas URLs están indexadas y cuántas excluidas, agrupadas por motivo. Con eso y el estado de cada URL puedes pasarme el resultado y lo analizo: si aparece algún «rastreada sin indexar» o alguna «excluida» por causa rara, merece la pena revisarlo con calma.

Y si quieres que lo consulte yo directamente, hay que autorizar un conector de Search Console desde la interfaz de conectores: no me pases credenciales por el chat.

## Corrección hecha hoy: Santiago de Compostela

Su guía declaraba 108 alojamientos y el catálogo tiene 107 (una ficha cambió después de publicarse). Corregidas **las cinco menciones**: el encabezado del bloque de datos, tres frases del cuerpo y el resumen.

```
Bloque de datos:  47 hoteles · 18 albergues · 16 hostales · 8 casas de invitados · 6 pensiones ·
                  5 apartamentos · 3 habitaciones · 2 campings · 1 villa · 1 motel = 107  (cuadra)
Verificación:     cada una de las diez líneas coincide con el catálogo actual (ciudad + provincia)
En el cambio:     solo se han modificado los números, ninguna otra palabra
Tras el cambio:   ninguna mención a 108 en el cuerpo ni en el resumen · página 200 ·
                  h1: 1 · h2: 5 · canónica correcta · el resumen y la metadescripción dicen 107
```

## Lo que no se ha hecho

No se ha tocado ninguna otra guía publicada, ninguna otra rama, ni el catálogo, precios o reservas. No se ha solicitado indexación (no puedo).

**No afirmo que Google haya indexado ninguna página.** Quince están publicadas y declaradas en el sitemap; el rastreo y la indexación solo se comprueban en Search Console.
