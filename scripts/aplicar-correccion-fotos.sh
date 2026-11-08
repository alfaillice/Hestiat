#!/bin/bash
# Aplica la corrección de las 6 referencias que son PÁGINAS de Commons, verifica que cargan,
# prueba que se puede revertir y vuelve a aplicar. Todo queda registrado en foto_url_correccion.
set -u
U=$(grep "^DB_USER=" /opt/hestiat/shared/.env | cut -d= -f2-)
P=$(grep "^DB_PASSWORD=" /opt/hestiat/shared/.env | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }

echo "=== ANTES: las 6 referencias ==="
L "SELECT CONCAT('   alojamiento ', alojamiento_id, ' → ', LEFT(url,84)) FROM alojamiento_foto WHERE url LIKE '%/wiki/File:%'"

echo
echo "=== APLICANDO (con comprobación de identidad contra la API de Commons) ==="
cd /root && python3 corregir-fotos-commons.py --limite 6

echo
echo "=== DESPUÉS: ¿qué guarda ahora la base? ==="
L "SELECT CONCAT('   alojamiento ', alojamiento_id, ' → ', LEFT(url,84)) FROM alojamiento_foto WHERE alojamiento_id IN (16444,20457,21589,21826,22304,24276)"
echo "   quedan páginas de Commons sin corregir: $(L "SELECT COUNT(*) FROM alojamiento_foto WHERE url LIKE '%/wiki/File:%'")"

echo
echo "=== ¿CARGAN COMO IMAGEN AHORA? (siguiendo la redirección) ==="
for u in $(Q "SELECT url_nueva FROM foto_url_correccion WHERE revertida_en IS NULL"); do
  printf "   %s %s\n" "$(curl -sSL -o /dev/null -w '%{http_code}|%{content_type}' --max-time 30 -A 'Mozilla/5.0' -H 'Referer: https://hestiat.com/' "$u")" "${u:0:60}"
done

echo
echo "=== PRUEBA DE REVERSIÓN (que se puede deshacer) ==="
cd /root && python3 corregir-fotos-commons.py --revertir
echo "   tras revertir:"
L "SELECT CONCAT('   alojamiento ', alojamiento_id, ' → ', LEFT(url,84)) FROM alojamiento_foto WHERE alojamiento_id IN (16444,20457,21589,21826,22304,24276)"
echo "   páginas de Commons de nuevo en la base: $(L "SELECT COUNT(*) FROM alojamiento_foto WHERE url LIKE '%/wiki/File:%'")"
echo "   registros marcados como revertidos: $(Q "SELECT COUNT(*) FROM foto_url_correccion WHERE revertida_en IS NOT NULL")"

echo
echo "=== VOLVIENDO A APLICAR (estado definitivo) ==="
cd /root && python3 corregir-fotos-commons.py --limite 6
echo "   páginas de Commons que quedan: $(L "SELECT COUNT(*) FROM alojamiento_foto WHERE url LIKE '%/wiki/File:%'")"

echo
echo "=== REGISTRO DE CAMBIOS (primero y último) ==="
Q "SELECT CONCAT('   id ', id, ' · alojamiento ', alojamiento_id, ' · ', LEFT(url_original,50), ' → ', LEFT(url_nueva,50), ' · ', mime, ' · filas afectadas ', filas_afectadas, ' · revertida: ', COALESCE(DATE_FORMAT(revertida_en,'%H:%i:%s'),'no')) FROM foto_url_correccion ORDER BY id LIMIT 2"
Q "SELECT CONCAT('   total de registros en el historial: ', COUNT(*)) FROM foto_url_correccion"
