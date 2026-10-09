#!/bin/bash
# Prueba real de /api/medios por roles, con limpieza. Sin tocar datos de producción.
set -u
U=$(grep "^DB_USER=" /opt/hestiat/shared/.env | cut -d= -f2-)
P=$(grep "^DB_PASSWORD=" /opt/hestiat/shared/.env | cut -d= -f2-)
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }
WEB=https://hestiat.com

T2=$(openssl rand -hex 32)
T3=$(openssl rand -hex 32)
L "INSERT INTO usuario_sesion (token, usuario_id, expira_en, user_agent) VALUES ('$T2', 2, DATE_ADD(NOW(), INTERVAL 1 HOUR), 'prueba'), ('$T3', 3, DATE_ADD(NOW(), INTERVAL 1 HOUR), 'prueba')"

echo "fotos del alojamiento 9 ANTES: $(L 'SELECT COUNT(*) FROM alojamiento_foto WHERE alojamiento_id=9')"

code() { curl -sS -o /tmp/salida.json -w "%{http_code}" "$@"; }
post() { # token, json
  code -X POST -H "Cookie: hestiat_sesion=$1" -H 'Content-Type: application/json' -d "$2" $WEB/api/medios
}

echo "--- PERMISOS ---"
printf "  sin sesion                  -> %s (401 esperado)\n" "$(post NADA '{"accion":"reordenar","alojamientoId":9,"ids":[]}')"
printf "  anfitriona 2, la suya (9)   -> %s (200 esperado)\n" "$(post $T2 '{"accion":"reordenar","alojamientoId":9,"ids":[]}')"
printf "  anfitriona 2, la ajena      -> %s (403 esperado)\n" "$(post $T2 '{"accion":"reordenar","alojamientoId":109438,"ids":[]}')"
printf "  admin 3, la de otra         -> %s (200 esperado)\n" "$(post $T3 '{"accion":"reordenar","alojamientoId":9,"ids":[]}')"
printf "  accion no reconocida        -> %s (400 esperado)\n" "$(post $T3 '{"accion":"loquesea","alojamientoId":9}')"
printf "  alojamiento no numerico     -> %s (400 esperado)\n" "$(post $T3 '{"accion":"reordenar","alojamientoId":"abc","ids":[]}')"

echo "--- LIMITES ---"
printf "  cuerpo de 9 MB              -> %s\n" "$(python3 - <<'PY'
import json,urllib.request
d=json.dumps({"accion":"reordenar","alojamientoId":9,"ids":[1]*900000}).encode()
open('/tmp/gordo.json','wb').write(d)
PY
code -X POST -H "Cookie: hestiat_sesion=$T3" -H 'Content-Type: application/json' --data-binary @/tmp/gordo.json $WEB/api/medios) (bytes enviados: $(wc -c < /tmp/gordo.json))"
printf "  60 peticiones seguidas      -> 429: %s de 60\n" "$(for i in $(seq 1 60); do curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H "Cookie: hestiat_sesion=$T3" -H 'Content-Type: application/json' -d '{"accion":"reordenar","alojamientoId":9,"ids":[]}' $WEB/api/medios; done | grep -c 429)"

echo "--- SUBIDA REAL (1x1 PNG) ---"
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==' | base64 -d > /tmp/prueba.png
printf 'no soy una imagen' > /tmp/prueba.txt
printf "  subir PNG como admin        -> %s %s\n" "$(code -X PUT -H "Cookie: hestiat_sesion=$T3" -F "alojamientoId=9" -F "fotos=@/tmp/prueba.png;type=image/png" $WEB/api/medios)" "$(head -c 120 /tmp/salida.json)"
FOTO=$(python3 -c "import json;print(json.load(open('/tmp/salida.json')).get('guardadas',[{}])[0].get('id',''))" 2>/dev/null)
printf "  fichero que no es imagen    -> %s %s\n" "$(code -X PUT -H "Cookie: hestiat_sesion=$T3" -F "alojamientoId=9" -F "fotos=@/tmp/prueba.txt;type=text/plain" $WEB/api/medios)" "$(head -c 90 /tmp/salida.json)"
printf "  subir sin sesion            -> %s (401 esperado)\n" "$(code -X PUT -F "alojamientoId=9" -F "fotos=@/tmp/prueba.png;type=image/png" $WEB/api/medios)"
echo "  fotos tras subir: $(L 'SELECT COUNT(*) FROM alojamiento_foto WHERE alojamiento_id=9')"

echo "--- LIMPIEZA DE LA SUBIDA ---"
if [ -n "$FOTO" ]; then
  printf "  borrar la foto de prueba    -> %s %s\n" "$(post $T3 "{\"accion\":\"eliminar\",\"alojamientoId\":9,\"fotoId\":$FOTO}")" "$(head -c 90 /tmp/salida.json)"
fi
echo "fotos del alojamiento 9 DESPUES: $(L 'SELECT COUNT(*) FROM alojamiento_foto WHERE alojamiento_id=9')"
echo "orden del alojamiento 9: $(L 'SELECT GROUP_CONCAT(orden ORDER BY orden) FROM alojamiento_foto WHERE alojamiento_id=9')"

L "DELETE FROM usuario_sesion WHERE token IN ('$T2','$T3')"
echo "sesiones de prueba restantes: $(L "SELECT COUNT(*) FROM usuario_sesion WHERE token IN ('$T2','$T3')")"
rm -f /tmp/gordo.json /tmp/prueba.png /tmp/prueba.txt
