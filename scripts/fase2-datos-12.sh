#!/bin/bash
# =============================================================================
# FASE 2 — DATOS FRESCOS DE LAS DOCE CIUDADES RESTANTES
# Solo lectura. Recuentos publicados, composición, índice estricto, provincia
# mayoritaria e imagen de referencia de la localidad.
# =============================================================================
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" "$ENVF" | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" "$ENVF" | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1" 2>&1 | grep -v '^--------------$'; }
CE="(e.latitude IS NOT NULL AND COALESCE(e.main_image,'')<>'' AND CHAR_LENGTH(COALESCE(e.short_description,e.description,''))>=120 AND NOT EXISTS(SELECT 1 FROM imagen_compartida i WHERE i.url=e.main_image COLLATE utf8mb4_general_ci AND i.n>20))"
CA="(a.lat IS NOT NULL AND a.lng IS NOT NULL AND (EXISTS(SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=a.id) OR COALESCE(a.price_per_night,a.indicative_price)>0) AND (SELECT COUNT(*) FROM accommodation_amenity m WHERE m.accommodation_id=a.id)>=3)"

for C in "Barcelona" "Málaga" "Sevilla" "Córdoba" "Burgos" "Bilbao" "Santander" "Salamanca" "València" "Zaragoza" "Benidorm" "A Coruña"; do
  E=$(printf '%s' "$C" | sed "s/'/''/g")
  echo "### $C"
  echo "  provincia mayoritaria: $(Q "SELECT CONCAT(province,' (',n,' de las fichas)') FROM (SELECT province,COUNT(*) n FROM accommodation WHERE BINARY city=BINARY '$E' AND province IS NOT NULL GROUP BY province ORDER BY n DESC LIMIT 1) t")"
  echo "  alojamiento publicado por tipo: $(Q "SELECT GROUP_CONCAT(CONCAT(type,' ',n) ORDER BY n DESC SEPARATOR ' · ') FROM (SELECT type,COUNT(*) n FROM accommodation WHERE status='published' AND BINARY city=BINARY '$E' GROUP BY type ORDER BY n DESC LIMIT 6) t")"
  echo "  alojamiento publicado total: $(Q "SELECT COUNT(*) FROM accommodation WHERE status='published' AND BINARY city=BINARY '$E'")"
  echo "  alojamiento con ficha completa: $(Q "SELECT COUNT(*) FROM accommodation a WHERE a.status='published' AND BINARY a.city=BINARY '$E' AND $CA")"
  echo "  experiencias activas por categoría: $(Q "SELECT GROUP_CONCAT(CONCAT(category,' ',n) ORDER BY n DESC SEPARATOR ' · ') FROM (SELECT category,COUNT(*) n FROM experiencia WHERE is_active=1 AND BINARY municipality=BINARY '$E' GROUP BY category ORDER BY n DESC LIMIT 6) t")"
  echo "  experiencias activas total: $(Q "SELECT COUNT(*) FROM experiencia WHERE is_active=1 AND BINARY municipality=BINARY '$E'")"
  echo "  experiencias con ficha completa: $(Q "SELECT COUNT(*) FROM experiencia e WHERE e.is_active=1 AND BINARY e.municipality=BINARY '$E' AND $CE")"
  echo "  servicios activos por categoría: $(Q "SELECT GROUP_CONCAT(CONCAT(category,' ',n) ORDER BY n DESC SEPARATOR ' · ') FROM (SELECT category,COUNT(*) n FROM servicio_turistico WHERE is_active=1 AND BINARY municipality=BINARY '$E' GROUP BY category ORDER BY n DESC LIMIT 6) t")"
  echo "  servicios activos total: $(Q "SELECT COUNT(*) FROM servicio_turistico WHERE is_active=1 AND BINARY municipality=BINARY '$E'")"
  IMG=$(Q "SELECT CONCAT('sí -> ',LEFT(url,80),' || procedencia: ',COALESCE(fuente,'—')) FROM localidad_imagen WHERE tipo='ciudad' AND clave=LOWER('$E') AND url IS NOT NULL LIMIT 1")
  echo "  imagen de referencia: ${IMG:-NO EXISTE -> sin fotografía}"
done
