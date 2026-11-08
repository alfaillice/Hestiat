#!/bin/bash
# Comprueba de verdad los límites nuevos de /api/medios: ráfaga de peticiones y tope de ids.
set -u
U=$(grep "^DB_USER=" /opt/hestiat/shared/.env | cut -d= -f2-)
P=$(grep "^DB_PASSWORD=" /opt/hestiat/shared/.env | cut -d= -f2-)
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }
T=$(openssl rand -hex 32)
L "INSERT INTO usuario_sesion (token, usuario_id, expira_en, user_agent) VALUES ('$T', 3, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 'prueba-limites')"

echo "== A. RAFAGA: 150 peticiones a la vez, mismo segundo =="
seq 1 150 | xargs -P 30 -I{} curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Cookie: hestiat_sesion=$T" -H 'Content-Type: application/json' \
  -d '{"accion":"reordenar","alojamientoId":9,"ids":[]}' https://hestiat.com/api/medios \
  | sort | uniq -c | sed 's/^/   /'
echo "   (429 = el tope de ritmo corta; 200/401 = pasan)"

echo
echo "== B. TOPE DE IDENTIFICADORES (con sesión de administración válida) =="
printf "   600 identificadores -> %s (400 esperado)\n" "$(curl -s -o /tmp/r1.json -w '%{http_code}' -X POST -H "Cookie: hestiat_sesion=$T" -H 'Content-Type: application/json' -d "{\"accion\":\"reordenar\",\"alojamientoId\":9,\"ids\":[$(seq -s, 1 600)]}" https://hestiat.com/api/medios) $(head -c 90 /tmp/r1.json)"
printf "   3 identificadores   -> %s (200 esperado)\n" "$(curl -s -o /tmp/r2.json -w '%{http_code}' -X POST -H "Cookie: hestiat_sesion=$T" -H 'Content-Type: application/json' -d '{"accion":"reordenar","alojamientoId":9,"ids":[]}' https://hestiat.com/api/medios) $(head -c 60 /tmp/r2.json)"

echo
echo "== C. fotos del alojamiento 9 (sin cambios) =="
echo "   $(L 'SELECT COUNT(*) FROM alojamiento_foto WHERE alojamiento_id=9') fotos · orden $(L 'SELECT GROUP_CONCAT(orden ORDER BY orden) FROM alojamiento_foto WHERE alojamiento_id=9')"

L "DELETE FROM usuario_sesion WHERE token='$T'"
echo "   sesión de prueba borrada: $(L "SELECT COUNT(*) FROM usuario_sesion WHERE token='$T'")"
