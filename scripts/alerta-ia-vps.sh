#!/bin/bash
# =============================================================================
# ALERTA AUTOMÁTICA DEL AGENTE DE IA — Hestiat
#
# Avisa al administrador por correo cuando la conexión con el modelo no está sana:
#   · la clave está en el fichero pero el servicio NO la ve (falta reinicio o permisos rotos)
#   · la clave no está configurada (un solo aviso, para no llenar el buzón)
#   · el proveedor RECHAZA la credencial (401/403)
#   · el proveedor no responde
#
# Se apoya en lo que ya existe: el mismo fichero de entorno del servicio, el mismo correo saliente que
# usa Hestiat para las reservas y el mismo registro que la vigilancia del VPS. La credencial de correo
# va por un fichero netrc temporal (nunca como argumento, para que no aparezca en la lista de procesos).
#
# Comprobación de credencial: se llama al endpoint de modelos del proveedor, que NO consume tokens.
#
# Se ejecuta por temporizador cada 15 minutos; también a mano:  bash /root/hestiat-alerta-ia.sh
# =============================================================================
umask 077

ENVF=/opt/hestiat/shared/.env
ESTADO=/var/lib/hestiat/alerta-ia.estado
LOG=/var/log/hestiat/alerta-ia.log
mkdir -p /var/lib/hestiat
[ -f "$ESTADO" ] || echo "desconocido" > "$ESTADO"

loguear() { echo "$(date -u '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

# --- credenciales del entorno del servicio (nunca se imprimen) ----------------------------------
[ -f "$ENVF" ] || { loguear "FALLO no existe $ENVF"; exit 1; }
set -a; . "$ENVF"; set +a

BASE_URL="${IA_BASE_URL:-https://api.openai.com/v1}"
BASE_URL="${BASE_URL%/}"

# --- 1. ¿hay línea en el fichero y la ve el proceso? --------------------------------------------
EN_FICHERO=$(grep -c '^IA_API_KEY=' "$ENVF" 2>/dev/null || true); EN_FICHERO=${EN_FICHERO:-0}
PID=$(systemctl show hestiat -p MainPID --value 2>/dev/null || echo 0)
EN_PROCESO=$(tr '\0' '\n' < "/proc/$PID/environ" 2>/dev/null | grep -c '^IA_API_KEY=' || true); EN_PROCESO=${EN_PROCESO:-0}
CLAVE=$(tr '\0' '\n' < "/proc/$PID/environ" 2>/dev/null | sed -n 's/^IA_API_KEY=//p' | head -1)

# --- 2. estado ----------------------------------------------------------------------------------
MOTIVO=""
if [ "${EN_FICHERO:-0}" -ge 1 ] 2>/dev/null && [ "${EN_PROCESO:-0}" -eq 0 ] 2>/dev/null; then
  NUEVO="no_cargada"
  MOTIVO="La clave está en el fichero pero el servicio no la ve: falta reiniciar (systemctl restart hestiat) o se han roto los permisos del fichero."
elif [ "${EN_FICHERO:-0}" -eq 0 ] 2>/dev/null; then
  NUEVO="sin_clave"
  MOTIVO="No hay clave del modelo configurada. El agente no puede conversar: añádela con bash /root/poner-clave-ia.sh"
elif [ -z "$CLAVE" ]; then
  NUEVO="no_cargada"
  MOTIVO="El servicio no tiene valor para IA_API_KEY: revisa el fichero y reinicia."
else
  # Comprobación real y gratuita: el endpoint de modelos no consume tokens.
  CODIGO=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 -H "Authorization: Bearer $CLAVE" "$BASE_URL/models" 2>/dev/null || echo 000)
  case "$CODIGO" in
    200|204) NUEVO="ok"; MOTIVO="Conexión correcta (HTTP $CODIGO)." ;;
    401|403) NUEVO="credencial_rechazada"; MOTIVO="El proveedor RECHAZA la credencial (HTTP $CODIGO). Rota la clave en el panel del proveedor y vuelve a configurarla." ;;
    000)     NUEVO="proveedor_caido"; MOTIVO="El proveedor no responde (sin conexión o tiempo agotado)." ;;
    *)       NUEVO="proveedor_error"; MOTIVO="El proveedor responde HTTP $CODIGO a la comprobación de credencial." ;;
  esac
fi
unset CLAVE

ANTERIOR=$(cat "$ESTADO" 2>/dev/null | head -1)
loguear "estado=$NUEVO (antes=$ANTERIOR) $MOTIVO"
echo "$NUEVO" > "$ESTADO"

# --- 3. ¿hay que avisar? ------------------------------------------------------------------------
if [ "$NUEVO" = "ok" ]; then
  # Si vuelve a estar bien y antes no lo estaba, se avisa del restablecimiento.
  if [ "$ANTERIOR" != "ok" ] && [ "$ANTERIOR" != "desconocido" ]; then
    ASUNTO="[Hestiat] El agente de IA vuelve a estar conectado"
  else
    exit 0
  fi
else
  # Se avisa cuando el estado cambia. Si sigue igual de mal, un recordatorio cada 24 horas.
  ULTIMO_AVISO=$(stat -c %Y "$ESTADO.aviso" 2>/dev/null || echo 0)
  AHORA=$(date +%s)
  if [ "$NUEVO" != "$ANTERIOR" ] || [ $((AHORA - ULTIMO_AVISO)) -ge 86400 ]; then
    ASUNTO="[Hestiat] ALERTA: la conexión del agente de IA no está sana ($NUEVO)"
  else
    exit 0
  fi
fi

# --- 4. destinatario: el administrador, leído de la base de datos -------------------------------
DESTINO=$(mariadb -u"${DB_USER:-hestiat}" ${DB_PASSWORD:+-p"$DB_PASSWORD"} -N -B "${DB_NAME_LEGACY:-hestiat}" \
  -e "SELECT email FROM usuario WHERE rol='admin' AND activo=1 ORDER BY id LIMIT 1" 2>/dev/null | head -1)
[ -n "$DESTINO" ] || DESTINO="${SMTP_FROM:-hola@hestiat.com}"
# SMTP_FROM puede ser «Hestiat <hola@hestiat.com>»: para el sobre hace falta solo la dirección.
REMITE=$(printf '%s' "${SMTP_FROM:-hola@hestiat.com}" | grep -oE '[^ <]+@[^ >]+' | head -1)
[ -n "$REMITE" ] || REMITE="${SMTP_USER:-hola@hestiat.com}"

CUERPO=$(mktemp)
cat > "$CUERPO" <<FIN
Aviso automático de Hestiat (servidor $(hostname), $(curl -sS --max-time 8 https://ifconfig.me 2>/dev/null || echo "IP desconocida")).

Estado de la conexión con el modelo de IA: $NUEVO
Motivo: $MOTIVO

Comprobaciones:
  1. Línea IA_API_KEY en /opt/hestiat/shared/.env ...... $EN_FICHERO  (debe ser 1)
  2. ¿La ve el proceso del servicio? ................... $EN_PROCESO  (debe ser 1)
  3. Estado del servicio hestiat ....................... $(systemctl is-active hestiat)

Qué hacer:
  · Ver el detalle sin mostrar la clave:  bash /root/comprobar-clave.sh
  · Añadir o rotar la clave:              bash /root/poner-clave-ia.sh
  · Validar la conexión completa:         bash /root/pruebas-ia-conectada.sh --real
  · Procedimiento completo:               docs/OPERACIONES-CLAVE-IA.md (en el repositorio)

Registro: /var/log/hestiat/alerta-ia.log
FIN

# --- 5. envío (netrc temporal: la contraseña no aparece en la lista de procesos) ----------------
if [ -n "${SMTP_HOST:-}" ] && [ -n "${SMTP_USER:-}" ] && [ -n "${SMTP_PASSWORD:-}" ]; then
  NETRC=$(mktemp)
  printf 'machine %s login %s password %s\n' "$SMTP_HOST" "$SMTP_USER" "$SMTP_PASSWORD" > "$NETRC"
  chmod 600 "$NETRC"
  RESULTADO=$(curl -sS --netrc-file "$NETRC" --ssl-reqd --url "smtps://${SMTP_HOST}:${SMTP_PORT:-465}" \
    --mail-from "$REMITE" --mail-rcpt "$DESTINO" --upload-file "$CUERPO" -w '%{http_code}' 2>&1 | tail -1)
  rm -f "$NETRC"
  loguear "aviso enviado a $DESTINO · resultado: $RESULTADO"
  touch "$ESTADO.aviso"
else
  loguear "no se pudo avisar: faltan datos de correo en el entorno"
fi
rm -f "$CUERPO"
