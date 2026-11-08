#!/bin/bash
# 1) Prueba que la corrección se puede revertir (en las TRES tablas) y la vuelve a aplicar.
# 2) Retira la referencia huérfana a R2 del alojamiento 109437, guardando cómo recuperarla.
set -u
U=$(grep "^DB_USER=" /opt/hestiat/shared/.env | cut -d= -f2-)
P=$(grep "^DB_PASSWORD=" /opt/hestiat/shared/.env | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }

ver() { # comprueba las tres tablas para un alojamiento
  A=$1
  echo "   hestiat.alojamiento_foto    : $(L "SELECT LEFT(url,58) FROM alojamiento_foto WHERE alojamiento_id=$A LIMIT 1")"
  echo "   hestiat2.alojamiento_foto   : $(Q "SELECT LEFT(url,58) FROM alojamiento_foto WHERE alojamiento_id=$A LIMIT 1")"
  echo "   accommodation_photo (público): $(Q "SELECT LEFT(COALESCE(origin_url,storage_key),58) FROM accommodation_photo WHERE accommodation_id=(SELECT id FROM accommodation WHERE legacy_id=$A) LIMIT 1")"
}

echo "=== ESTADO ACTUAL (corregido) · alojamiento 16444 ==="
ver 16444

echo
echo "=== REVIRTIENDO (prueba) ==="
cd /root && python3 corregir-fotos-commons.py --revertir

echo
echo "=== ¿VOLVIERON LAS ORIGINALES en las tres tablas? ==="
ver 16444
echo "   páginas de Commons presentes: $(L "SELECT COUNT(*) FROM alojamiento_foto WHERE url LIKE '%/wiki/File:%'")"

echo
echo "=== VOLVIENDO A APLICAR ==="
cd /root && python3 corregir-fotos-commons.py --limite 6
echo
echo "=== ESTADO DEFINITIVO en las tres tablas ==="
ver 16444
echo "   páginas de Commons que quedan: $(L "SELECT COUNT(*) FROM alojamiento_foto WHERE url LIKE '%/wiki/File:%'")"
Q "SELECT CONCAT('   historial: ', COUNT(*), ' correcciones · ', SUM(revertida_en IS NOT NULL), ' marcadas como revertidas en la prueba') FROM foto_url_correccion"

echo
echo "=== REFERENCIA HUÉRFANA A R2 (alojamiento 109437) ==="
URL=$(L "SELECT url FROM alojamiento_foto WHERE alojamiento_id=109437 AND url LIKE '%0b722989%' LIMIT 1")
echo "   URL: ${URL:0:90}"
echo "   ¿existe el objeto? (bucket público): $(curl -sSI -o /dev/null -w '%{http_code}' --max-time 25 "$URL") (404 = no existe)"
FILA=$(L "SELECT CONCAT('id=', id, ' · orden=', orden, ' · alt=', COALESCE(alt,'(vacío)'), ' · ancho=', COALESCE(ancho,0), ' · alto=', COALESCE(alto,0)) FROM alojamiento_foto WHERE alojamiento_id=109437 AND url LIKE '%0b722989%' LIMIT 1")
echo "   fila antes de retirarla: $FILA"
N1=$(L "SELECT COUNT(*) FROM alojamiento_foto WHERE alojamiento_id=109437")
N2=$(Q "SELECT COUNT(*) FROM accommodation_photo WHERE accommodation_id=(SELECT id FROM accommodation WHERE legacy_id=109437)")
echo "   fotos del alojamiento: $N1 en el panel · $N2 en el catálogo público"

if [ "$(curl -sSI -o /dev/null -w '%{http_code}' --max-time 25 "$URL")" = "404" ]; then
  Q "INSERT INTO foto_url_correccion (tabla, alojamiento_id, url_original, url_nueva, procedencia, mime, verificado, filas_afectadas)
     VALUES ('hestiat.alojamiento_foto,hestiat2.accommodation_photo', 109437, '$(echo "$URL" | sed "s/'/''/g")', '',
     'Referencia HUERFANA retirada: el objeto no existe en el almacen (la URL publica devuelve 404). Fila original que se puede volver a crear: $FILA', '', 0, 1)"
  L "DELETE FROM alojamiento_foto WHERE alojamiento_id=109437 AND url LIKE '%0b722989%'"
  Q "DELETE FROM accommodation_photo WHERE accommodation_id=(SELECT id FROM accommodation WHERE legacy_id=109437) AND (origin_url LIKE '%0b722989%' OR storage_key LIKE '%0b722989%')"
  echo "   retirada en las dos tablas."
else
  echo "   NO se retira: el objeto existe, así que no es huérfana."
fi
echo "   fotos ahora: $(L "SELECT COUNT(*) FROM alojamiento_foto WHERE alojamiento_id=109437") en el panel · $(Q "SELECT COUNT(*) FROM accommodation_photo WHERE accommodation_id=(SELECT id FROM accommodation WHERE legacy_id=109437)") en el catálogo"
echo "   queda alguna referencia a ese objeto: $(L "SELECT COUNT(*) FROM alojamiento_foto WHERE url LIKE '%0b722989%'")"
