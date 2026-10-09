#!/bin/bash
# =============================================================================
# PRUEBAS DE LA FASE 7: captación y conversión de propietarios.
#
# Leads FICTICIOS marcados como tales ("PRUEBA FASE 7 ..."). NO se envía ningún correo comercial:
# solo se comprueba que se redacta, que se aprueba, que se rechaza y que se BLOQUEA cuando toca.
# Al terminar se borran los datos ficticios; los del lote piloto son negocios REALES del catálogo y
# se conservan (eso es justo lo que hace el piloto).
# =============================================================================
set -u
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" $ENVF | cut -d= -f2-); P=$(grep "^DB_PASSWORD=" $ENVF | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }
WEB=https://hestiat.com
T=$(openssl rand -hex 32); TH=$(openssl rand -hex 32)
L "INSERT INTO usuario_sesion (token, usuario_id, expira_en, user_agent) VALUES ('$T', 3, DATE_ADD(NOW(), INTERVAL 30 MINUTE), 'prueba-fase7'), ('$TH', 2, DATE_ADD(NOW(), INTERVAL 30 MINUTE), 'prueba-fase7')"
api() { curl -sS -X POST -H "Cookie: hestiat_sesion=$T" -H 'Content-Type: application/json' -d "$1" $WEB/api/admin/ia; }
res() { python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('resultado') if 'resultado' in d else d.get('investigacion') or d.get('metricas') or d
print('     ok:', d.get('ok'), '·', json.dumps(r, ensure_ascii=False)[:230] if r is not None else (d.get('error') or ''))
"; }

echo "############ 1. ACCESOS ############"
printf "  sin sesión:        %s (403)\n" "$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"accion":"captacion_metricas"}' $WEB/api/admin/ia)"
printf "  anfitrión:         %s (403)\n" "$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Cookie: hestiat_sesion=$TH" -H 'Content-Type: application/json' -d '{"accion":"captacion_metricas"}' $WEB/api/admin/ia)"
printf "  /admin/captacion:  %s (307)\n" "$(curl -sS -o /dev/null -w '%{http_code}' $WEB/admin/captacion)"
printf "  webhook sin secreto ni sesión: %s (403 esperado)\n" "$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"email":"x@example.com","tipo":"baja"}' $WEB/api/correo/respuesta)"

echo
echo "############ 2. INVESTIGACIÓN CONTRA EL CATÁLOGO (sin inventar nada) ############"
echo "  negocio real del catálogo:"
api '{"accion":"crm_investigar","nombre":"La City Hotel","localidad":"Alacant / Alicante"}' | res
echo "  negocio que no está en el catálogo:"
api '{"accion":"crm_investigar","nombre":"Negocio Que No Existe SL","localidad":"Ninguna Parte"}' | res

echo
echo "############ 3. DEDUPLICACIÓN Y ALTA ############"
api '{"accion":"crm_crear","empresa":"PRUEBA FASE 7 ALFA","localidad":"Alicante","email":"prueba-fase7-alfa@example.com","tipo_negocio":"alojamiento"}' >/dev/null
A=$(Q "SELECT id FROM \`lead\` WHERE empresa='PRUEBA FASE 7 ALFA' LIMIT 1")
echo "  alta: lead #$A"
printf "  mismo email otra vez: " ; api '{"accion":"crm_crear","empresa":"PRUEBA FASE 7 OTRO","localidad":"Alicante","email":"prueba-fase7-alfa@example.com"}' | res
echo "  leads de prueba creados: $(Q "SELECT COUNT(*) FROM \`lead\` WHERE empresa LIKE 'PRUEBA FASE 7%'")"

echo
echo "############ 4. FLUJO DE ESTADOS: sin evento real no se avanza ############"
printf "  intento de pasar a REGISTERED sin cuenta real: " ; api "{\"accion\":\"crm_estado\",\"id\":$A,\"estado\":\"REGISTERED\",\"motivo\":\"prueba\"}" | res
printf "  intento de pasar a PUBLISHED sin publicación real: " ; api "{\"accion\":\"crm_estado\",\"id\":$A,\"estado\":\"PUBLISHED\",\"motivo\":\"prueba\"}" | res
printf "  salto no permitido (DETECTED -> CONTACTED): " ; api "{\"accion\":\"crm_estado\",\"id\":$A,\"estado\":\"CONTACTED\",\"motivo\":\"prueba\"}" | res
printf "  paso correcto (DETECTED -> RESEARCHED): " ; api "{\"accion\":\"crm_estado\",\"id\":$A,\"estado\":\"RESEARCHED\",\"motivo\":\"Investigado a mano en la prueba\"}" | res
echo "  historial: $(Q "SELECT CONCAT(COALESCE(estado_anterior,'(nuevo)'), ' → ', estado_nuevo, ' · ', LEFT(motivo,40)) FROM lead_estado_historial WHERE lead_id=$A")"

echo
echo "############ 5. INVITACIÓN, APROBACIÓN Y RECHAZO (sin enviar nada) ############"
printf "  preparar invitación: " ; api "{\"accion\":\"crm_preparar_email\",\"id\":$A}" | res
C=$(Q "SELECT id FROM lead_contacto WHERE lead_id=$A AND resultado IS NULL ORDER BY id DESC LIMIT 1")
echo "  borrador #$C · estado del lead: $(Q "SELECT estado FROM \`lead\` WHERE id=$A") · plantilla: $(Q "SELECT plantilla FROM lead_contacto WHERE id=$C")"
echo "  base jurídica registrada: $(Q "SELECT LEFT(COALESCE(base_juridica,'(sin base)'),90) FROM lead_contacto WHERE id=$C")"
echo "  ¿promete reservas o ingresos?: $(Q "SELECT cuerpo FROM lead_contacto WHERE id=$C" | grep -ci 'garantiz\|aseguramos reservas\|más clientes garantizados') (0 = no promete)"
printf "  aprobar (sin enviar): " ; api "{\"accion\":\"crm_aprobar\",\"contactoId\":$C}" | res
echo "  estado del lead: $(Q "SELECT estado FROM \`lead\` WHERE id=$A") · correo marcado como revisado por: $(Q "SELECT COALESCE(revisado_por,'—') FROM lead_contacto WHERE id=$C")"
printf "  editar el borrador: " ; api "{\"accion\":\"crm_editar_borrador\",\"contactoId\":$C,\"asunto\":\"Asunto editado en la prueba\",\"cuerpo\":\"Cuerpo editado en la prueba.\"}" | res
printf "  rechazar: " ; api "{\"accion\":\"crm_cancelar_envio\",\"contactoId\":$C}" | res
echo "  estado del correo: $(Q "SELECT COALESCE(resultado,'(pendiente)') FROM lead_contacto WHERE id=$C") · ¿se ha enviado algo?: $(Q "SELECT COUNT(*) FROM lead_contacto WHERE lead_id=$A AND resultado='enviado'")"

echo
echo "############ 6. BAJA Y BLOQUEO ############"
printf "  registrar baja: " ; api '{"accion":"crm_registrar_respuesta","email":"prueba-fase7-alfa@example.com","tipo":"baja","asunto":"BAJA","fuente":"prueba"}' | res
echo "  estado del lead: $(Q "SELECT estado FROM \`lead\` WHERE id=$A") · excluido: $(Q "SELECT excluido FROM \`lead\` WHERE id=$A") · en la lista de exclusión: $(Q "SELECT COUNT(*) FROM email_exclusion WHERE email='prueba-fase7-alfa@example.com'")"
printf "  intentar preparar otro correo tras la baja: " ; api "{\"accion\":\"crm_preparar_email\",\"id\":$A}" | res
printf "  registrar una respuesta de interés: " ; api '{"accion":"crm_registrar_respuesta","email":"prueba-fase7-alfa@example.com","tipo":"interesado","fuente":"prueba"}' | res

echo
echo "############ 7. LOTE PILOTO (negocios REALES del catálogo) ############"
api '{"accion":"captacion_piloto","limite":3}' | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('     creados:', len(d.get('creados',[])), '· descartados:', len(d.get('descartados',[])), '· límite', d.get('limite'))
for c in d.get('creados',[]): print('       #%s %s (%s)' % (c['id'], c['empresa'][:44], c['email']))
print('     motivos de descarte:', [x['motivo'] for x in d.get('descartados',[])][:4])
"
echo "  leads reales del piloto: $(Q "SELECT COUNT(*) FROM \`lead\` WHERE fuente='catalogo' AND empresa NOT LIKE 'PRUEBA%'") · procedencia guardada: $(Q "SELECT LEFT(COALESCE(notas,''),60) FROM \`lead\` WHERE fuente='catalogo' AND empresa NOT LIKE 'PRUEBA%' LIMIT 1")"

echo
echo "############ 8. PRIVACIDAD: EXPORTAR Y SUPRIMIR ############"
printf "  exportar los datos del contacto: " ; api "{\"accion\":\"crm_exportar\",\"id\":$A}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('ok:', d.get('ok'), '· claves:', list((d.get('datos') or {}).keys()))"
printf "  suprimir sus datos: " ; api "{\"accion\":\"crm_suprimir\",\"id\":$A,\"motivo\":\"Prueba de supresión\"}" | res
echo "  ¿queda el lead?: $(Q "SELECT COUNT(*) FROM \`lead\` WHERE id=$A") (0 = borrado) · ¿sigue en la lista de exclusión?: $(Q "SELECT COUNT(*) FROM email_exclusion WHERE email='prueba-fase7-alfa@example.com'") (1 = sí, para no volver a escribir)"

echo
echo "############ 9. MÉTRICAS (reales, y lo que no se mide se dice) ############"
api '{"accion":"captacion_metricas"}' | python3 -c "
import json,sys
m=json.load(sys.stdin)['metricas']
print('     reales:', json.dumps(m['reales'], ensure_ascii=False))
print('     no disponibles:', m['noDisponibles'])
"
echo "  (las cifras excluyen los leads marcados PRUEBA)"

echo
echo "############ 10. AUDITORÍA ############"
L "SELECT CONCAT('   ', accion, ' · ', COALESCE(entidad,'-'), ' · ', LEFT(COALESCE(detalle,''),80)) FROM admin_auditoria WHERE accion LIKE 'ia:%' ORDER BY id DESC LIMIT 6"

echo
echo "############ LIMPIEZA DE LOS DATOS FICTICIOS ############"
Q "DELETE FROM email_respuesta WHERE email LIKE 'prueba-fase7%'"
Q "DELETE FROM lead_contacto WHERE lead_id IN (SELECT id FROM \`lead\` WHERE empresa LIKE 'PRUEBA FASE 7%')"
Q "DELETE FROM lead_estado_historial WHERE lead_id IN (SELECT id FROM \`lead\` WHERE empresa LIKE 'PRUEBA FASE 7%')"
Q "DELETE FROM \`lead\` WHERE empresa LIKE 'PRUEBA FASE 7%'"
Q "DELETE FROM email_exclusion WHERE email LIKE 'prueba-fase7%'"
L "DELETE FROM admin_auditoria WHERE accion LIKE 'ia:%' AND detalle LIKE '%PRUEBA FASE 7%'"
L "DELETE FROM usuario_sesion WHERE user_agent='prueba-fase7'"
echo "  leads de prueba que quedan: $(Q "SELECT COUNT(*) FROM \`lead\` WHERE empresa LIKE 'PRUEBA%'") · sesiones: $(L "SELECT COUNT(*) FROM usuario_sesion WHERE user_agent='prueba-fase7'")"
echo "  leads reales que quedan (los del piloto): $(Q "SELECT COUNT(*) FROM \`lead\` WHERE empresa NOT LIKE 'PRUEBA%'")"
echo "  catálogo: $(Q "SELECT CONCAT((SELECT SUM(status='published') FROM accommodation), ' publicados · ', (SELECT COUNT(*) FROM experiencia), ' experiencias · ', (SELECT COUNT(*) FROM servicio_turistico), ' servicios')")"
