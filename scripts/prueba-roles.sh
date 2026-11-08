#!/usr/bin/env bash
# Prueba real: ¿quién ve el botón de edición y qué protege el servidor?
set -u
U=$(grep '^DB_USER=' /opt/hestiat/shared/.env | cut -d= -f2-)
P=$(grep '^DB_PASSWORD=' /opt/hestiat/shared/.env | cut -d= -f2-)
TOK="pruebaadmin$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"

echo "== ¿está el botón en el paquete desplegado? =="
grep -rl "Editar publicaci" /opt/hestiat/app/.next/server/ 2>/dev/null | head -3 || echo "  (no aparece en el servidor compilado)"
grep -rl "BotonEditarAdmin\|boton-editar-admin" /opt/hestiat/app/.next/server/ 2>/dev/null | head -2 || true

echo
echo "== crear sesión de administrador =="
printf "INSERT INTO usuario_sesion (token,usuario_id,expira_en,user_agent) VALUES ('%s',3,DATE_ADD(NOW(),INTERVAL 15 MINUTE),'prueba-rol');" "$TOK" > /tmp/s.sql
mariadb -u"$U" -p"$P" hestiat < /tmp/s.sql
echo "  sesiones con ese token: $(mariadb -u"$U" -p"$P" -N -B hestiat -e "SELECT COUNT(*) FROM usuario_sesion WHERE token='$TOK'")"
echo "  usuario 3: $(mariadb -u"$U" -p"$P" -N -B hestiat -e "SELECT rol FROM usuario WHERE id=3")"

SLUG=$(mariadb -u"$U" -p"$P" -N -B hestiat2 -e "SELECT slug FROM accommodation WHERE legacy_id IS NOT NULL AND status='published' LIMIT 1")
EID=$(mariadb -u"$U" -p"$P" -N -B hestiat2 -e "SELECT id FROM experiencia WHERE is_active=1 LIMIT 1")
ESLUG=$(mariadb -u"$U" -p"$P" -N -B hestiat2 -e "SELECT slug FROM experiencia WHERE id=$EID")
echo
echo "== ficha de alojamiento /alojamiento/$SLUG =="
echo "  con sesión de admin  → botón: $(curl -sS --max-time 30 -H "Cookie: hestiat_sesion=$TOK" "https://hestiat.com/alojamiento/$SLUG" | grep -c 'Editar publicaci')"
echo "  sin sesión           → botón: $(curl -sS --max-time 30 "https://hestiat.com/alojamiento/$SLUG" | grep -c 'Editar publicaci')"
echo "== ficha de experiencia /experiencias/$ESLUG =="
echo "  con sesión de admin  → botón: $(curl -sS --max-time 30 -H "Cookie: hestiat_sesion=$TOK" "https://hestiat.com/experiencias/$ESLUG" | grep -c 'Editar publicaci')"
echo "  sin sesión           → botón: $(curl -sS --max-time 30 "https://hestiat.com/experiencias/$ESLUG" | grep -c 'Editar publicaci')"
echo
echo "== protección del editor de experiencias =="
echo "  sin sesión     → $(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "https://hestiat.com/admin/editar/experiencia/$EID")"
echo "  con admin      → $(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 -H "Cookie: hestiat_sesion=$TOK" "https://hestiat.com/admin/editar/experiencia/$EID")"
echo "== protección de la API de edición =="
echo "  sin sesión     → $(curl -sS -o /dev/null -w '%{http_code}' -X POST --data-urlencode "tipo=experiencia" --data-urlencode "id=$EID" --data-urlencode "nombre=Prueba sin permiso" --max-time 25 "https://hestiat.com/api/admin/catalogo")"
echo "  con admin (mismo nombre, sin cambios) → $(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Cookie: hestiat_sesion=$TOK" --data-urlencode "tipo=experiencia" --data-urlencode "id=$EID" --data-urlencode "nombre=$(mariadb -u"$U" -p"$P" -N -B hestiat2 -e "SELECT name FROM experiencia WHERE id=$EID")" --max-time 25 "https://hestiat.com/api/admin/catalogo")"
echo "  nombre de la experiencia tras la prueba: $(mariadb -u"$U" -p"$P" -N -B hestiat2 -e "SELECT LEFT(name,40) FROM experiencia WHERE id=$EID")"
mariadb -u"$U" -p"$P" hestiat -e "DELETE FROM usuario_sesion WHERE token='$TOK'"
echo "  (sesión de prueba borrada)"
