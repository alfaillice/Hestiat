#!/bin/bash
# ¿Por qué las fichas de alojamiento no sirven og:image?
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" "$ENVF" | cut -d= -f2-)
P=$(grep "^DB_PASSWORD=" "$ENVF" | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }
URL=https://hestiat.com/alojamiento/hostel-monasterio-de-mor

echo "=== 1. etiquetas og: y twitter: que sirve la ficha ==="
curl -sS --max-time 40 "$URL" | grep -oE '<meta property="og:[a-z:]+" content="[^"]{0,70}|<meta name="twitter:[a-z:]+"' | head -8 | sed 's/^/   /'
echo "   ¿hay og:image?: $(curl -sS --max-time 40 "$URL" | grep -c 'og:image')"

echo "=== 2. ¿tiene fotos propias esa ficha? ==="
Q "SELECT CONCAT('   filas en accommodation_photo: ', COUNT(*)) FROM accommodation_photo p JOIN accommodation a ON a.id=p.accommodation_id WHERE a.slug='hostel-monasterio-de-mor'"

echo "=== 3. ¿responde la cadena de referencia para su ciudad y provincia? ==="
Q "SELECT CONCAT('   ciudad/provincia de la ficha: ', COALESCE(city,'(sin ciudad)'), ' / ', COALESCE(province,'(sin provincia)')) FROM accommodation WHERE slug='hostel-monasterio-de-mor'"
CIUDAD=$(Q "SELECT LOWER(city) FROM accommodation WHERE slug='hostel-monasterio-de-mor'")
PROV=$(Q "SELECT LOWER(province) FROM accommodation WHERE slug='hostel-monasterio-de-mor'")
for k in "$CIUDAD" "$PROV" espana; do
  [ -n "$k" ] || continue
  echo "   localidad_imagen[$k]: $(Q "SELECT COALESCE(LEFT(url,60),'(sin url)') FROM localidad_imagen WHERE clave='$k' LIMIT 1")"
done

echo "=== 4. la consulta que hace el código, tal cual (con su colación) ==="
Q "SELECT CONCAT('   ciudad: ', COALESCE(LEFT(url,50),'(nada)')) FROM localidad_imagen WHERE tipo='ciudad' AND clave='$CIUDAD' AND url IS NOT NULL LIMIT 1"
Q "SELECT CONCAT('   pais:   ', COALESCE(LEFT(url,50),'(nada)')) FROM localidad_imagen WHERE tipo='pais' AND clave='espana' AND url IS NOT NULL LIMIT 1"

echo "=== 5. ¿hay algún error en la aplicación al pintar esa ficha? ==="
journalctl -u hestiat --since "10 minutes ago" 2>/dev/null | grep -iE "error|og:image|imagenDeReferencia" | tail -3 | cut -c1-200 | sed 's/^/   /'
