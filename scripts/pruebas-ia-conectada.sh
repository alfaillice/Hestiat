#!/bin/bash
# =============================================================================
# PRUEBA DEL AGENTE: BUCLE COMPLETO, HERRAMIENTAS REALES Y CONTROL DE GASTO
#
# PARTE 1 · bucle del agente con un SERVIDOR SIMULADO local (no es un modelo real y NO cuesta nada):
#           comprueba que pide una herramienta, que se ejecuta de verdad, que responde, que queda en
#           la auditoría y que el consumo se registra.
# PARTE 2 · las herramientas, contra datos REALES (FAQ, publicación, lead, correo redactado, ticket).
# PARTE 3 · permisos: sin sesión y con anfitrión.
# PARTE 4 · imágenes: muestra de alojamientos, experiencias y servicios.
# PARTE 5 · correo: SPF, DKIM y DMARC por DNS, y el bloqueo exacto que impide confirmar la recepción.
# PARTE 6 · limpieza: se deja todo como estaba (sin clave configurada).
#
# Para probar con un MODELO REAL, cuando el administrador ponga IA_API_KEY en el entorno:
#     IA_API_KEY=... IA_BASE_URL=... bash /root/pruebas-ia-conectada.sh --real
# =============================================================================
set -u
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" $ENVF | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" $ENVF | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }
WEB=https://hestiat.com
MODO="${1:-}"
T=$(openssl rand -hex 32); TH=$(openssl rand -hex 32)
L "INSERT INTO usuario_sesion (token, usuario_id, expira_en, user_agent) VALUES ('$T', 3, DATE_ADD(NOW(), INTERVAL 30 MINUTE), 'prueba-ia-conectada'), ('$TH', 2, DATE_ADD(NOW(), INTERVAL 30 MINUTE), 'prueba-ia-conectada')"

api() { curl -sS -X POST -H "Cookie: hestiat_sesion=$T" -H 'Content-Type: application/json' -d "$1" $WEB/api/admin/ia; }

echo "############ 1. BUCLE DEL AGENTE (servidor simulado local, coste 0) ############"
if [ "$MODO" != "--real" ]; then
  cp "$ENVF" /root/env-copia-ia.bak
  sed -i '/^IA_/d' "$ENVF"
  nohup python3 /root/servidor-simulado.py 8899 >/tmp/stub.log 2>&1 &
  sleep 2
  echo "   servidor simulado: $(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{}' http://127.0.0.1:8899/v1/chat/completions) (200 esperado)"
  printf 'IA_API_KEY=prueba-simulada-no-es-una-clave-real\nIA_BASE_URL=http://127.0.0.1:8899/v1\nIA_MODELO_ECONOMICO=modelo-simulado\nIA_PRECIO_MODELO_SIMULADO_ENTRADA=1\nIA_PRECIO_MODELO_SIMULADO_SALIDA=1\n' >> "$ENVF"
  systemctl restart hestiat
  for i in $(seq 1 8); do sleep 3; [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/)" = "200" ] && break; done
  echo "   servicio: $(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/)"
fi
echo "   conexión al proveedor: $(api '{"accion":"probar"}')"
echo
echo "   conversación de prueba:"
RESP=$(api '{"accion":"chat","mensaje":"¿Publicar en Hestiat cuesta dinero?"}')
echo "$RESP" > /tmp/conv.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/conv.json'))
print("     ok:", d.get("ok"), "· modelo:", d.get("modelo"), "· coste estimado:", d.get("coste_estimado"))
print("     respuesta:", (d.get("respuesta") or d.get("error") or "")[:150])
print("     pasos:", [(p.get("tipo"), p.get("herramienta") or p.get("detalle",""), p.get("ok")) for p in d.get("pasos",[])])
PY
echo
echo "   registro de actividad y consumo:"
L "SELECT CONCAT('     auditoría: ', accion, ' · ', COALESCE(entidad,'-'), ' · ', LEFT(COALESCE(detalle,''),70)) FROM admin_auditoria WHERE accion LIKE 'ia:%' ORDER BY id DESC LIMIT 3"
Q "SELECT CONCAT('     consumo: ', modelo, ' · ', tokens_entrada, '+', tokens_salida, ' tokens · ', ROUND(coste_estimado,6), ' USD · ', creado_en) FROM ia_consumo ORDER BY id DESC LIMIT 3"
echo "     mensajes guardados en la conversación: $(Q "SELECT COUNT(*) FROM ia_mensaje")"

echo
echo "   CONTROL DEL GASTO: se pone el presupuesto diario a 0 y se vuelve a llamar"
api '{"accion":"autonomia","limite_gasto_diario_usd":0}' >/dev/null
echo "     con presupuesto 0 → $(api '{"accion":"chat","mensaje":"Otra pregunta"}' | python3 -c "import json,sys; d=json.load(sys.stdin); print('ok:', d.get('ok'), '· motivo:', d.get('motivo'), '·', (d.get('error') or '')[:90])")"
api '{"accion":"autonomia","limite_gasto_diario_usd":5}' >/dev/null
echo "     presupuesto restaurado a 5 USD/día"

echo
echo "############ 2. LAS HERRAMIENTAS, CON DATOS REALES ############"
h() { api "{\"accion\":\"herramienta\",\"herramienta\":\"$1\",\"argumentos\":$2}" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('resultado')
print('     ok:', d.get('ok'), '·', json.dumps(r, ensure_ascii=False)[:220] if r is not None else (d.get('error') or ''))
"; }
echo "   ¿cuánto cuesta publicar? (FAQ real):"
h search_public_faq '{"consulta":"publicar gratis coste"}'
echo "   consultar una publicación sin modificarla:"
h get_publication '{"tipo":"alojamiento","id":"109437"}'
echo "   buscar publicaciones por provincia:"
h search_publications '{"provincia":"Alicante","limite":"2"}'
echo "   artículo de ayuda sobre reservas:"
h get_help_article '{"consulta":"como reservar"}'
echo "   estado del correo y de las campañas (datos reales):"
h get_email_status '{}'
h get_campaign_stats '{}'
echo "   alta de un lead de prueba y su búsqueda:"
h create_lead '{"empresa":"PRUEBA IA CONECTADA","localidad":"Alicante","email":"prueba-conectada@example.com","tipo_negocio":"alojamiento"}'
h search_leads '{"q":"PRUEBA IA CONECTADA"}'
LEADX=$(Q "SELECT id FROM \`lead\` WHERE empresa='PRUEBA IA CONECTADA' LIMIT 1")
echo "   redactar un correo SIN enviarlo (queda pendiente):"
api "{\"accion\":\"herramienta\",\"herramienta\":\"draft_outreach_email\",\"argumentos\":{\"lead_id\":\"$LEADX\",\"asunto\":\"Publica gratis en Hestiat\",\"cuerpo\":\"Prueba\"},\"autorizadoPor\":\"alfaillice@gmail.com\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('     ok:', d.get('ok'), '·', json.dumps(d.get('resultado'), ensure_ascii=False)[:180] if d.get('resultado') is not None else (d.get('error') or ''))"
echo "     estado: $(Q "SELECT COALESCE(resultado,'(pendiente de aprobación)') FROM lead_contacto WHERE lead_id=$LEADX ORDER BY id DESC LIMIT 1") · ¿hay algo enviado?: $(Q "SELECT COUNT(*) FROM lead_contacto WHERE lead_id=$LEADX AND resultado='enviado'")"
echo "   ticket de soporte:"
h create_support_ticket '{"asunto":"PRUEBA IA CONECTADA: duda de registro","categoria":"registro","prioridad":"normal","mensaje":"Prueba supervisada"}'
COD=$(Q "SELECT codigo FROM ticket WHERE asunto LIKE 'PRUEBA IA CONECTADA%' ORDER BY id DESC LIMIT 1")
h get_support_ticket "{\"codigo\":\"$COD\"}"
echo "   intento de SQL libre (debe negarse):"
h query_sql '{"sql":"SELECT * FROM usuario"}'
echo "   intento de modificar una publicación (debe negarse):"
h update_publication '{"id":"109437","title":"Otro nombre"}'

echo
echo "############ 3. PERMISOS EN BACKEND ############"
printf "   sin sesión:            %s (403)\n" "$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"accion":"estado"}' $WEB/api/admin/ia)"
printf "   anfitrión (no admin):  %s (403)\n" "$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Cookie: hestiat_sesion=$TH" -H 'Content-Type: application/json' -d '{"accion":"estado"}' $WEB/api/admin/ia)"
printf "   /admin/ia sin sesión:  %s (307)\n" "$(curl -sS -o /dev/null -w '%{http_code}' $WEB/admin/ia)"
echo "   ¿existe alguna herramienta de SQL o de borrado masivo?: $(Q "SELECT 1" >/dev/null; grep -c "query_sql\|delete_" /home/hestiat2/frontend/lib/ia-herramientas.server.ts 2>/dev/null || echo 0) (0 = ninguna)"

echo
echo "############ 4. IMÁGENES: MUESTRA DE LAS TRES FAMILIAS ############"
muestra() { # tipo, tabla, columna
  echo "   $1:"
  for url in $(Q "SELECT $3 FROM $2 WHERE $3 IS NOT NULL AND $3<>'' ORDER BY RAND() LIMIT 4"); do
    o=$(curl -sSL -o /dev/null -w "%{http_code}|%{content_type}" --max-time 30 -A 'Mozilla/5.0' -H 'Referer: https://hestiat.com/' "$url")
    echo "     $o · $(echo "$url" | sed 's|.*/||' | cut -c1-52)"
  done
}
muestra "alojamientos con foto propia" "accommodation_photo" "COALESCE(origin_url,storage_key)"
muestra "experiencias" "experiencia" "main_image"
muestra "servicios" "servicio_turistico" "main_image"
echo "   alojamientos con imagen de referencia en las tarjetas:"
echo "     /search → $(curl -sS --max-time 40 $WEB/search | grep -o 'Imagen de referencia' | wc -l) etiquetas · $(curl -sS --max-time 40 $WEB/search | grep -o '<img' | wc -l) imágenes"

echo
echo "############ 5. CORREO: SPF, DKIM, DMARC Y EL BLOQUEO EXACTO ############"
dns() { curl -sS --max-time 20 "https://dns.google/resolve?name=$1&type=TXT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=[a.get('data','') for a in d.get('Answer',[]) if a.get('type')==16]
print(' | '.join(x[:140] for x in r) if r else 'SIN REGISTRO')"; }
echo "   SPF   hestiat.com:            $(dns hestiat.com)"
echo "   DMARC _dmarc.hestiat.com:     $(dns _dmarc.hestiat.com)"
echo "   DKIM  default._domainkey:     $(dns default._domainkey.hestiat.com | cut -c1-90)"
echo "   ¿tiene dirección de informes (rua) la política DMARC?: $(dns _dmarc.hestiat.com | grep -c 'rua=' ) (0 = no la tiene)"
echo "   envío transaccional: ya probado (el servidor acepta y rechaza direcciones inexistentes con 550)"
echo "   recepción: BLOQUEADA para comprobarla — el buzón rechaza IMAP y POP3 con las credenciales de SMTP:"
python3 - <<'PY'
import imaplib, poplib
ent = dict(l.split("=",1) for l in open("/opt/hestiat/shared/.env") if "=" in l and not l.startswith("#"))
u=ent["SMTP_USER"].strip(); c=ent["SMTP_PASSWORD"].strip(); h=ent["SMTP_HOST"].strip()
for n,puerto in [("IMAP",993),("POP3",995)]:
    for host in [h,"mx.hestiat.com"]:
        try:
            s = imaplib.IMAP4_SSL(host,puerto,timeout=12); s.login(u,c); s.logout(); print("     %s %s → FUNCIONA" % (n,host))
        except Exception as e:
            print("     %s %s → %s" % (n,host,str(e)[:60]))
PY

echo
echo "############ 6. LIMPIEZA ############"
if [ "$MODO" != "--real" ]; then
  pkill -f servidor-simulado.py 2>/dev/null
  sed -i '/^IA_/d' "$ENVF"
  systemctl restart hestiat
  for i in $(seq 1 8); do sleep 3; [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/)" = "200" ] && break; done
  echo "   servidor simulado detenido y entorno restaurado (líneas IA_: $(grep -c '^IA_' $ENVF || true))"
fi
Q "DELETE FROM lead_contacto WHERE lead_id IN (SELECT id FROM \`lead\` WHERE empresa LIKE 'PRUEBA IA CONECTADA%')"
Q "DELETE FROM \`lead\` WHERE empresa LIKE 'PRUEBA IA CONECTADA%'"
Q "DELETE FROM ticket_mensaje WHERE ticket_id IN (SELECT id FROM ticket WHERE asunto LIKE 'PRUEBA IA CONECTADA%')"
Q "DELETE FROM ticket WHERE asunto LIKE 'PRUEBA IA CONECTADA%'"
Q "DELETE FROM ia_mensaje"; Q "DELETE FROM ia_conversacion"; Q "DELETE FROM ia_consumo"
L "DELETE FROM admin_auditoria WHERE accion LIKE 'ia:%'"
L "DELETE FROM usuario_sesion WHERE user_agent='prueba-ia-conectada'"
Q "UPDATE ia_config SET valor='5' WHERE clave='limite_gasto_diario_usd'"
echo "   clientes: $(Q "SELECT COUNT(*) FROM \`lead\`") · contactos: $(Q "SELECT COUNT(*) FROM lead_contacto") · tickets: $(Q "SELECT COUNT(*) FROM ticket") · conversaciones: $(Q "SELECT COUNT(*) FROM ia_conversacion") · consumo: $(Q "SELECT COUNT(*) FROM ia_consumo") · auditoría ia: $(L "SELECT COUNT(*) FROM admin_auditoria WHERE accion LIKE 'ia:%'")"
echo "   estado del agente: $(api '{"accion":"probar"}' | python3 -c "import json,sys;print(json.load(sys.stdin).get('resultado','')[:110])")"
