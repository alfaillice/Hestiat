#!/bin/bash
# Verificación puntual de tres cosas que quedaron sin ver: la negativa por exclusión, el camino de
# respuesta inválida (ya con el arreglo del detalle) y que la ficha de una publicación funciona.
set -u
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" $ENVF | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" $ENVF | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }
WEB=https://hestiat.com
T=$(openssl rand -hex 32)
L "INSERT INTO usuario_sesion (token, usuario_id, expira_en, user_agent) VALUES ('$T', 3, DATE_ADD(NOW(), INTERVAL 20 MINUTE), 'prueba-ia-detalle')"
api() { curl -sS -o /tmp/d.json -w "%{http_code}" -X POST -H "Cookie: hestiat_sesion=$T" -H 'Content-Type: application/json' -d "$1" $WEB/api/admin/ia; }
ver() { python3 -c "
import json
d=json.load(open('/tmp/d.json'))
r=d.get('resultado')
print('     ok:', d.get('ok'))
print('     resultado:', json.dumps(r, ensure_ascii=False)[:260] if r is not None else None)
print('     error:', (d.get('error') or '')[:160])
"; }

echo "=== 1. EXCLUSIÓN: se niega a redactar para una dirección dada de baja ==="
api '{"accion":"herramienta","herramienta":"add_email_exclusion","argumentos":{"email":"baja2-ia@example.com","motivo":"prueba","origen":"usuario"}}' >/dev/null
api '{"accion":"herramienta","herramienta":"create_lead","argumentos":{"empresa":"PRUEBA IA EXCLUIDA 2","localidad":"Alicante","email":"baja2-ia@example.com","tipo_negocio":"servicio"}}' >/dev/null
LX=$(Q "SELECT id FROM \`lead\` WHERE empresa='PRUEBA IA EXCLUIDA 2' LIMIT 1")
echo "  cliente excluido: id=$LX"
printf "  draft autorizado -> %s\n" "$(api "{\"accion\":\"herramienta\",\"herramienta\":\"draft_outreach_email\",\"argumentos\":{\"lead_id\":\"$LX\",\"asunto\":\"Hola\",\"cuerpo\":\"Texto\"},\"autorizadoPor\":\"alfaillice@gmail.com\"}")"
ver

echo
echo "=== 2. FICHA DE UNA PUBLICACIÓN REAL ==="
printf "  get_publication -> %s\n" "$(api '{"accion":"herramienta","herramienta":"get_publication","argumentos":{"tipo":"alojamiento","id":"109437"}}')"
ver

echo
echo "=== 3. RESPUESTA INVÁLIDA DEL PROVEEDOR (con el arreglo del detalle) ==="
cp "$ENVF" /root/env-copia-detalle.bak
sed -i '/^IA_/d' "$ENVF"
printf 'IA_API_KEY=clave-de-prueba-invalida\nIA_BASE_URL=https://hestiat.com\n' >> "$ENVF"
systemctl restart hestiat
for i in 1 2 3 4 5 6 7 8; do sleep 3; [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/)" = "200" ] && break; done
printf "  probar conexión -> %s\n" "$(api '{"accion":"probar"}')"
ver
sed -i '/^IA_/d' "$ENVF"
systemctl restart hestiat
for i in 1 2 3 4 5 6 7 8; do sleep 3; [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/)" = "200" ] && break; done
echo "  entorno restaurado · líneas IA_: $(grep -c '^IA_' $ENVF || true) · servicio: $(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/)"
printf "  sin clave, prueba de conexión -> %s\n" "$(api '{"accion":"probar"}')"
ver

echo
echo "=== LIMPIEZA ==="
Q "DELETE FROM lead_contacto WHERE lead_id IN (SELECT id FROM \`lead\` WHERE empresa LIKE 'PRUEBA IA%')"
Q "DELETE FROM \`lead\` WHERE empresa LIKE 'PRUEBA IA%'"
Q "DELETE FROM email_exclusion WHERE email LIKE '%ia@example.com'"
Q "DELETE FROM ia_mensaje"; Q "DELETE FROM ia_conversacion"; Q "DELETE FROM ia_consumo"
L "DELETE FROM admin_auditoria WHERE accion LIKE 'ia:%'"
L "DELETE FROM usuario_sesion WHERE user_agent LIKE 'prueba-ia%'"
echo "  clientes: $(Q "SELECT COUNT(*) FROM \`lead\`") · exclusiones: $(Q "SELECT COUNT(*) FROM email_exclusion") · consumo: $(Q "SELECT COUNT(*) FROM ia_consumo") · auditoría ia: $(L "SELECT COUNT(*) FROM admin_auditoria WHERE accion LIKE 'ia:%'")"
