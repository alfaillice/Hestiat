#!/bin/bash
# =============================================================================
# ÚLTIMA MEDICIÓN DE LOS PILOTOS: zonas con distancia real y alojamientos con
# nombre, eligiendo por señales que existen de verdad. Sin ocultar errores.
# =============================================================================
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" "$ENVF" | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" "$ENVF" | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1" 2>&1 | grep -v '^--------------$'; }
prueba() { curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$1"; }

echo "=== ¿qué columnas reales tiene accommodation? (las útiles) ==="
Q "SHOW COLUMNS FROM accommodation" | awk '{print $1}' | grep -iE '^(name|slug|type|rating|rating_count|completeness|price_per_night|indicative_price|city|province|address|status)$' | tr '\n' ' '
echo

for C in "Madrid" "Granada" "Santiago de Compostela"; do
  E=$(printf '%s' "$C" | sed "s/'/''/g")
  echo "########## $C"
  echo "-- lo más cercano al centro de sus fichas (distancia real en km) --"
  Q "SELECT CONCAT('   ',l.nombre,' | ',l.alojamientos,' aloj / ',l.experiencias,' exp / ',l.servicios,' serv | ',
       ROUND(ST_Distance_Sphere(POINT(AVG(a.lng),AVG(a.lat)),
             POINT((SELECT AVG(lng) FROM accommodation WHERE BINARY city=BINARY '$E'),(SELECT AVG(lat) FROM accommodation WHERE BINARY city=BINARY '$E')))/1000,1),' km')
     FROM localidad_slug l JOIN accommodation a ON BINARY a.city=BINARY l.nombre
     WHERE BINARY l.nombre<>BINARY '$E' AND a.lat IS NOT NULL AND l.total>=5
     GROUP BY l.nombre, l.alojamientos, l.experiencias, l.servicios
     HAVING ST_Distance_Sphere(POINT(AVG(a.lng),AVG(a.lat)),
             POINT((SELECT AVG(lng) FROM accommodation WHERE BINARY city=BINARY '$E'),(SELECT AVG(lat) FROM accommodation WHERE BINARY city=BINARY '$E')))/1000 < 12
     ORDER BY 1"
  echo "-- alojamientos por tipo, con nombre, prefiriendo los que tienen foto; URL comprobada --"
  for T in $(Q "SELECT type FROM accommodation WHERE status='published' AND BINARY city=BINARY '$E' GROUP BY type ORDER BY COUNT(*) DESC LIMIT 4"); do
    TE=$(printf '%s' "$T" | sed "s/'/''/g")
    Q "SELECT CONCAT(name,'|',slug) FROM accommodation a WHERE a.status='published' AND BINARY a.city=BINARY '$E' AND BINARY a.type=BINARY '$TE'
       ORDER BY EXISTS(SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=a.id) DESC,
                (SELECT COUNT(*) FROM accommodation_amenity m WHERE m.accommodation_id=a.id) DESC, a.id LIMIT 2" > /tmp/la.txt
    while IFS='|' read -r nom sl; do
      [ -z "$sl" ] && continue
      echo "   $T | $nom | $sl | HTTP $(prueba "https://hestiat.com/alojamiento/$sl")"
    done < /tmp/la.txt
  done
done
