# Hestiat — PostGIS + geocodificación

La ubicación del alojamiento ahora tiene un campo PostGIS `geography(Point, 4326)` además de latitud/longitud.

## Flujo
1. El anfitrión introduce dirección/ciudad/código postal.
2. El servidor intenta geocodificar.
3. Guarda latitud/longitud.
4. Guarda el punto PostGIS SRID 4326.
5. La búsqueda cercana usa `ST_DWithin` y ordena por `ST_Distance`.

## API de proximidad
`GET /api/alojamientos/cerca?lat=37.99&lng=-1.13&radiusKm=25`

## Importante
La abstracción de geocoding no fija proveedor. Hay que configurar `GEOCODING_URL` y `GEOCODING_API_KEY` según el proveedor elegido. Para producción conviene un proveedor con términos adecuados para uso comercial y almacenamiento de resultados.

La migración crea la extensión PostGIS, la columna geográfica y un índice GiST.
