#!/bin/bash
# =============================================================================
# Pruebas de los caminos de error del agente + exclusión de correo + búsqueda.
#
# Los caminos de error (credencial rechazada, modelo no disponible, respuesta inválida) NO se pueden
# probar sin configurar una clave: se pone una clave de prueba INVÁLIDA, se apunta a distintos
# proveedores, se comprueba qué hace el agente y al final se deja el entorno COMO ESTABA (sin clave).
#
# NO se envía ningún correo real en ninguna parte de esta prueba.
# =============================================================================
set -u
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" $ENVF | cut -d= -f2-)
P=$(grep "^DB_PASSWORD=" $ENVF | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }
WEB=https://hestiat.com

cp "$ENVF" "/root/env-copia-$(date -u +%Y%m%d-%H%M%S).bak"
echo "copia del entorno guardada · líneas con IA_ antes: $(grep -c '^IA_' $ENVF || true)"

T=$(openssl rand -hex 32)
L "INSERT INTO usuario_sesion (token, usuario_id, expira_en, user_agent) VALUES ('$T', 3, DATE_ADD(NOW(), INTERVAL 30 MINUTE), 'prueba-ia-errores')"
api() { curl -sS -o /tmp/e.json -w "%{http_code}" -X POST -H "Cookie: hestiat_sesion=$T" -H 'Content-Type: application/json' -d "$1" $WEB/api/admin/ia; }
resumen() { python3 -c "
import json
d=json.load(open('/tmp/e.json'))
print('   ok=', d.get('ok'), '· motivo=', d.get('motivo') or d.get('resultado','')[:60], '· error=', (d.get('error') or '')[:120])
"; }

echo
echo "############ A. BÚSQUEDA POR PROVINCIA (antes no encontraba nada) ############"
printf "  search_publications Alicante -> %s\n" "$(api '{"accion":"herramienta","herramienta":"search_publications","argumentos":{"provincia":"Alicante","limite":"3"}}')"
python3 -c "
import json; d=json.load(open('/tmp/e.json'))
r=d.get('resultado',{})
print('   encontrados:', r.get('total'))
for x in (r.get('resultados') or [])[:3]: print('    ·', x['tipo'], '|', x['titulo'][:44], '|', x['localidad'], '|', x['precio'], '|', x['estado'])
"
printf "  get_publication de uno real -> %s\n" "$(api '{"accion":"herramienta","herramienta":"get_publication","argumentos":{"tipo":"experience","id":"1"}}')"
resumen

echo
echo "############ B. LA EXCLUSIÓN SE RESPETA AL REDACTAR ############"
api '{"accion":"herramienta","herramienta":"create_lead","argumentos":{"empresa":"PRUEBA IA EXCLUIDA","localidad":"Alicante","email":"baja-ia@example.com","tipo_negocio":"servicio"}}' >/dev/null
api '{"accion":"herramienta","herramienta":"add_email_exclusion","argumentos":{"email":"baja-ia@example.com","motivo":"prueba","origen":"usuario"}}' >/dev/null
LEADX=$(Q "SELECT id FROM \`lead\` WHERE empresa='PRUEBA IA EXCLUIDA' LIMIT 1")
echo "  cliente excluido creado: id=$LEADX"
printf "  redactar correo a una dirección excluida -> %s\n" "$(api "{\"accion\":\"herramienta\",\"herramienta\":\"draft_outreach_email\",\"argumentos\":{\"lead_id\":\"$LEADX\",\"asunto\":\"Hola\",\"cuerpo\":\"Texto\"},\"autorizadoPor\":\"alfaillice@gmail.com\"}")"
resumen
echo "  (lo esperado: NO se prepara nada y dice por qué)"

echo
echo "############ C. CAMINOS DE ERROR DEL MODELO (con clave de prueba inválida) ############"
poner() {
  sed -i '/^IA_/d' "$ENVF"
  for linea in "$@"; do echo "$linea" >> "$ENVF"; done
  systemctl restart hestiat
  for i in 1 2 3 4 5 6 7 8; do sleep 3; [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/)" = "200" ] && break; done
  echo "   entorno puesto: $* · servicio: $(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/)"
}

poner "IA_API_KEY=clave-de-prueba-invalida" "IA_BASE_URL=https://api.openai.com/v1" "IA_MODELO_ECONOMICO=gpt-4.1-mini"
printf "  credencial rechazada por el proveedor real -> %s\n" "$(api '{"accion":"probar"}')"
resumen
printf "  conversación con credencial inválida      -> %s\n" "$(api '{"accion":"chat","mensaje":"Hola"}')"
resumen

poner "IA_API_KEY=clave-de-prueba-invalida" "IA_BASE_URL=http://127.0.0.1:9/v1"
printf "  proveedor inalcanzable                    -> %s\n" "$(api '{"accion":"probar"}')"
resumen

poner "IA_API_KEY=clave-de-prueba-invalida" "IA_BASE_URL=https://hestiat.com"
printf "  proveedor que devuelve algo que no es JSON -> %s\n" "$(api '{"accion":"probar"}')"
resumen

echo
echo "############ D. SE DEJA EL ENTORNO COMO ESTABA ############"
sed -i '/^IA_/d' "$ENVF"
systemctl restart hestiat
for i in 1 2 3 4 5 6 7 8; do sleep 3; [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/)" = "200" ] && break; done
echo "  líneas con IA_ después: $(grep -c '^IA_' $ENVF || true) (0 = como estaba)"
echo "  servicio: $(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/) · sin clave, el agente vuelve a decir:"
printf "    probar conexión -> %s\n" "$(api '{"accion":"probar"}')"
resumen
echo "  claves del entorno intactas: $(grep -c '=' $ENVF) líneas (mismo número que antes)"

echo
echo "############ E. LIMPIEZA ############"
Q "DELETE FROM lead_contacto WHERE lead_id IN (SELECT id FROM \`lead\` WHERE empresa LIKE 'PRUEBA IA%')"
Q "DELETE FROM \`lead\` WHERE empresa LIKE 'PRUEBA IA%'"
Q "DELETE FROM email_exclusion WHERE email LIKE '%ia@example.com'"
Q "DELETE FROM ia_mensaje"; Q "DELETE FROM ia_conversacion"; Q "DELETE FROM ia_consumo"
L "DELETE FROM admin_auditoria WHERE accion LIKE 'ia:%'"
L "DELETE FROM usuario_sesion WHERE user_agent LIKE 'prueba-ia%'"
echo "  clientes: $(Q "SELECT COUNT(*) FROM \`lead\`") · exclusiones: $(Q "SELECT COUNT(*) FROM email_exclusion") · consumo: $(Q "SELECT COUNT(*) FROM ia_consumo") · auditoría ia: $(L "SELECT COUNT(*) FROM admin_auditoria WHERE accion LIKE 'ia:%'") · sesiones de prueba: $(L "SELECT COUNT(*) FROM usuario_sesion WHERE user_agent LIKE 'prueba-ia%'")"
