#!/bin/bash
# =============================================================================
# PRUEBA DE ENVÍO REAL DE PUNTA A PUNTA DESDE EL CRM.
#
# Se usa una dirección PROPIA (el buzón del proyecto), nunca un lead real: se crea un potencial
# cliente de prueba que apunta al buzón de Hestiat, se redacta el correo desde el CRM, se aprueba y
# se envía. Después se comprueba de verdad que el mensaje ha LLEGADO, leyendo el buzón por IMAP.
#
# Al terminar se borran los datos de prueba del CRM (el correo enviado queda en el buzón, es nuestro).
# =============================================================================
set -u
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" $ENVF | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" $ENVF | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }
WEB=https://hestiat.com
BUZON=$(grep '^SMTP_USER=' $ENVF | cut -d= -f2-)
MARCA="PRUEBA ENVIO REAL $(date -u +%H%M%S)"

T=$(openssl rand -hex 32)
L "INSERT INTO usuario_sesion (token, usuario_id, expira_en, user_agent) VALUES ('$T', 3, DATE_ADD(NOW(), INTERVAL 20 MINUTE), 'prueba-envio-real')"

post() { curl -sS -o /tmp/env.json -D /tmp/envcab.txt -w "%{http_code}" -X POST -H "Cookie: hestiat_sesion=$T" -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode "accion=$1" --data-urlencode "volver=" --data-urlencode "$2" --data-urlencode "$3" --data-urlencode "$4" --data-urlencode "$5" $WEB/api/admin/ia 2>/dev/null; }

echo "=== 1. CLIENTE DE PRUEBA (apunta a nuestro propio buzón, no a un lead real) ==="
echo "   buzón del proyecto: $BUZON"
CODE=$(curl -sS -o /tmp/a.json -w "%{http_code}" -X POST -H "Cookie: hestiat_sesion=$T" -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "accion=crm_crear" --data-urlencode "empresa=$MARCA" --data-urlencode "tipo_negocio=otro" \
  --data-urlencode "localidad=Alicante" --data-urlencode "email=$BUZON" --data-urlencode "notas=Prueba de envío real a nuestro propio buzón" $WEB/api/admin/ia)
LEAD=$(Q "SELECT id FROM \`lead\` WHERE empresa='$MARCA' LIMIT 1")
echo "   crear -> $CODE · cliente #$LEAD"

echo
echo "=== 2. REDACTAR DESDE EL CRM (queda pendiente, no se envía) ==="
CODE=$(curl -sS -o /tmp/b.json -w "%{http_code}" -X POST -H "Cookie: hestiat_sesion=$T" -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "accion=crm_preparar_email" --data-urlencode "id=$LEAD" --data-urlencode "plantilla=alojamientos" --data-urlencode "volver=" $WEB/api/admin/ia)
CONTACTO=$(Q "SELECT id FROM lead_contacto WHERE lead_id=$LEAD ORDER BY id DESC LIMIT 1")
ASUNTO=$(Q "SELECT asunto FROM lead_contacto WHERE id=$CONTACTO")
echo "   redactar -> $CODE · contacto #$CONTACTO · asunto: $ASUNTO"
echo "   estado inicial: $(Q "SELECT COALESCE(resultado,'(pendiente)') FROM lead_contacto WHERE id=$CONTACTO")"

echo
echo "=== 3. APROBAR Y ENVIAR (esto SÍ envía un correo de verdad, a nuestro buzón) ==="
RESP=$(curl -sS -X POST -H "Cookie: hestiat_sesion=$T" -H 'Content-Type: application/json' \
  -d "{\"accion\":\"aprobar_envio\",\"contactoId\":$CONTACTO}" $WEB/api/admin/ia)
echo "   respuesta: $RESP"
echo "   en el registro: resultado=$(Q "SELECT COALESCE(resultado,'?') FROM lead_contacto WHERE id=$CONTACTO") · enviado_en=$(Q "SELECT COALESCE(enviado_en,'?') FROM lead_contacto WHERE id=$CONTACTO") · aprobado_por=$(Q "SELECT COALESCE(aprobado_por,'?') FROM lead_contacto WHERE id=$CONTACTO")"
echo "   estado del cliente: $(Q "SELECT estado FROM \`lead\` WHERE id=$LEAD")"

echo
echo "=== 4. COMPROBACIÓN REAL: ¿HA LLEGADO AL BUZÓN? (IMAP) ==="
python3 - <<PY
import imaplib, email, os, re
from email.header import decode_header
entorno = dict(l.split("=",1) for l in open("$ENVF") if "=" in l and not l.startswith("#"))
host = entorno["SMTP_HOST"].strip()
usuario = entorno["SMTP_USER"].strip()
clave = entorno["SMTP_PASSWORD"].strip()
asunto_buscado = """$ASUNTO""".strip()
try:
    servidor = imaplib.IMAP4_SSL("imap." + host, 993, timeout=30)
    servidor.login(usuario, clave)
    servidor.select("INBOX")
    # Solo se busca el mensaje de la prueba: no se lee nada más del buzón.
    tip, datos = servidor.search(None, 'SUBJECT', '"%s"' % asunto_buscado[:60])
    ids = datos[0].split() if datos and datos[0] else []
    print("   mensajes encontrados con ese asunto: %d" % len(ids))
    if ids:
        tip, msgs = servidor.fetch(ids[-1], "(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM TO DATE)])")
        crudo = msgs[0][1].decode("utf-8", "ignore")
        for linea in crudo.splitlines():
            if linea.strip():
                print("   " + linea.strip()[:120])
    servidor.logout()
except Exception as e:
    print("   no se ha podido comprobar por IMAP: %s" % str(e)[:160])
PY

echo
echo "=== 5. AUDITORÍA DEL ENVÍO ==="
L "SELECT CONCAT('   ', accion, ' · ', COALESCE(entidad,'-'), ' · ', LEFT(COALESCE(detalle,''),90), ' · ', creado_en) FROM admin_auditoria WHERE accion LIKE 'ia:%' AND accion IN ('ia:email_comercial_enviado','ia:envio_fallido','ia:crm_preparar_email','ia:crm_crear') ORDER BY id DESC LIMIT 4"
echo "   envíos comerciales de hoy: $(Q "SELECT COUNT(*) FROM lead_contacto WHERE resultado='enviado' AND enviado_en >= CURDATE()")"

echo
echo "=== 6. LIMPIEZA DE LOS DATOS DE PRUEBA DEL CRM ==="
Q "DELETE FROM lead_contacto WHERE lead_id=$LEAD"
Q "DELETE FROM \`lead\` WHERE id=$LEAD"
L "DELETE FROM usuario_sesion WHERE user_agent='prueba-envio-real'"
echo "   clientes: $(Q "SELECT COUNT(*) FROM \`lead\`") · contactos: $(Q "SELECT COUNT(*) FROM lead_contacto") · ¿queda algo de la prueba?: $(Q "SELECT COUNT(*) FROM \`lead\` WHERE empresa LIKE 'PRUEBA ENVIO REAL%'")"
echo "   (el correo enviado sigue en el buzón: es nuestro y es la prueba de que llegó)"
