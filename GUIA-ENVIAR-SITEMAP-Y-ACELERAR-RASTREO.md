# Cómo enviar el sitemap a Google Search Console y acelerar el rastreo de las guías

## Antes de nada: qué se puede hacer desde aquí y qué no

En este Proyecto **no hay ningún conector permitido**. Lo he comprobado y el sistema responde literalmente: «connector type 'google_search_console' is not allowed in this Project; allowed: (none)». No es que falte autorizar Search Console: no se puede autorizar nada. Y el catálogo de conectores de Pipedream está vacío.

Conclusión práctica: **el envío del sitemap y las solicitudes de indexación los tienes que hacer tú desde la interfaz de Search Console**, con la cuenta que tiene la propiedad verificada. Son unos minutos y esta guía te lleva paso a paso.

## Paso 1. Comprobar que el sitemap es correcto (ya lo está)

Abre en una pestaña:

```
https://hestiat.com/sitemap.xml          → índice: declara 6 sitemaps, guias:15
https://hestiat.com/sitemaps/guias.xml   → las 15 guías
```

Deberías ver XML, no un error. Si el índice mostrara un recuento antiguo, es la caché de nginx: se purga sola al desplegar o se purga a mano desde el servidor (`rm -rf /var/cache/nginx/hestiat && systemctl reload nginx`).

## Paso 2. Enviar el sitemap (una sola vez, o cuando cambie)

1. Entra en **Search Console** y elige la propiedad `https://hestiat.com/`.
2. En el menú izquierdo: **Sitemaps**.
3. En «Añadir un sitemap nuevo» escribe `sitemap.xml` (solo eso; la barra del dominio ya la pone la propia interfaz).
4. Pulsa **Enviar**.

Quedará con estado «Correcto» y un «Descubiertas: N URLs». El índice principal es el que hay que enviar; los hijos (`ciudades.xml`, `alojamientos.xml`, `guias.xml`…) se descubren solos desde él. Si quieres, puedes enviar también `sitemaps/guias.xml` directamente para que quede registrado.

## Paso 3. Pedir indexación de las 15 guías, una a una

Para forzar el rastreo de una URL concreta, la herramienta es **Inspección de URL**:

1. Arriba del todo, en la barra de búsqueda de Search Console, pega la URL completa. Por ejemplo:
   `https://hestiat.com/guia/valencia`
2. Espera el análisis («Recuperando datos…»).
3. Pulsa **Probar URL en vivo** si quieres ver cómo la ve Google en ese momento.
4. Pulsa **Solicitar indexación**. Aparece un aviso del tipo «Se ha solicitado la indexación» y se añade a una cola.
5. Repite con las quince. Hay un límite diario de solicitudes por propiedad (unas decenas), así que si te frena, deja las que falten para el día siguiente.

Orden recomendado (las más antiguas primero):

```
madrid · granada · santiago-de-compostela · barcelona · malaga · sevilla · cordoba
burgos · bilbao · benidorm · santander · valencia · zaragoza · a-coruna · salamanca
```

## Paso 4. Acelerar el rastreo sin depender de suerte

Lo que de verdad pesa, y ya está hecho o está a mano:

```
1. Sitemap declarado y accesible                                ← enviado en el paso 2
2. Cada guía con canónica propia y enlazada desde su página      ← ya está
   de ciudad (/destino/<ciudad> → /guia/<ciudad>)
3. Enlaces internos desde páginas que Google ya rastrea          ← ya está (portada, /guia, destinos)
4. Sin noindex, sin bloqueos en robots.txt                       ← comprobado
5. Contenido único, con datos y sin duplicar otras páginas       ← verificado guía a guía
```

Dos cosas que **no** recomiendo: pedir indexación en bucle (hay límite y no acelera nada) y enlazar las guías desde foros o redes solo para llamar al rastreador; eso sí puede penalizar.

## Paso 5. Seguimiento

- **Inspección de URL** de cada guía te dice su estado concreto.
- **Indexación de páginas** te da el conjunto agrupado por motivo.
- Si alguna aparece como «Rastreada: actualmente sin indexar», ahí sí hay algo que revisar: pásame el estado y lo analizo (es el único caso que normalmente exige cambios).

## Lo que nuestros registros dicen hoy (9 de octubre)

```
Googlebot en todo el sitio (3 días de registro): 4 peticiones · ninguna a las guías ni al sitemap
Applebot: 4 · bingbot y YandexBot: 0
```

Es decir: Googlebot **todavía no ha visitado ninguna guía**. No es un rechazo ni un error: las guías se publicaron ese mismo día y el rastreo de páginas nuevas no es inmediato. Enviar el sitemap y solicitar las quince es exactamente lo que acelera ese primer paso.
