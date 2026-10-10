#!/bin/bash
# =============================================================================
# COMPROBACIÓN REAL DE LOS ENLACES QUE IRÍAN EN LAS GUÍAS
# Un slug por línea (nada de listas con comas), y cada URL con su código HTTP.
# Solo lectura. Nada se modifica.
# =============================================================================
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" "$ENVF" | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" "$ENVF" | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1" 2>/dev/null | grep -v '^--------------$'; }
CRIT_A="(a.lat IS NOT NULL AND a.lng IS NOT NULL AND (EXISTS(SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=a.id) OR COALESCE(a.price_per_night,a.indicative_price)>0) AND (SELECT COUNT(*) FROM accommodation_amenity m WHERE m.accommodation_id=a.id)>=3)"
CRIT_E="(e.latitude IS NOT NULL AND COALESCE(e.main_image,'')<>'' AND CHAR_LENGTH(COALESCE(e.short_description,e.description,''))>=120 AND NOT EXISTS(SELECT 1 FROM imagen_compartida i WHERE i.url=e.main_image COLLATE utf8mb4_general_ci AND i.n>20))"

echo "=== ¿CON QUÉ NOMBRE GUARDAN LA LOCALIDAD LAS EXPERIENCIAS? (10 primeras) ==="
Q "SELECT CONCAT(municipality,' :: ',COUNT(*)) FROM experiencia WHERE is_active=1 AND municipality IS NOT NULL GROUP BY municipality ORDER BY COUNT(*) DESC LIMIT 10" | sed 's/^/   /'
echo "=== Y LOS SERVICIOS ==="
Q "SELECT CONCAT(municipality,' :: ',COUNT(*)) FROM servicio_turistico WHERE is_active=1 AND municipality IS NOT NULL GROUP BY municipality ORDER BY COUNT(*) DESC LIMIT 6" | sed 's/^/   /'

CIUDADES="Madrid|Barcelona|Granada|Málaga|Sevilla|Bilbao|Burgos|Santander|Zaragoza|Benidorm|Córdoba|Santiago de Compostela|Salamanca|Donostia / San Sebastián|València|Toledo|Segovia|Vigo|A Coruña|Palma|Torremolinos|Lloret de Mar|Tarragona|Murcia"
echo
echo "=== ENLACES CONCRETOS, COMPROBADOS UNO A UNO ==="
IFS='|'
for C in $CIUDADES; do
  ESC=$(printf '%s' "$C" | sed "s/'/''/g")
  n_ok=0; n_mal=0; detalle=""
  # 3 alojamientos publicados e indexables
  while read -r slug; do
    [ -z "$slug" ] && continue
    c=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "https://hestiat.com/alojamiento/$slug")
    [ "$c" = "200" ] && n_ok=$((n_ok+1)) || { n_mal=$((n_mal+1)); detalle="$detalle A:$slug=$c"; }
  done <<< "$(Q "SELECT a.slug FROM accommodation a WHERE a.status='published' AND BINARY a.city=BINARY '$ESC' AND $CRIT_A ORDER BY (SELECT COUNT(*) FROM accommodation_photo p WHERE p.accommodation_id=a.id) DESC, a.id LIMIT 3")"
  # 2 experiencias
  while read -r slug; do
    [ -z "$slug" ] && continue
    c=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "https://hestiat.com/experiencias/$slug")
    [ "$c" = "200" ] && n_ok=$((n_ok+1)) || { n_mal=$((n_mal+1)); detalle="$detalle E:$slug=$c"; }
  done <<< "$(Q "SELECT e.slug FROM experiencia e WHERE e.is_active=1 AND BINARY e.municipality=BINARY '$ESC' AND COALESCE(e.slug,'')<>'' AND $CRIT_E ORDER BY e.rating DESC, e.id LIMIT 2")"
  # 1 servicio
  while read -r slug; do
    [ -z "$slug" ] && continue
    c=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "https://hestiat.com/servicios/$slug")
    [ "$c" = "200" ] && n_ok=$((n_ok+1)) || { n_mal=$((n_mal+1)); detalle="$detalle S:$slug=$c"; }
  done <<< "$(Q "SELECT s.slug FROM servicio_turistico s WHERE s.is_active=1 AND BINARY s.municipality=BINARY '$ESC' AND COALESCE(s.slug,'')<>'' ORDER BY s.rating DESC, s.id LIMIT 1")"
  printf '   %-26s %s con 200 · %s con error%s\n' "$C" "$n_ok" "$n_mal" "$detalle"
done
