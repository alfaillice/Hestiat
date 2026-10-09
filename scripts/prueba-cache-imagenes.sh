#!/bin/bash
# Comprueba que las imágenes NUEVAS se suben con cabecera de caché. Sube una y la borra.
set -u
U=$(grep "^DB_USER=" /opt/hestiat/shared/.env | cut -d= -f2-)
P=$(grep "^DB_PASSWORD=" /opt/hestiat/shared/.env | cut -d= -f2-)
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }
T=$(openssl rand -hex 32)
L "INSERT INTO usuario_sesion (token, usuario_id, expira_en, user_agent) VALUES ('$T', 3, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 'prueba-cache')"

echo "fotos del alojamiento 9 antes: $(L 'SELECT COUNT(*) FROM alojamiento_foto WHERE alojamiento_id=9')"
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==' | base64 -d > /tmp/cc.png
curl -s -o /tmp/cc.json -X PUT -H "Cookie: hestiat_sesion=$T" -F "alojamientoId=9" -F "fotos=@/tmp/cc.png;type=image/png" https://hestiat.com/api/medios
ID=$(python3 -c "import json;print(json.load(open('/tmp/cc.json'))['guardadas'][0]['id'])" 2>/dev/null)
URL=$(python3 -c "import json;print(json.load(open('/tmp/cc.json'))['guardadas'][0]['url'])" 2>/dev/null)
echo "subida: id=$ID"
echo "cabeceras del objeto recién subido:"
curl -sSI --max-time 25 "$URL" | grep -iE "^(HTTP|cache-control|content-type|etag)" | sed 's/^/   /'
curl -s -o /tmp/del.json -X POST -H "Cookie: hestiat_sesion=$T" -H 'Content-Type: application/json' -d "{\"accion\":\"eliminar\",\"alojamientoId\":9,\"fotoId\":$ID}" https://hestiat.com/api/medios
echo "borrada: $(head -c 60 /tmp/del.json)"
echo "fotos del alojamiento 9 después: $(L 'SELECT COUNT(*) FROM alojamiento_foto WHERE alojamiento_id=9') · orden $(L 'SELECT GROUP_CONCAT(orden ORDER BY orden) FROM alojamiento_foto WHERE alojamiento_id=9')"
L "DELETE FROM usuario_sesion WHERE token='$T'"
echo "sesión de prueba borrada: $(L "SELECT COUNT(*) FROM usuario_sesion WHERE token='$T'")"
rm -f /tmp/cc.png /tmp/cc.json
