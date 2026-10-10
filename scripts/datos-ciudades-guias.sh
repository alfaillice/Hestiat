#!/bin/bash
# =============================================================================
# DATOS REALES POR CIUDAD, para elegir las guías. Solo lectura.
# Comparación BINARY para no chocar con las colaciones distintas de cada tabla.
# =============================================================================
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" "$ENVF" | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" "$ENVF" | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1" 2>&1 | grep -v '^--------------$'; }
CRIT_A="(a.lat IS NOT NULL AND a.lng IS NOT NULL AND (EXISTS(SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=a.id) OR COALESCE(a.price_per_night,a.indicative_price)>0) AND (SELECT COUNT(*) FROM accommodation_amenity m WHERE m.accommodation_id=a.id)>=3)"
CRIT_E="(e.latitude IS NOT NULL AND COALESCE(e.main_image,'')<>'' AND CHAR_LENGTH(COALESCE(e.short_description,e.description,''))>=120 AND NOT EXISTS(SELECT 1 FROM imagen_compartida i WHERE i.url=e.main_image COLLATE utf8mb4_general_ci AND i.n>20))"

echo "=== LOCALIDADES INDEXABLES CON MÁS CONTENIDO REAL ==="
echo "localidad|aloj|exp|serv|total|imagen_ciudad|provincia"
Q "SELECT CONCAT(l.nombre,'|',l.alojamientos,'|',l.experiencias,'|',l.servicios,'|',l.total,'|',
   IF(EXISTS(SELECT 1 FROM localidad_imagen i WHERE i.tipo='ciudad' AND BINARY i.clave = BINARY LOWER(l.nombre) AND i.url IS NOT NULL),'sí','no'),'|',
   COALESCE((SELECT a2.province FROM accommodation a2 WHERE BINARY a2.city = BINARY l.nombre AND a2.province IS NOT NULL LIMIT 1),'—'))
   FROM localidad_slug l WHERE l.indexable=1 ORDER BY l.total DESC LIMIT 45"

echo
echo "=== EJEMPLOS REALES QUE IRÁN ENLAZADOS EN CADA GUÍA (publicados e indexables) ==="
for C in $(Q "SELECT nombre FROM localidad_slug WHERE indexable=1 ORDER BY total DESC LIMIT 22"); do
  ESC=$(printf '%s' "$C" | sed "s/'/''/g")
  A=$(Q "SELECT GROUP_CONCAT(slug) FROM (SELECT a.slug FROM accommodation a WHERE a.status='published' AND BINARY a.city=BINARY '$ESC' AND $CRIT_A ORDER BY a.id LIMIT 4) t")
  E=$(Q "SELECT GROUP_CONCAT(slug) FROM (SELECT e.slug FROM experiencia e WHERE e.is_active=1 AND BINARY e.municipality=BINARY '$ESC' AND COALESCE(e.slug,'')<>'' AND $CRIT_E ORDER BY e.id LIMIT 3) t")
  S=$(Q "SELECT GROUP_CONCAT(slug) FROM (SELECT s.slug FROM servicio_turistico s WHERE s.is_active=1 AND BINARY s.municipality=BINARY '$ESC' AND COALESCE(s.slug,'')<>'' ORDER BY s.rating DESC LIMIT 2) t")
  T=$(Q "SELECT GROUP_CONCAT(DISTINCT a.type ORDER BY a.type) FROM accommodation a WHERE a.status='published' AND BINARY a.city=BINARY '$ESC'")
  echo "$C"
  echo "   tipos: ${T:-(sin dato)}"
  echo "   alojamientos: ${A:-(ninguno)}"
  echo "   experiencias: ${E:-(ninguna)}"
  echo "   servicios:    ${S:-(ninguno)}"
done
