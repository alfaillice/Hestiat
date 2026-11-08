#!/bin/bash
# Distribución de uso de las imágenes de experiencias y servicios, y rendimiento actual.
# Se ejecuta EN EL SERVIDOR.
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" "$ENVF" | cut -d= -f2-)
P=$(grep "^DB_PASSWORD=" "$ENVF" | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }

echo "=== CUÁNTAS VECES SE REPITE CADA IMAGEN (servicios) ==="
Q "SELECT CONCAT('   imágenes distintas: ', COUNT(*), ' · uso medio: ', ROUND(AVG(n)), ' fichas por imagen · la más usada: ', MAX(n)) FROM (SELECT main_image, COUNT(*) n FROM servicio_turistico WHERE COALESCE(main_image,'')<>'' GROUP BY main_image) t"
for umbral in 5 20 50 100; do
  Q "SELECT CONCAT('   servicios cuya imagen la usan <= $umbral fichas: ', COUNT(*)) FROM servicio_turistico s JOIN (SELECT main_image m, COUNT(*) n FROM servicio_turistico WHERE COALESCE(main_image,'')<>'' GROUP BY main_image) g ON g.m = s.main_image WHERE s.is_active=1 AND g.n <= $umbral"
done

echo "=== LO MISMO EN EXPERIENCIAS ==="
Q "SELECT CONCAT('   imágenes distintas: ', COUNT(*), ' · uso medio: ', ROUND(AVG(n)), ' fichas por imagen · la más usada: ', MAX(n)) FROM (SELECT main_image, COUNT(*) n FROM experiencia WHERE COALESCE(main_image,'')<>'' GROUP BY main_image) t"
for umbral in 5 20 50 100; do
  Q "SELECT CONCAT('   experiencias cuya imagen la usan <= $umbral fichas: ', COUNT(*)) FROM experiencia e JOIN (SELECT main_image m, COUNT(*) n FROM experiencia WHERE COALESCE(main_image,'')<>'' GROUP BY main_image) g ON g.m = e.main_image WHERE e.is_active=1 AND g.n <= $umbral"
done

echo "=== Y CON EL CRITERIO COMPLETO (imagen poco compartida + descripción + contacto/coordenadas) ==="
for umbral in 20 50; do
  Q "SELECT CONCAT('   SERVICIOS aptos con umbral $umbral: ', COUNT(*)) FROM servicio_turistico s JOIN (SELECT main_image m, COUNT(*) n FROM servicio_turistico WHERE COALESCE(main_image,'')<>'' GROUP BY main_image) g ON g.m = s.main_image WHERE s.is_active=1 AND g.n <= $umbral AND CHAR_LENGTH(COALESCE(s.short_description,''))>=120 AND (COALESCE(s.website_url,'')<>'' OR COALESCE(s.phone,'')<>'' OR COALESCE(s.email,'')<>'')"
  Q "SELECT CONCAT('   EXPERIENCIAS aptas con umbral $umbral: ', COUNT(*)) FROM experiencia e JOIN (SELECT main_image m, COUNT(*) n FROM experiencia WHERE COALESCE(main_image,'')<>'' GROUP BY main_image) g ON g.m = e.main_image WHERE e.is_active=1 AND g.n <= $umbral AND CHAR_LENGTH(COALESCE(e.short_description,e.description,''))>=120 AND e.latitude IS NOT NULL"
done

echo "=== RENDIMIENTO (medido ahora) ==="
for u in "/" "/destino/madrid" "/alojamiento/gemas-beach" "/experiencias" "/servicios"; do
  printf "   %-28s TTFB %ss · total %ss · %s KB\n" "$u" \
    "$(curl -s -o /dev/null -w '%{time_starttransfer}' --max-time 40 https://hestiat.com$u)" \
    "$(curl -s -o /dev/null -w '%{time_total}' --max-time 40 https://hestiat.com$u)" \
    "$(curl -s -o /dev/null -w '%{size_download}' --max-time 40 https://hestiat.com$u | awk '{print int($1/1024)}')"
done
echo "=== CORE WEB VITALS de visitantes reales (registro propio de la web) ==="
grep -h "\[vitales\]" /var/log/hestiat/*.log 2>/dev/null | tail -5 | sed 's/^/   /'
echo "   muestras totales: $(grep -hc '\[vitales\]' /var/log/hestiat/*.log 2>/dev/null | paste -sd+ | bc)"
