#!/bin/bash
# =============================================================================
# LISTA REAL, CON NOMBRES, DE LO QUE ENLAZARÁ CADA GUÍA PILOTO
# Solo lectura. Cada URL se comprueba contra producción.
# =============================================================================
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" "$ENVF" | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" "$ENVF" | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1" 2>/dev/null | grep -v '^--------------$'; }
CA="(a.lat IS NOT NULL AND a.lng IS NOT NULL AND (EXISTS(SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=a.id) OR COALESCE(a.price_per_night,a.indicative_price)>0) AND (SELECT COUNT(*) FROM accommodation_amenity m WHERE m.accommodation_id=a.id)>=3)"
TAB=$(printf '\t')

probar() { # tipo|slug
  local t="$1" s="$2" url c
  case "$t" in
    A) url="https://hestiat.com/alojamiento/$s";;
    E) url="https://hestiat.com/experiencias/$s";;
    S) url="https://hestiat.com/servicios/$s";;
  esac
  c=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url")
  printf '%s' "$c"
}

for C in "Madrid" "Granada" "Santiago de Compostela"; do
  E=$(printf '%s' "$C" | sed "s/'/''/g")
  LAT=$(Q "SELECT ROUND(AVG(lat),4) FROM accommodation WHERE BINARY city=BINARY '$E' AND lat IS NOT NULL")
  LNG=$(Q "SELECT ROUND(AVG(lng),4) FROM accommodation WHERE BINARY city=BINARY '$E' AND lng IS NOT NULL")
  echo "########## $C  (centro de sus fichas: $LAT , $LNG)"
  echo "-- entradas de localidad del entorno (con distancia a calcular) --"
  Q "SELECT CONCAT('   ',l.nombre,'|',l.alojamientos,'|',l.experiencias,'|',l.servicios,'|',ROUND(AVG(a.lat),4),'|',ROUND(AVG(a.lng),4),'|',COUNT(*))
     FROM localidad_slug l JOIN accommodation a ON BINARY a.city=BINARY l.nombre
     WHERE BINARY l.nombre<>BINARY '$E' AND a.lat IS NOT NULL
       AND a.lat BETWEEN $LAT-0.25 AND $LAT+0.25 AND a.lng BETWEEN $LNG-0.25 AND $LNG+0.25
     GROUP BY l.nombre, l.alojamientos, l.experiencias, l.servicios" | sed 's/^/ /'
  echo "-- alojamientos publicados con foto propia, por tipo (2 por tipo, con nombre real) --"
  for T in $(Q "SELECT type FROM accommodation WHERE status='published' AND BINARY city=BINARY '$E' GROUP BY type ORDER BY COUNT(*) DESC LIMIT 4"); do
    TE=$(printf '%s' "$T" | sed "s/'/''/g")
    Q "SELECT CONCAT('   $T','|',name,'|',slug) FROM accommodation WHERE status='published' AND BINARY city=BINARY '$E' AND BINARY type=BINARY '$TE' AND EXISTS(SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=accommodation.id) ORDER BY (SELECT COUNT(*) FROM accommodation_photo p WHERE p.accommodation_id=accommodation.id) DESC, id LIMIT 2" | while IFS='|' read -r tt nom sl; do
      [ -z "$sl" ] && continue
      echo "   $tt | $nom | $sl | HTTP $(probar A "$sl")"
    done
  done
  echo "-- experiencias activas con valoración real (hasta 6) --"
  Q "SELECT CONCAT(name,'|',slug,'|',COALESCE(category,'—'),'|',COALESCE(rating,'—')) FROM experiencia WHERE is_active=1 AND BINARY municipality=BINARY '$E' AND COALESCE(slug,'')<>'' AND rating IS NOT NULL ORDER BY rating DESC, rating_count DESC LIMIT 6" | while IFS='|' read -r nom sl cat ra; do
    [ -z "$sl" ] && continue
    echo "   $nom | $cat | nota $ra | $sl | HTTP $(probar E "$sl")"
  done
  echo "-- servicios activos de categorías útiles para viajar (hasta 4) --"
  Q "SELECT CONCAT(name,'|',slug,'|',category) FROM servicio_turistico WHERE is_active=1 AND BINARY municipality=BINARY '$E' AND COALESCE(slug,'')<>'' AND category IN ('Viaje y comodidad','Deporte y fitness','Servicios para el alojamiento','Outdoor y aventura','Transporte','Fotografía y contenido') ORDER BY rating DESC LIMIT 4" | while IFS='|' read -r nom sl cat; do
    [ -z "$sl" ] && continue
    echo "   $nom | $cat | $sl | HTTP $(probar S "$sl")"
  done
  echo "-- páginas internas de la ciudad --"
  S1=$(printf '%s' "$C" | iconv -f utf-8 -t ascii//TRANSLIT 2>/dev/null | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-/g;s/^-//;s/-$//')
  for u in "https://hestiat.com/destino/$S1" "https://hestiat.com/experiencias" "https://hestiat.com/servicios" "https://hestiat.com/guia"; do
    echo "   $u | HTTP $(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$u")"
  done
done
