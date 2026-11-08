#!/bin/bash
# Tope de número de imágenes por subida (máximo 12). Sin dejar datos: no se llega a guardar nada.
set -u
U=$(grep "^DB_USER=" /opt/hestiat/shared/.env | cut -d= -f2-)
P=$(grep "^DB_PASSWORD=" /opt/hestiat/shared/.env | cut -d= -f2-)
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }
T=$(openssl rand -hex 32)
L "INSERT INTO usuario_sesion (token, usuario_id, expira_en, user_agent) VALUES ('$T', 3, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 'prueba-ficheros')"

echo "fotos del alojamiento 9 antes: $(L 'SELECT COUNT(*) FROM alojamiento_foto WHERE alojamiento_id=9')"
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==' | base64 -d > /tmp/pp.png
for i in $(seq 1 13); do cp /tmp/pp.png "/tmp/pp$i.png"; done

A=()
for i in $(seq 1 13); do A+=(-F "fotos=@/tmp/pp$i.png;type=image/png"); done
echo -n "13 imágenes en una petición -> "
curl -s -o /tmp/f13.json -w "%{http_code}" -X PUT -H "Cookie: hestiat_sesion=$T" -F "alojamientoId=9" "${A[@]}" https://hestiat.com/api/medios
echo " $(head -c 110 /tmp/f13.json)"

echo -n "2 imágenes en una petición  -> "
curl -s -o /tmp/f2.json -w "%{http_code}" -X PUT -H "Cookie: hestiat_sesion=$T" -F "alojamientoId=9" -F "fotos=@/tmp/pp1.png;type=image/png" -F "fotos=@/tmp/pp2.png;type=image/png" https://hestiat.com/api/medios
echo " $(head -c 200 /tmp/f2.json)"

echo "fotos del alojamiento 9 justo después: $(L 'SELECT COUNT(*) FROM alojamiento_foto WHERE alojamiento_id=9')"

# Si las 2 sí se guardaron (el tope es de 12), se borran para dejar el alojamiento como estaba.
for ID in $(python3 -c "import json;print(' '.join(str(g['id']) for g in json.load(open('/tmp/f2.json')).get('guardadas',[])))" 2>/dev/null); do
  echo -n "   borrando la foto $ID -> "
  curl -s -o /tmp/del.json -w "%{http_code}" -X POST -H "Cookie: hestiat_sesion=$T" -H 'Content-Type: application/json' -d "{\"accion\":\"eliminar\",\"alojamientoId\":9,\"fotoId\":$ID}" https://hestiat.com/api/medios
  echo " $(head -c 90 /tmp/del.json)"
done

echo "fotos del alojamiento 9 después: $(L 'SELECT COUNT(*) FROM alojamiento_foto WHERE alojamiento_id=9') · orden $(L 'SELECT GROUP_CONCAT(orden ORDER BY orden) FROM alojamiento_foto WHERE alojamiento_id=9')"
L "DELETE FROM usuario_sesion WHERE token='$T'"
echo "sesión de prueba borrada: $(L "SELECT COUNT(*) FROM usuario_sesion WHERE token='$T'")"
rm -f /tmp/pp*.png
