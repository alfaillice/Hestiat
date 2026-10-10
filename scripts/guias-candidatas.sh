#!/bin/bash
# =============================================================================
# CIUDADES CANDIDATAS PARA LAS GUÍAS: provincia mayoritaria + enlaces concretos
# comprobados uno a uno contra producción. Solo lectura.
# =============================================================================
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" "$ENVF" | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" "$ENVF" | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1" 2>&1 | grep -v '^--------------$'; }
CRIT_A="(a.lat IS NOT NULL AND a.lng IS NOT NULL AND (EXISTS(SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=a.id) OR COALESCE(a.price_per_night,a.indicative_price)>0) AND (SELECT COUNT(*) FROM accommodation_amenity m WHERE m.accommodation_id=a.id)>=3)"
CRIT_E="(e.latitude IS NOT NULL AND COALESCE(e.main_image,'')<>'' AND CHAR_LENGTH(COALESCE(e.short_description,e.description,''))>=120 AND NOT EXISTS(SELECT 1 FROM imagen_compartida i WHERE i.url=e.main_image COLLATE utf8mb4_general_ci AND i.n>20))"

CIUDADES="Madrid|Barcelona|Granada|Málaga|Sevilla|Bilbao|Burgos|Santander|Zaragoza|Benidorm|Córdoba|Santiago de Compostela|Salamanca|Donostia / San Sebastián|València|Toledo|Segovia|Vigo|A Coruña|Valladolid|Palma|Lloret de Mar|Conil de la Frontera|Torremolinos|Murcia|Tarragona|Girona|Reus|León|Jaca|Pollenca|Torrevieja"

echo "ciudad|aloj|exp|serv|provincia_mayoritaria|tipos|ejemplos_verificados_200"
IFS='|'
for C in $CIUDADES; do
  ESC=$(printf '%s' "$C" | sed "s/'/''/g")
  F=$(Q "SELECT CONCAT(l.alojamientos,'|',l.experiencias,'|',l.servicios) FROM localidad_slug l WHERE BINARY l.nombre=BINARY '$ESC'")
  PROV=$(Q "SELECT CONCAT(province,' (',n,')') FROM (SELECT province, COUNT(*) n FROM accommodation WHERE BINARY city=BINARY '$ESC' AND province IS NOT NULL GROUP BY province ORDER BY n DESC LIMIT 1) t")
  TIPOS=$(Q "SELECT COUNT(DISTINCT type) FROM accommodation WHERE BINARY city=BINARY '$ESC' AND status='published'")
  AL=$(Q "SELECT GROUP_CONCAT(CONCAT('A:',slug)) FROM (SELECT slug FROM accommodation a WHERE a.status='published' AND BINARY a.city=BINARY '$ESC' AND $CRIT_A ORDER BY (SELECT COUNT(*) FROM accommodation_photo p WHERE p.accommodation_id=a.id) DESC, a.id LIMIT 3) t")
  EX=$(Q "SELECT GROUP_CONCAT(CONCAT('E:',slug)) FROM (SELECT slug FROM experiencia e WHERE e.is_active=1 AND BINARY e.municipality=BINARY '$ESC' AND COALESCE(e.slug,'')<>'' AND $CRIT_E ORDER BY e.rating DESC, e.id LIMIT 2) t")
  SE=$(Q "SELECT GROUP_CONCAT(CONCAT('S:',slug)) FROM (SELECT slug FROM servicio_turistico s WHERE s.is_active=1 AND BINARY s.municipality=BINARY '$ESC' AND COALESCE(s.slug,'')<>'' ORDER BY s.rating DESC, s.id LIMIT 1) t")
  # comprobar que cada enlace abre de verdad
  ok=""; mal=""
  for par in $AL $EX $SE; do
    pre=${par:0:2}; slug=${par:2}
    case "$pre" in
      A:) url="https://hestiat.com/alojamiento/$slug";;
      E:) url="https://hestiat.com/experiencias/$slug";;
      S:) url="https://hestiat.com/servicios/$slug";;
    esac
    c=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url")
    if [ "$c" = "200" ]; then ok="$ok $pre$slug"; else mal="$mal $pre$slug($c)"; fi
  done
  echo "$C|${F:-—}|${PROV:-—}|${TIPOS:-0}|OK:${ok:-ninguno}|MAL:${mal:-ninguno}"
done
