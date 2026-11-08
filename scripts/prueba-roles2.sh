#!/usr/bin/env bash
# Prueba del botón y de la protección, con un token de 64 caracteres (el formato real de la app).
set -u
U=$(grep '^DB_USER=' /opt/hestiat/shared/.env | cut -d= -f2-)
P=$(grep '^DB_PASSWORD=' /opt/hestiat/shared/.env | cut -d= -f2-)
M() { mariadb -u"$U" -p"$P" -N -B "$@"; }

ADMIN=$(M hestiat -e "SELECT id FROM usuario WHERE rol='admin' AND activo=1 LIMIT 1")
HUESPED=$(M hestiat -e "SELECT id FROM usuario WHERE rol='huesped' AND activo=1 LIMIT 1")
ANFITRION=$(M hestiat -e "SELECT id FROM usuario WHERE rol='anfitrion' AND activo=1 LIMIT 1")
TOK_A=$(openssl rand -hex 32)
TOK_H=$(openssl rand -hex 32)
TOK_F=$(openssl rand -hex 32)

for par in "$TOK_A:$ADMIN" "$TOK_H:$HUESPED" "$TOK_F:$ANFITRION"; do
  t=${par%%:*}; i=${par##*:}
  M hestiat -e "INSERT INTO usuario_sesion (token,usuario_id,expira_en,user_agent) VALUES ('$t',$i,DATE_ADD(NOW(),INTERVAL 15 MINUTE),'prueba-roles2')"
done
echo "sesiones creadas (64 caracteres): $(M hestiat -e "SELECT COUNT(*) FROM usuario_sesion WHERE user_agent='prueba-roles2'")"
echo "longitud de los tokens: $(echo -n "$TOK_A" | wc -c) caracteres"

SLUG=$(M hestiat2 -e "SELECT slug FROM accommodation WHERE legacy_id IS NOT NULL AND status='published' LIMIT 1")
EID=$(M hestiat2 -e "SELECT id FROM experiencia WHERE is_active=1 LIMIT 1")
ESLUG=$(M hestiat2 -e "SELECT slug FROM experiencia WHERE id=$EID")
SID=$(M hestiat2 -e "SELECT id FROM servicio_turistico WHERE is_active=1 LIMIT 1")
echo
echo "== BOTÓN «Editar publicación» en las fichas =="
printf "  alojamiento · administrador → %s apariciones\n" "$(curl -sS --max-time 30 -H "Cookie: hestiat_sesion=$TOK_A" "https://hestiat.com/alojamiento/$SLUG" | grep -c 'Editar publicaci')"
printf "  alojamiento · visitante     → %s apariciones\n" "$(curl -sS --max-time 30 "https://hestiat.com/alojamiento/$SLUG" | grep -c 'Editar publicaci')"
printf "  alojamiento · anfitrión     → %s apariciones\n" "$(curl -sS --max-time 30 -H "Cookie: hestiat_sesion=$TOK_F" "https://hestiat.com/alojamiento/$SLUG" | grep -c 'Editar publicaci')"
printf "  experiencia · administrador → %s apariciones\n" "$(curl -sS --max-time 30 -H "Cookie: hestiat_sesion=$TOK_A" "https://hestiat.com/experiencias/$ESLUG" | grep -c 'Editar publicaci')"
printf "  experiencia · visitante     → %s apariciones\n" "$(curl -sS --max-time 30 "https://hestiat.com/experiencias/$ESLUG" | grep -c 'Editar publicaci')"
printf "  servicio    · administrador → %s apariciones\n" "$(curl -sS --max-time 30 -H "Cookie: hestiat_sesion=$TOK_A" "https://hestiat.com/servicios/$(M hestiat2 -e "SELECT slug FROM servicio_turistico WHERE id=$SID")" | grep -c 'Editar publicaci')"
echo
echo "== EDITOR DE EXPERIENCIA /admin/editar/experiencia/$EID =="
printf "  sin sesión     → %s\n" "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "https://hestiat.com/admin/editar/experiencia/$EID")"
printf "  usuario normal → %s\n" "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 -H "Cookie: hestiat_sesion=$TOK_H" "https://hestiat.com/admin/editar/experiencia/$EID")"
printf "  anfitrión      → %s\n" "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 -H "Cookie: hestiat_sesion=$TOK_F" "https://hestiat.com/admin/editar/experiencia/$EID")"
printf "  administrador  → %s (200 = editor abierto)\n" "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 -H "Cookie: hestiat_sesion=$TOK_A" "https://hestiat.com/admin/editar/experiencia/$EID")"
echo
echo "== API DE EDICIÓN /api/admin/catalogo =="
NOMBRE=$(M hestiat2 -e "SELECT name FROM experiencia WHERE id=$EID")
printf "  sin sesión     → %s\n" "$(curl -sS -o /dev/null -w '%{http_code}' -X POST --data-urlencode "tipo=experiencia" --data-urlencode "id=$EID" --data-urlencode "nombre=Prueba" --max-time 25 "https://hestiat.com/api/admin/catalogo")"
printf "  usuario normal → %s\n" "$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Cookie: hestiat_sesion=$TOK_H" --data-urlencode "tipo=experiencia" --data-urlencode "id=$EID" --data-urlencode "nombre=Prueba" --max-time 25 "https://hestiat.com/api/admin/catalogo")"
printf "  administrador (mismo nombre) → %s\n" "$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Cookie: hestiat_sesion=$TOK_A" --data-urlencode "tipo=experiencia" --data-urlencode "id=$EID" --data-urlencode "nombre=$NOMBRE" --max-time 25 "https://hestiat.com/api/admin/catalogo")"
echo "  nombre tras la prueba: $(M hestiat2 -e "SELECT LEFT(name,40) FROM experiencia WHERE id=$EID") (debe seguir igual)"
M hestiat -e "DELETE FROM usuario_sesion WHERE user_agent='prueba-roles2'"
echo "  (sesiones de prueba borradas)"
