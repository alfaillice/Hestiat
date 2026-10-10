#!/bin/bash
# =============================================================================
# FASE 2 — ZONAS Y ENLACES REALES POR CIUDAD (mitad pasada como argumento)
# Solo lectura. Cada URL se comprueba contra producción.
# Se filtra por ciudad Y provincia para evitar colisiones de nombre.
# =============================================================================
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" "$ENVF" | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" "$ENVF" | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1" 2>/dev/null | grep -v '^--------------$'; }
CEN="POINT((SELECT AVG(lng) FROM accommodation WHERE BINARY city=BINARY '%CIUDAD%'),(SELECT AVG(lat) FROM accommodation WHERE BINARY city=BINARY '%CIUDAD%'))"
prueba() { curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$1"; }

procesa() { # ciudad | provincia mayoritaria
  C="$1"; PROV="$2"
  echo "### $C  (provincia $PROV)"
  CENTRO="POINT((SELECT AVG(lng) FROM accommodation WHERE BINARY city=BINARY '$C'),(SELECT AVG(lat) FROM accommodation WHERE BINARY city=BINARY '$C'))"
  echo "  -- zonas del entorno (distancia real, aloj/exp/serv) --"
  Q "SELECT CONCAT('     ',l.nombre,' | ',l.alojamientos,'/',l.experiencias,'/',l.servicios,' | ',
       ROUND(ST_Distance_Sphere(POINT(AVG(a.lng),AVG(a.lat)), $CENTRO)/1000,1),' km')
     FROM localidad_slug l JOIN accommodation a ON BINARY a.city=BINARY l.nombre
     WHERE BINARY l.nombre<>BINARY '$C' AND a.lat IS NOT NULL AND l.total>=5
     GROUP BY l.nombre,l.alojamientos,l.experiencias,l.servicios
     HAVING ST_Distance_Sphere(POINT(AVG(a.lng),AVG(a.lat)), $CENTRO)/1000 < 12
     ORDER BY 1 LIMIT 6"
  echo "  -- alojamientos publicados (2 por tipo principal, con nombre y provincia) --"
  for T in $(Q "SELECT type FROM accommodation WHERE status='published' AND BINARY city=BINARY '$C' AND BINARY province=BINARY '$PROV' GROUP BY type ORDER BY COUNT(*) DESC LIMIT 3"); do
    TE=$(printf '%s' "$T" | sed "s/'/''/g")
    Q "SELECT CONCAT(a.type,' | ',a.title,' | ',a.slug,' | ',a.province) FROM accommodation a
       WHERE a.status='published' AND BINARY a.city=BINARY '$C' AND BINARY a.province=BINARY '$PROV' AND BINARY a.type=BINARY '$TE'
       ORDER BY EXISTS(SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=a.id) DESC,
                (SELECT COUNT(*) FROM accommodation_amenity m WHERE m.accommodation_id=a.id) DESC, a.id LIMIT 2" > /tmp/l.txt
    while IFS='|' read -r tt nom sl pv; do
      sl=$(printf '%s' "$sl" | tr -d ' '); [ -z "$sl" ] && continue
      echo "     $tt|$nom|HTTP $(prueba "https://hestiat.com/alojamiento/$sl")|$sl"
    done < /tmp/l.txt
  done
  echo "  -- experiencias activas (4, con nombre y categoría) --"
  Q "SELECT CONCAT(name,'|',COALESCE(category,'—'),'|',slug,'|',municipality) FROM experiencia
     WHERE is_active=1 AND BINARY municipality=BINARY '$C' AND COALESCE(slug,'')<>''
     ORDER BY COALESCE(completeness,0) DESC, id LIMIT 4" > /tmp/e.txt
  while IFS='|' read -r nom cat sl mu; do
    sl=$(printf '%s' "$sl" | tr -d ' '); [ -z "$sl" ] && continue
    echo "     $cat|$nom|HTTP $(prueba "https://hestiat.com/experiencias/$sl")|$sl"
  done < /tmp/e.txt
  echo "  -- servicios activos útiles para viajar (2) --"
  Q "SELECT CONCAT(name,'|',COALESCE(category,'—'),'|',slug) FROM servicio_turistico
     WHERE is_active=1 AND BINARY municipality=BINARY '$C' AND COALESCE(slug,'')<>''
       AND category IN ('Viaje y comodidad','Servicios para el alojamiento','Outdoor y aventura','Deporte y fitness','Comida y catering','Agua','Transporte')
     ORDER BY rating DESC, id LIMIT 2" > /tmp/s.txt
  while IFS='|' read -r nom cat sl; do
    sl=$(printf '%s' "$sl" | tr -d ' '); [ -z "$sl" ] && continue
    echo "     $cat|$nom|HTTP $(prueba "https://hestiat.com/servicios/$sl")|$sl"
  done < /tmp/s.txt
}

case "$1" in
  a) procesa "Barcelona" "Barcelona"; procesa "Málaga" "Málaga"; procesa "Sevilla" "Sevilla"; procesa "Córdoba" "Córdoba"; procesa "Burgos" "Burgos"; procesa "Bilbao" "Bizkaia/Vizcaya";;
  b) procesa "Santander" "Cantabria"; procesa "Salamanca" "Salamanca"; procesa "València" "València/Valencia"; procesa "Zaragoza" "Zaragoza"; procesa "Benidorm" "Alacant/Alicante"; procesa "A Coruña" "A Coruña";;
esac
