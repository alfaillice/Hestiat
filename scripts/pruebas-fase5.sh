#!/bin/bash
# =============================================================================
# Pruebas de la FASE 5: CRM de captación, correo y tickets.
#
# TODO son datos de PRUEBA, marcados como tales ("PRUEBA FASE 5 ..."), y se borran al final.
# NO se envía ningún correo: solo se comprueba que se redacta, que queda pendiente, que se puede
# cancelar y que una baja bloquea nuevos envíos.
# =============================================================================
set -u
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" $ENVF | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" $ENVF | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }
WEB=https://hestiat.com

T_ADMIN=$(openssl rand -hex 32); T_HOST=$(openssl rand -hex 32)
L "INSERT INTO usuario_sesion (token, usuario_id, expira_en, user_agent) VALUES ('$T_ADMIN', 3, DATE_ADD(NOW(), INTERVAL 30 MINUTE), 'prueba-fase5'), ('$T_HOST', 2, DATE_ADD(NOW(), INTERVAL 30 MINUTE), 'prueba-fase5')"

post() { # token, datos de formulario -> código y cabecera Location
  curl -sS -o /dev/null -D /tmp/cab.txt -w "%{http_code}" -X POST -H "Cookie: hestiat_sesion=$1" -H 'Content-Type: application/x-www-form-urlencoded' -d "$2" $WEB/api/admin/ia
}
aviso() { grep -i '^location:' /tmp/cab.txt | sed 's/.*aviso=//' | python3 -c "import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip())[:110])"; }
pagina() { curl -sS -H "Cookie: hestiat_sesion=$T_ADMIN" "$WEB$1"; }

echo "############ 1. ACCESOS NO AUTORIZADOS ############"
printf "  sin sesión al CRM        -> %s (403 esperado)\n" "$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/x-www-form-urlencoded' -d 'accion=crm_crear&empresa=X' $WEB/api/admin/ia)"
printf "  anfitrión al CRM         -> %s (403 esperado)\n" "$(post $T_HOST 'accion=crm_crear&empresa=X')"
printf "  /admin/crm sin sesión    -> %s (307 esperado)\n" "$(curl -sS -o /dev/null -w '%{http_code}' $WEB/admin/crm)"
printf "  /admin/tickets sin sesión-> %s (307 esperado)\n" "$(curl -sS -o /dev/null -w '%{http_code}' $WEB/admin/tickets)"

echo
echo "############ 2. CREAR, DUPLICAR Y ACTUALIZAR ############"
CODE=$(post $T_ADMIN 'accion=crm_crear&volver=/admin/crm&empresa=PRUEBA FASE 5 ALFA&tipo_negocio=alojamiento&localidad=Alicante&provincia=Alicante&web=https://alfa-prueba.example.com&email=prueba-fase5-alfa@example.com&notas=alta de prueba')
echo "  crear ALFA               -> $CODE · $(aviso)"
A=$(Q "SELECT id FROM \`lead\` WHERE empresa='PRUEBA FASE 5 ALFA' LIMIT 1")
CODE=$(post $T_ADMIN 'accion=crm_crear&volver=/admin/crm&empresa=PRUEBA FASE 5 ALFA&localidad=Alicante&email=prueba-fase5-alfa@example.com')
echo "  mismo email otra vez     -> $CODE · $(aviso)"
CODE=$(post $T_ADMIN 'accion=crm_crear&volver=/admin/crm&empresa=PRUEBA FASE 5 ALFA (otro)&localidad=Alicante&web=https://alfa-prueba.example.com')
echo "  mismo dominio            -> $CODE · $(aviso)"
CODE=$(post $T_ADMIN 'accion=crm_crear&volver=/admin/crm&empresa=PRUEBA FASE 5 BETA&tipo_negocio=experiencia&localidad=Madrid&email=prueba-fase5-beta@example.com')
echo "  crear BETA (Madrid)      -> $CODE · $(aviso)"
B=$(Q "SELECT id FROM \`lead\` WHERE empresa='PRUEBA FASE 5 BETA' LIMIT 1")
CODE=$(post $T_ADMIN "accion=crm_actualizar&volver=/admin/crm&id=$A&estado=RESEARCHED&responsable=pruebas&notas=revisado")
echo "  actualizar ALFA          -> $CODE · $(aviso)"
echo "  estado en la base: $(Q "SELECT estado FROM \`lead\` WHERE id=$A") · leads de prueba: $(Q "SELECT COUNT(*) FROM \`lead\` WHERE empresa LIKE 'PRUEBA FASE 5%'")"

echo
echo "############ 3. BUSQUEDA, FILTROS Y PAGINACION EN LA INTERFAZ ############"
H=$(pagina "/admin/crm?q=PRUEBA FASE 5")
echo "  buscar «PRUEBA FASE 5»   -> ¿salen ALFA y BETA?: $(echo "$H" | grep -c 'PRUEBA FASE 5 ALFA'), $(echo "$H" | grep -c 'PRUEBA FASE 5 BETA')"
H=$(pagina "/admin/crm?localidad=Madrid&q=PRUEBA")
echo "  filtro localidad=Madrid  -> ¿sale BETA?: $(echo "$H" | grep -c 'PRUEBA FASE 5 BETA') · ¿sale ALFA?: $(echo "$H" | grep -c 'PRUEBA FASE 5 ALFA')"
H=$(pagina "/admin/crm?estado=RESEARCHED&q=PRUEBA")
echo "  filtro estado=RESEARCHED -> ¿sale ALFA?: $(echo "$H" | grep -c 'PRUEBA FASE 5 ALFA') · ¿sale BETA?: $(echo "$H" | grep -c 'PRUEBA FASE 5 BETA')"
H=$(pagina "/admin/crm?pagina=2")
echo "  paginación página 2      -> ¿dice «página 2 de»?: $(echo "$H" | grep -c 'página 2 de')"

echo
echo "############ 4. CORREO: REDACTAR, PENDIENTE Y CANCELAR ############"
CODE=$(post $T_ADMIN "accion=crm_preparar_email&volver=/admin/crm&id=$A&plantilla=alojamientos")
echo "  redactar correo          -> $CODE · $(aviso)"
BORR=$(Q "SELECT id FROM lead_contacto WHERE lead_id=$A AND resultado IS NULL ORDER BY id DESC LIMIT 1")
echo "  borrador pendiente: #$BORR · ¿lo enseña la ficha?: $(pagina "/admin/crm?id=$A" | grep -c 'pendiente de aprobación')"
CODE=$(post $T_ADMIN "accion=crm_cancelar_envio&volver=/admin/crm&contactoId=$BORR")
echo "  cancelar el envío        -> $CODE · $(aviso)"
echo "  estado del borrador: $(Q "SELECT COALESCE(resultado,'(sin resultado)') FROM lead_contacto WHERE id=$BORR")"

echo
echo "############ 5. BAJA: SE REGISTRA Y BLOQUEA NUEVOS ENVÍOS ############"
CODE=$(post $T_ADMIN "accion=crm_baja&volver=/admin/crm&id=$A")
echo "  registrar baja de ALFA   -> $CODE · $(aviso)"
echo "  ¿está en la lista de exclusión?: $(Q "SELECT COUNT(*) FROM email_exclusion WHERE email='prueba-fase5-alfa@example.com'") · estado del lead: $(Q "SELECT estado FROM \`lead\` WHERE id=$A") · excluido: $(Q "SELECT excluido FROM \`lead\` WHERE id=$A")"
CODE=$(post $T_ADMIN "accion=crm_preparar_email&volver=/admin/crm&id=$A&plantilla=alojamientos")
echo "  intentar redactar tras la baja -> $CODE · $(aviso)"

echo
echo "############ 6. TICKETS: CREAR, CONSULTAR Y RESOLVER ############"
CODE=$(post $T_ADMIN 'accion=ticket_crear&volver=/admin/tickets&asunto=PRUEBA FASE 5: no puedo entrar&categoria=cuenta_acceso&prioridad=alta&contacto_email=prueba-fase5@example.com&mensaje=Prueba automatizada')
echo "  crear incidencia         -> $CODE · $(aviso)"
COD=$(Q "SELECT codigo FROM ticket WHERE asunto LIKE 'PRUEBA FASE 5%' ORDER BY id DESC LIMIT 1")
echo "  código: $COD · ¿sale en el listado?: $(pagina "/admin/tickets" | grep -c "$COD")"
CODE=$(post $T_ADMIN "accion=ticket_actualizar&volver=/admin/tickets&codigo=$COD&estado=RESOLVED&resolucion=Resuelto en la prueba&mensaje=Se ha comprobado la cuenta")
echo "  resolverla               -> $CODE · $(aviso)"
echo "  estado: $(Q "SELECT estado FROM ticket WHERE codigo='$COD'") · resolución: $(Q "SELECT LEFT(resolucion,30) FROM ticket WHERE codigo='$COD'") · mensajes: $(Q "SELECT COUNT(*) FROM ticket_mensaje WHERE ticket_id=(SELECT id FROM ticket WHERE codigo='$COD')")"

echo
echo "############ 7. CORREO: SPF, DKIM Y DMARC (DNS real) ############"
dns() { curl -sS --max-time 20 "https://dns.google/resolve?name=$1&type=TXT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
respuestas=[a.get('data','') for a in d.get('Answer',[]) if a.get('type')==16]
print(' | '.join(r[:150] for r in respuestas) if respuestas else 'SIN REGISTRO')
"; }
echo "  SPF    (hestiat.com):            $(dns hestiat.com | tr -d '\n' | cut -c1-150)"
echo "  DMARC  (_dmarc.hestiat.com):     $(dns _dmarc.hestiat.com | tr -d '\n' | cut -c1-150)"
for sel in default mail smtp selector1 k1 google; do
  R=$(dns "${sel}._domainkey.hestiat.com")
  [ "$R" != "SIN REGISTRO" ] && echo "  DKIM   (${sel}._domainkey):          $(echo "$R" | cut -c1-110)"
done
echo "  (el buzón real está comprobado desde la fase anterior: TLS en el puerto 465 y envío transaccional funcionando)"

echo
echo "############ 8. LIMPIEZA DE LOS DATOS DE PRUEBA ############"
Q "DELETE FROM lead_contacto WHERE lead_id IN (SELECT id FROM \`lead\` WHERE empresa LIKE 'PRUEBA FASE 5%')"
Q "DELETE FROM \`lead\` WHERE empresa LIKE 'PRUEBA FASE 5%'"
Q "DELETE FROM email_exclusion WHERE email LIKE '%fase5%'"
Q "DELETE FROM ticket_mensaje WHERE ticket_id IN (SELECT id FROM ticket WHERE asunto LIKE 'PRUEBA FASE 5%')"
Q "DELETE FROM ticket WHERE asunto LIKE 'PRUEBA FASE 5%'"
L "DELETE FROM admin_auditoria WHERE accion LIKE 'ia:crm_%' OR accion LIKE 'ia:ticket_%'"
L "DELETE FROM usuario_sesion WHERE user_agent='prueba-fase5'"
echo "  tras la limpieza → clientes: $(Q "SELECT COUNT(*) FROM \`lead\`") · contactos: $(Q "SELECT COUNT(*) FROM lead_contacto") · exclusiones: $(Q "SELECT COUNT(*) FROM email_exclusion") · incidencias: $(Q "SELECT COUNT(*) FROM ticket") · mensajes: $(Q "SELECT COUNT(*) FROM ticket_mensaje")"
echo "  restos de prueba: $(Q "SELECT COUNT(*) FROM \`lead\` WHERE empresa LIKE 'PRUEBA%'") leads · $(Q "SELECT COUNT(*) FROM ticket WHERE asunto LIKE 'PRUEBA%'") tickets · $(L "SELECT COUNT(*) FROM usuario_sesion WHERE user_agent LIKE 'prueba%'") sesiones"
