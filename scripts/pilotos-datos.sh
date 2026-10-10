#!/bin/bash
# =============================================================================
# DATOS FRESCOS PARA LAS TRES GUÍAS PILOTO (Madrid, Granada, Santiago)
# Solo lectura. Recuentos actuales + composición por tipo + entorno urbano +
# imagen de referencia + nombres reales de lo que se va a enlazar.
# =============================================================================
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" "$ENVF" | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" "$ENVF" | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1" 2>/dev/null | grep -v '^--------------$'; }
CA="(a.lat IS NOT NULL AND a.lng IS NOT NULL AND (EXISTS(SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=a.id) OR COALESCE(a.price_per_night,a.indicative_price)>0) AND (SELECT COUNT(*) FROM accommodation_amenity m WHERE m.accommodation_id=a.id)>=3)"
CE="(e.latitude IS NOT NULL AND COALESCE(e.main_image,'')<>'' AND CHAR_LENGTH(COALESCE(e.short_description,e.description,''))>=120 AND NOT EXISTS(SELECT 1 FROM imagen_compartida i WHERE i.url=e.main_image COLLATE utf8mb4_general_ci AND i.n>20))"

for C in "Madrid" "Granada" "Santiago de Compostela"; do
  E=$(printf '%s' "$C" | sed "s/'/''/g")
  echo "########## $C"
  echo "RECUENTOS_INDEXABLES: $(Q "SELECT CONCAT(alojamientos,'|',experiencias,'|',servicios,'|',total) FROM localidad_slug WHERE BINARY nombre=BINARY '$E'")"
  echo "COORDENADAS_CENTRO: $(Q "SELECT CONCAT(ROUND(AVG(lat),4),'|',ROUND(AVG(lng),4),'|',COUNT(*)) FROM accommodation WHERE BINARY city=BINARY '$E' AND lat IS NOT NULL")"
  echo "IMAGEN_DE_REFERENCIA: $(Q "SELECT CONCAT(LEFT(url,110),' || fuente=',COALESCE(fuente,'—')) FROM localidad_imagen WHERE tipo='ciudad' AND BINARY clave=BINARY LOWER('$E') AND url IS NOT NULL LIMIT 1")"
  echo "ALOJAMIENTO_INDEXABLE_POR_TIPO:"
  Q "SELECT CONCAT('   ',type,'|',COUNT(*)) FROM accommodation a WHERE a.status='published' AND BINARY a.city=BINARY '$E' AND $CA GROUP BY type ORDER BY COUNT(*) DESC" | sed 's/^/ /'
  echo "ALOJAMIENTO_PUBLICADO_POR_TIPO (todo lo publicado, no solo lo indexable):"
  Q "SELECT CONCAT('   ',type,'|',COUNT(*)) FROM accommodation WHERE status='published' AND BINARY city=BINARY '$E' GROUP BY type ORDER BY COUNT(*) DESC" | sed 's/^/ /'
  echo "EXPERIENCIAS_ACTIVAS_POR_CATEGORIA:"
  Q "SELECT CONCAT('   ',COALESCE(category,'sin categoría'),'|',COUNT(*)) FROM experiencia WHERE is_active=1 AND BINARY municipality=BINARY '$E' GROUP BY category ORDER BY COUNT(*) DESC LIMIT 8" | sed 's/^/ /'
  echo "EXPERIENCIAS_ACTIVAS_MUESTRA (mejor valoradas, con nombre real):"
  Q "SELECT CONCAT('   ',name,'|',slug,'|',COALESCE(category,'—'),'|',COALESCE(rating,'—')) FROM experiencia WHERE is_active=1 AND BINARY municipality=BINARY '$E' AND COALESCE(slug,'')<>'' ORDER BY rating DESC LIMIT 6" | sed 's/^/ /'
  echo "SERVICIOS_ACTIVOS_POR_CATEGORIA:"
  Q "SELECT CONCAT('   ',COALESCE(category,'sin categoría'),'|',COUNT(*)) FROM servicio_turistico WHERE is_active=1 AND BINARY municipality=BINARY '$E' GROUP BY category ORDER BY COUNT(*) DESC LIMIT 8" | sed 's/^/ /'
  echo "ENTORNO_URBANO (entradas de localidad a menos de 0,3 grados):"
  LAT=$(Q "SELECT ROUND(AVG(lat),4) FROM accommodation WHERE BINARY city=BINARY '$E' AND lat IS NOT NULL")
  LNG=$(Q "SELECT ROUND(AVG(lng),4) FROM accommodation WHERE BINARY city=BINARY '$E' AND lng IS NOT NULL")
  Q "SELECT CONCAT('   ',l.nombre,'|',l.alojamientos,'|',l.experiencias,'|',l.servicios,'|',ROUND(AVG(a.lat),4),'|',ROUND(AVG(a.lng),4))
     FROM localidad_slug l JOIN accommodation a ON BINARY a.city=BINARY l.nombre
     WHERE l.indexable=1 AND l.total>=15 AND BINARY l.nombre<>BINARY '$E'
       AND a.lat IS NOT NULL AND a.lat BETWEEN $LAT-0.3 AND $LAT+0.3 AND a.lng BETWEEN $LNG-0.3 AND $LNG+0.3
     GROUP BY l.nombre, l.alojamientos, l.experiencias, l.servicios" | sed 's/^/ /'
done
