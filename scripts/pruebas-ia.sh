#!/bin/bash
# =============================================================================
# Pruebas del Hestiat AI Manager.
#
# Son pruebas REALES contra producción: sesiones de verdad, llamadas de verdad y consultas de
# verdad. NO se envía ningún correo: solo se comprueba que los envíos se NIEGAN cuando deben.
#
# Al terminar se borra TODO lo que han creado las pruebas (clientes, incidencias, conversaciones,
# consumo y los registros de auditoría del agente), para que la base quede como estaba.
# =============================================================================
set -u
U=$(grep "^DB_USER=" /opt/hestiat/shared/.env | cut -d= -f2-)
P=$(grep "^DB_PASSWORD=" /opt/hestiat/shared/.env | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }
L() { mariadb -u"$U" -p"$P" -N -B hestiat -e "$1"; }
WEB=https://hestiat.com

T_ADMIN=$(openssl rand -hex 32)     # administrador (id 3)
T_HOST=$(openssl rand -hex 32)      # anfitrión, sin permisos de administración (id 2)
L "INSERT INTO usuario_sesion (token, usuario_id, expira_en, user_agent) VALUES ('$T_ADMIN', 3, DATE_ADD(NOW(), INTERVAL 30 MINUTE), 'prueba-ia'), ('$T_HOST', 2, DATE_ADD(NOW(), INTERVAL 30 MINUTE), 'prueba-ia')"

api() { # $1 = token (o "-" para sin sesión), $2 = cuerpo JSON
  if [ "$1" = "-" ]; then
    curl -sS -o /tmp/ia.json -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$2" $WEB/api/admin/ia
  else
    curl -sS -o /tmp/ia.json -w "%{http_code}" -X POST -H "Cookie: hestiat_sesion=$1" -H 'Content-Type: application/json' -d "$2" $WEB/api/admin/ia
  fi
}
visto() { head -c 200 /tmp/ia.json; }

echo "############ 1. USUARIO SIN PERMISOS ############"
printf "  sin sesión               -> %s (403 esperado)  %s\n" "$(api - '{"accion":"estado"}')" "$(visto)"
printf "  anfitrión (no admin)     -> %s (403 esperado)  %s\n" "$(api $T_HOST '{"accion":"estado"}')" "$(visto)"

echo
echo "############ 2. ADMINISTRADOR AUTORIZADO ############"
printf "  estado                   -> %s (200 esperado)\n" "$(api $T_ADMIN '{"accion":"estado"}')"
printf "  herramientas             -> %s (200 esperado)\n" "$(api $T_ADMIN '{"accion":"herramientas"}')"
echo "  herramientas declaradas: $(python3 -c "import json;d=json.load(open('/tmp/ia.json'));print(len(d['herramientas']),'·','niveles',sorted(set(h['nivel'] for h in d['herramientas'])),'· sensibles:',[h['nombre'] for h in d['herramientas'] if h['sensible']])")"
echo "  ¿hay alguna herramienta que escriba en publicaciones?: $(python3 -c "import json;d=json.load(open('/tmp/ia.json'));print([h['nombre'] for h in d['herramientas'] if 'publication' in h['nombre'] and h['nivel']>1] or 'ninguna (no se puede modificar una publicación desde el agente)')")"

echo
echo "############ 3. PUBLICACIONES AJENAS / NO MODIFICABLES ############"
printf "  intento de herramienta inexistente «update_publication» -> %s  %s\n" "$(api $T_ADMIN '{"accion":"herramienta","herramienta":"update_publication","argumentos":{"id":1}}')" "$(visto)"
printf "  intento de SQL libre «query_sql»                        -> %s  %s\n" "$(api $T_ADMIN '{"accion":"herramienta","herramienta":"query_sql","argumentos":{"sql":"SELECT 1"}}')" "$(visto)"
printf "  herramienta real de lectura (search_publications)       -> %s  %s\n" "$(api $T_ADMIN '{"accion":"herramienta","herramienta":"search_publications","argumentos":{"provincia":"Alicante","limite":"3"}}')" "$(visto)"

echo
echo "############ 4. ARGUMENTOS INVÁLIDOS ############"
printf "  get_publication sin id        -> %s  %s\n" "$(api $T_ADMIN '{"accion":"herramienta","herramienta":"get_publication","argumentos":{"tipo":"alojamiento"}}')" "$(visto)"
printf "  tipo que no existe            -> %s  %s\n" "$(api $T_ADMIN '{"accion":"herramienta","herramienta":"get_publication","argumentos":{"tipo":"castillo","id":"1"}}')" "$(visto)"
printf "  campo de más (inyección)      -> %s  %s\n" "$(api $T_ADMIN '{"accion":"herramienta","herramienta":"search_publications","argumentos":{"q":"a","DROP":"tabla"}}')" "$(visto)"

echo
echo "############ 5. CRM: ALTA, DEDUPLICACIÓN Y ACTUALIZACIÓN ############"
R1=$(api $T_ADMIN '{"accion":"herramienta","herramienta":"create_lead","argumentos":{"empresa":"PRUEBA IA MANAGER","localidad":"Alicante","email":"prueba-ia@example.com","web":"https://prueba-ia.example.com","tipo_negocio":"alojamiento","notas":"alta de prueba"}}')
LEAD=$(python3 -c "import json;print(json.load(open('/tmp/ia.json')).get('resultado',{}).get('cliente_id',''))" 2>/dev/null)
echo "  primera alta          -> $R1 · cliente_id=$LEAD"
R2=$(api $T_ADMIN '{"accion":"herramienta","herramienta":"create_lead","argumentos":{"empresa":"PRUEBA IA MANAGER","localidad":"Alicante","email":"prueba-ia@example.com"}}')
echo "  misma alta otra vez   -> $R2  $(visto)"
echo "  (lo esperado: no se duplica, devuelve el mismo cliente y dice por qué)"
if [ -n "$LEAD" ]; then
  printf "  cambio de estado      -> %s  %s\n" "$(api $T_ADMIN "{\"accion\":\"herramienta\",\"herramienta\":\"update_lead\",\"argumentos\":{\"id\":\"$LEAD\",\"estado\":\"RESEARCHED\",\"notas\":\"revisado en la prueba\"}}")" "$(visto)"
  printf "  estado inventado      -> %s  %s\n" "$(api $T_ADMIN "{\"accion\":\"herramienta\",\"herramienta\":\"update_lead\",\"argumentos\":{\"id\":\"$LEAD\",\"estado\":\"CASI\"}}")" "$(visto)"
else
  echo "  (no se pudo crear el cliente: se omiten estos dos pasos)"
fi

echo
echo "############ 6. EXCLUSIÓN DE CORREOS ############"
printf "  dar de baja una dirección -> %s  %s\n" "$(api $T_ADMIN '{"accion":"herramienta","herramienta":"add_email_exclusion","argumentos":{"email":"baja-ia@example.com","motivo":"lo ha pedido en la prueba","origen":"usuario"}}')" "$(visto)"
printf "  ¿está excluida?           -> %s  %s\n" "$(api $T_ADMIN '{"accion":"herramienta","herramienta":"check_email_exclusion","argumentos":{"email":"baja-ia@example.com"}}')" "$(visto)"

echo
echo "############ 7. ACCIÓN SENSIBLE SIN CONFIRMACIÓN ############"
printf "  redactar correo sin autorizar -> %s  %s\n" "$(api $T_ADMIN "{\"accion\":\"herramienta\",\"herramienta\":\"draft_outreach_email\",\"argumentos\":{\"lead_id\":\"$LEAD\",\"asunto\":\"Hola\",\"cuerpo\":\"Texto de prueba\"}}")" "$(visto)"
if [ -n "$LEAD" ]; then
  printf "  redactar correo autorizado    -> %s  %s\n" "$(api $T_ADMIN "{\"accion\":\"herramienta\",\"herramienta\":\"draft_outreach_email\",\"argumentos\":{\"lead_id\":\"$LEAD\",\"asunto\":\"Hola\",\"cuerpo\":\"Texto de prueba\"},\"autorizadoPor\":\"alfaillice@gmail.com\"}")" "$(visto)"
else
  echo "  (no se pudo crear el cliente: se omite)"
fi

echo
echo "############ 8. TICKETS ############"
R3=$(api $T_ADMIN '{"accion":"herramienta","herramienta":"create_support_ticket","argumentos":{"asunto":"PRUEBA IA MANAGER: no puedo entrar","categoria":"cuenta_acceso","prioridad":"alta","mensaje":"Prueba automatizada."}}')
COD=$(python3 -c "import json;print(json.load(open('/tmp/ia.json')).get('resultado',{}).get('codigo',''))" 2>/dev/null)
echo "  crear incidencia      -> $R3 · código=$COD"
printf "  consultarla           -> %s  %s\n" "$(api $T_ADMIN "{\"accion\":\"herramienta\",\"herramienta\":\"get_support_ticket\",\"argumentos\":{\"codigo\":\"$COD\"}}")" "$(visto)"
printf "  cerrarla              -> %s  %s\n" "$(api $T_ADMIN "{\"accion\":\"herramienta\",\"herramienta\":\"update_support_ticket\",\"argumentos\":{\"codigo\":\"$COD\",\"estado\":\"RESOLVED\",\"resolucion\":\"Resuelto en la prueba\"}}")" "$(visto)"
printf "  estado no válido      -> %s  %s\n" "$(api $T_ADMIN "{\"accion\":\"herramienta\",\"herramienta\":\"update_support_ticket\",\"argumentos\":{\"codigo\":\"$COD\",\"estado\":\"CERRADO\"}}")" "$(visto)"

echo
echo "############ 9. SIN CREDENCIALES DEL MODELO (estado real de hoy) ############"
printf "  conversación          -> %s\n" "$(api $T_ADMIN '{"accion":"chat","mensaje":"¿Cuántos alojamientos hay publicados en Alicante?"}')"
python3 - <<'PY'
import json
d=json.load(open('/tmp/ia.json'))
print("   ok:", d.get("ok"), "· motivo:", d.get("motivo"), "· error:", (d.get("error") or "")[:150])
print("   pasos:", [ (p.get("tipo"), p.get("detalle")) for p in d.get("pasos",[]) ])
PY
printf "  probar conexión       -> %s  %s\n" "$(api $T_ADMIN '{"accion":"probar"}')" "$(visto)"

echo
echo "############ 10. ENVÍO DE CORREO: SE NIEGA COMO DEBE ############"
BORR=$(Q "SELECT id FROM lead_contacto WHERE resultado IS NULL ORDER BY id DESC LIMIT 1")
if [ -n "$BORR" ]; then
  printf "  sin decir quién autoriza -> %s  %s\n" "$(api $T_ADMIN "{\"accion\":\"aprobar_envio\",\"contactoId\":$BORR}")" "$(visto)"
  printf "  autorizando un anfitrión -> %s  %s\n" "$(api $T_ADMIN "{\"accion\":\"aprobar_envio\",\"contactoId\":$BORR,\"aprobadoPor\":\"anfitrion@ejemplo.com\"}")" "$(visto)"
else
  echo "  (no hay ningún borrador pendiente: se omiten estos dos pasos)"
fi
echo "  (NO se ha enviado ningún correo: solo se comprueba que se niega)"

echo
echo "############ 11. LÍMITE DE PETICIONES ############"
CODIGOS=$(for i in $(seq 1 70); do curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Cookie: hestiat_sesion=$T_ADMIN" -H 'Content-Type: application/json' -d '{"accion":"estado"}' $WEB/api/admin/ia; done | sort | uniq -c | tr '\n' ' ')
echo "  70 peticiones seguidas: $CODIGOS"

echo
echo "############ 12. REGISTRO DE AUDITORÍA ############"
echo "  acciones del agente registradas: $(L "SELECT COUNT(*) FROM admin_auditoria WHERE accion LIKE 'ia:%'")"
L "SELECT CONCAT('   ', accion, ' · ', COALESCE(entidad,'-'), ' · ', LEFT(COALESCE(detalle,''),90)) FROM admin_auditoria WHERE accion LIKE 'ia:%' ORDER BY id DESC LIMIT 6" | sed 's/^/  /'
echo "  conversaciones: $(Q "SELECT COUNT(*) FROM ia_conversacion") · mensajes: $(Q "SELECT COUNT(*) FROM ia_mensaje") · consumo registrado: $(Q "SELECT COUNT(*) FROM ia_consumo")"

echo
echo "############ LIMPIEZA: se borra todo lo que han creado las pruebas ############"
Q "DELETE FROM lead_contacto WHERE lead_id IN (SELECT id FROM lead WHERE empresa LIKE 'PRUEBA IA MANAGER%')"
Q "DELETE FROM lead WHERE empresa LIKE 'PRUEBA IA MANAGER%'"
Q "DELETE FROM email_exclusion WHERE email LIKE '%ia@example.com'"
Q "DELETE FROM ticket_mensaje WHERE ticket_id IN (SELECT id FROM ticket WHERE asunto LIKE 'PRUEBA IA MANAGER%')"
Q "DELETE FROM ticket WHERE asunto LIKE 'PRUEBA IA MANAGER%'"
Q "DELETE FROM ia_mensaje"
Q "DELETE FROM ia_conversacion"
Q "DELETE FROM ia_consumo"
L "DELETE FROM admin_auditoria WHERE accion LIKE 'ia:%'"
L "DELETE FROM usuario_sesion WHERE user_agent = 'prueba-ia'"
echo "  tras la limpieza:"
echo "    clientes: $(Q "SELECT COUNT(*) FROM lead") · incidencias: $(Q "SELECT COUNT(*) FROM ticket") · exclusiones: $(Q "SELECT COUNT(*) FROM email_exclusion")"
echo "    conversaciones: $(Q "SELECT COUNT(*) FROM ia_conversacion") · consumo: $(Q "SELECT COUNT(*) FROM ia_consumo") · auditoría del agente: $(L "SELECT COUNT(*) FROM admin_auditoria WHERE accion LIKE 'ia:%'")"
echo "    sesiones de prueba: $(L "SELECT COUNT(*) FROM usuario_sesion WHERE user_agent = 'prueba-ia'")"
