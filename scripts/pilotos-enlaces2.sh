#!/bin/bash
# =============================================================================
# Enlaces definitivos de los pilotos, elegidos con señales que SÍ existen en el
# catálogo (completitud, tipo) porque ni los alojamientos tienen foto propia ni
# las experiencias tienen valoración. Cada URL se comprueba contra producción.
# =============================================================================
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" "$ENVF" | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" "$ENVF" | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1" 2>/dev/null | grep -v '^--------------$'; }
prueba() { curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$1"; }

for C in "Madrid" "Granada" "Santiago de Compostela"; do
  E=$(printf '%s' "$C" | sed "s/'/''/g")
  echo "########## $C"
  echo "-- ALOJAMIENTO: 2 por tipo, los de ficha más completa, con nombre real --"
  for T in $(Q "SELECT type FROM accommodation WHERE status='published' AND BINARY city=BINARY '$E' GROUP BY type ORDER BY COUNT(*) DESC LIMIT 4"); do
    TE=$(printf '%s' "$T" | sed "s/'/''/g")
    Q "SELECT CONCAT(name,'|',slug) FROM accommodation WHERE status='published' AND BINARY city=BINARY '$E' AND BINARY type=BINARY '$TE' ORDER BY COALESCE(completeness,0) DESC, id LIMIT 2" > /tmp/lista_a.txt
    while IFS='|' read -r nom sl; do
      [ -z "$sl" ] && continue
      echo "   $T | $nom | $sl | HTTP $(prueba "https://hestiat.com/alojamiento/$sl")"
    done < /tmp/lista_a.txt
  done
  echo "-- EXPERIENCIAS: 6 activas, las de ficha más completa --"
  Q "SELECT CONCAT(name,'|',slug,'|',COALESCE(category,'—'),'|',COALESCE(completeness,0),'|',COALESCE(LEFT(short_description,60),'')) FROM experiencia WHERE is_active=1 AND BINARY municipality=BINARY '$E' AND COALESCE(slug,'')<>'' ORDER BY COALESCE(completeness,0) DESC, id LIMIT 6" > /tmp/lista_e.txt
  while IFS='|' read -r nom sl cat comp desc; do
    [ -z "$sl" ] && continue
    echo "   $nom | $cat | ficha:$comp | HTTP $(prueba "https://hestiat.com/experiencias/$sl") | desc: $desc"
  done < /tmp/lista_e.txt
  echo "-- ¿tiene el catálogo entradas de barrio de esta ciudad, aunque sean pequeñas? --"
  Q "SELECT CONCAT('   ',nombre,'|',alojamientos,'|',experiencias,'|',servicios,'|',total) FROM localidad_slug WHERE indexable=0 AND BINARY nombre IN (BINARY 'Albaicín', BINARY 'Albayzín', BINARY 'Realejo', BINARY 'Sacromonte', BINARY 'Cartuja', BINARY 'Zaidín', BINARY 'Centro', BINARY 'Santiago de Compostela') LIMIT 12"
done
echo "########## NOTA: ¿cuántos alojamientos publicados tienen foto propia en total?"
Q "SELECT CONCAT('   con foto propia: ',COUNT(DISTINCT accommodation_id)) FROM accommodation_photo"
Q "SELECT CONCAT('   experiencias activas con valoración: ',COUNT(*)) FROM experiencia WHERE is_active=1 AND rating IS NOT NULL"
