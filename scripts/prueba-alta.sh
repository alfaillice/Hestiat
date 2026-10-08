#!/usr/bin/env bash
# Prueba real del alta de proveedores: formulario → cola → aprobación → ficha en el catálogo → limpieza.
set -u
U=$(grep '^DB_USER=' /opt/hestiat/shared/.env | cut -d= -f2-)
P=$(grep '^DB_PASSWORD=' /opt/hestiat/shared/.env | cut -d= -f2-)
M() { mariadb -u"$U" -p"$P" -N -B "$@"; }
TOK=$(openssl rand -hex 32)
NOMBRE="PRUEBA Hestiat (dato de prueba, borrar)"

echo "== catálogo ANTES =="
M hestiat2 -e "SELECT CONCAT('experiencias: ', (SELECT COUNT(*) FROM experiencia), ' · servicios: ', (SELECT COUNT(*) FROM servicio_turistico), ' · solicitudes: ', (SELECT COUNT(*) FROM solicitud_catalogo))"

echo
echo "== 1. formulario público (sin sesión) =="
cat=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  --data-urlencode "tipo=experiencia" \
  --data-urlencode "nombre=$NOMBRE" \
  --data-urlencode "categoria=1" \
  --data-urlencode "descripcion=Alta de prueba del sistema. Se borra después de comprobar que funciona." \
  --data-urlencode "municipio=Alicante" --data-urlencode "provincia=Alicante" \
  --data-urlencode "direccion=Partida Carrus P1-137" --data-urlencode "web=https://hestiat.com" \
  --data-urlencode "telefono=600000000" --data-urlencode "email=prueba@hestiat.com" \
  --data-urlencode "precio=15" --data-urlencode "organizador=Prueba" \
  --max-time 30 "https://hestiat.com/api/solicitudes")
echo "  respuesta: $cat (303 = aceptada y redirigida)"
SID=$(M hestiat2 -e "SELECT id FROM solicitud_catalogo WHERE nombre='$NOMBRE' ORDER BY id DESC LIMIT 1")
echo "  solicitud guardada: id=$SID · estado=$(M hestiat2 -e "SELECT estado FROM solicitud_catalogo WHERE id=$SID")"

echo
echo "== 2. trampa antispam (debe descartarse sin guardar) =="
curl -sS -o /dev/null --max-time 25 -X POST --data-urlencode "tipo=servicio" --data-urlencode "nombre=BOT" --data-urlencode "web_extra=spam" --data-urlencode "municipio=X" --data-urlencode "provincia=Y" --data-urlencode "email=bot@bot.com" "https://hestiat.com/api/solicitudes"
echo "  solicitudes con nombre BOT: $(M hestiat2 -e "SELECT COUNT(*) FROM solicitud_catalogo WHERE nombre='BOT'") (debe ser 0)"

echo
echo "== 3. aprobación (solo administrador) =="
printf "INSERT INTO usuario_sesion (token,usuario_id,expira_en,user_agent) VALUES ('%s',3,DATE_ADD(NOW(),INTERVAL 15 MINUTE),'prueba-alta');" "$TOK" > /tmp/s2.sql
mariadb -u"$U" -p"$P" hestiat < /tmp/s2.sql
echo "  sin sesión     → $(curl -sS -o /dev/null -w '%{http_code}' -X POST --data-urlencode "id=$SID" --data-urlencode "accion=aprobar" --max-time 25 "https://hestiat.com/api/admin/solicitudes")"
echo "  con admin      → $(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Cookie: hestiat_sesion=$TOK" --data-urlencode "id=$SID" --data-urlencode "accion=aprobar" --max-time 30 "https://hestiat.com/api/admin/solicitudes")"
NUEVO=$(M hestiat2 -e "SELECT item_id FROM solicitud_catalogo WHERE id=$SID")
echo "  solicitud: estado=$(M hestiat2 -e "SELECT estado FROM solicitud_catalogo WHERE id=$SID") · ficha creada: experiencia #$NUEVO"
echo "  ficha: $(M hestiat2 -e "SELECT CONCAT(name, ' | ', municipality, ' | ', province, ' | precio ', price, ' | ', price_type, ' | activa ', is_active, ' | fuente ', source_name) FROM experiencia WHERE id=$NUEVO")"
echo "  clasificación: $(M hestiat2 -e "SELECT CONCAT('categoría ', categoria_id, ' · ', confianza, ' · ', origen) FROM experiencia_clasificacion WHERE experiencia_id=$NUEVO")"

echo
echo "== 4. limpieza del dato de prueba (el catálogo vuelve a su estado exacto) =="
M hestiat2 -e "DELETE FROM experiencia_clasificacion WHERE experiencia_id=$NUEVO; DELETE FROM experiencia WHERE id=$NUEVO; DELETE FROM solicitud_catalogo WHERE id=$SID;"
M hestiat -e "DELETE FROM usuario_sesion WHERE token='$TOK'"
echo "== catálogo DESPUÉS =="
M hestiat2 -e "SELECT CONCAT('experiencias: ', (SELECT COUNT(*) FROM experiencia), ' · servicios: ', (SELECT COUNT(*) FROM servicio_turistico), ' · solicitudes: ', (SELECT COUNT(*) FROM solicitud_catalogo))"
echo "  activas: $(M hestiat2 -e "SELECT CONCAT((SELECT COUNT(*) FROM experiencia WHERE is_active=1), ' experiencias · ', (SELECT COUNT(*) FROM servicio_turistico WHERE is_active=1), ' servicios')")"
echo
echo "== 5. el botón de edición, con token de 64 caracteres =="
printf "INSERT INTO usuario_sesion (token,usuario_id,expira_en,user_agent) VALUES ('%s',3,DATE_ADD(NOW(),INTERVAL 15 MINUTE),'prueba-alta2');" "$TOK" > /tmp/s3.sql
mariadb -u"$U" -p"$P" hestiat < /tmp/s3.sql
SLUG=$(M hestiat2 -e "SELECT slug FROM accommodation WHERE legacy_id IS NOT NULL AND status='published' LIMIT 1")
echo "  alojamiento · admin: $(curl -sS --max-time 30 -H "Cookie: hestiat_sesion=$TOK" "https://hestiat.com/alojamiento/$SLUG" | grep -c 'Editar publicaci') aparición(es)"
echo "  alojamiento · sin sesión: $(curl -sS --max-time 30 "https://hestiat.com/alojamiento/$SLUG" | grep -c 'Editar publicaci')"
echo "  API de edición con admin (mismo nombre): $(EID=$(M hestiat2 -e 'SELECT id FROM experiencia WHERE is_active=1 LIMIT 1'); curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Cookie: hestiat_sesion=$TOK" --data-urlencode "tipo=experiencia" --data-urlencode "id=$EID" --data-urlencode "nombre=$(M hestiat2 -e "SELECT name FROM experiencia WHERE id=$EID")" --max-time 25 "https://hestiat.com/api/admin/catalogo")"
mariadb -u"$U" -p"$P" hestiat -e "DELETE FROM usuario_sesion WHERE user_agent LIKE 'prueba-alta%'"
echo "  (sesiones de prueba borradas)"
