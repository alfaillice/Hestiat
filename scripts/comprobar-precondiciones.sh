#!/usr/bin/env bash
# =============================================================================
# Hestiat — Comprobación de las tres precondiciones de HESTIAT-OPERATIONS.md
#
#   1. La base de datos nueva existe y el usuario tiene permisos
#   2. El bucket privado de copias es utilizable y NO es público
#   3. El acceso operativo: IP desbloqueada (desde fuera) o SSH operativo
#
# Veredicto LISTO / FALTA ... · sale con 0 si todo está listo, 1 si falta algo.
#
# USO
#   bash comprobar-precondiciones.sh --destino hestiat2 --bucket hestiat-backups
#   bash comprobar-precondiciones.sh --destino hestiat2 --bucket hestiat-backups \
#        --bucket-publica https://pub-xxxx.r2.dev --ip 13.51.14.197
#   bash comprobar-precondiciones.sh --solo-resumen
# =============================================================================
set -uo pipefail

ENVF="/home/ppxgfdyc/hestiat-app.env"
DESTINO="hestiat2"
BUCKET="hestiat-backups"
BUCKET_PUBLICA=""
IP="13.51.14.197"
DOMINIO="https://hestiat.com"
RESUMEN=0
OK=0
FALTA=0
FALTAS=""

log()  { printf '%s\n' "$*"; }
pasa() { OK=$((OK+1)); printf '  [ LISTO ]  %s\n' "$*"; }
falla(){ FALTA=$((FALTA+1)); FALTAS="${FALTAS}\n  · $*"; printf '  [ FALTA ]  %s\n' "$*"; }
aviso(){ printf '  [ AVISO ]  %s\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --destino)        DESTINO="${2:-}"; shift 2 ;;
    --bucket)         BUCKET="${2:-}"; shift 2 ;;
    --bucket-publica) BUCKET_PUBLICA="${2:-}"; shift 2 ;;
    --ip)             IP="${2:-}"; shift 2 ;;
    --env)            ENVF="${2:-}"; shift 2 ;;
    --dominio)        DOMINIO="${2:-}"; shift 2 ;;
    --solo-resumen)   RESUMEN=1; shift ;;
    -h|--help)        sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "opción desconocida: $1"; exit 1 ;;
  esac
done

CNF=""
limpiar() { [ -n "$CNF" ] && rm -f "$CNF"; return 0; }
trap limpiar EXIT
leer_var() {
  [ -r "$ENVF" ] || return 1
  awk -v k="$1" 'index($0,k"=")==1 { sub("^"k"=",""); gsub(/^[ \t"'"'"']+|[ \t"'"'"']+$/,""); print; exit }' "$ENVF"
}

if [ "$RESUMEN" != "1" ]; then
  log "=== Hestiat · comprobación de precondiciones ==="
  log "  destino=$DESTINO · bucket=$BUCKET · ip=$IP"
  log ""
  log "-- 1) Base de datos nueva y permisos --"
fi

if ! command -v mysql >/dev/null 2>&1; then
  aviso "no hay cliente 'mysql' aquí: esta comprobación se hace en el servidor"
  aviso "en cPanel: comprueba que la base '$DESTINO' existe y que el usuario tiene TODOS los privilegios"
elif [ ! -r "$ENVF" ]; then
  falla "no puedo leer la configuración $ENVF (sin ella no hay credenciales)"
else
  CNF="$(mktemp)"; chmod 600 "$CNF"
  { echo "[client]"; echo "host=$(leer_var DB_HOST)"; echo "user=$(leer_var DB_USER)"; echo "password=$(leer_var DB_PASSWORD)"; } > "$CNF"
  DB_PROD="$(leer_var DB_NAME)"
  if [ "$DESTINO" = "$DB_PROD" ]; then
    falla "'$DESTINO' es la base de PRODUCCIÓN: el destino debe ser una base nueva"
  elif mysql --defaults-extra-file="$CNF" -e "CREATE DATABASE IF NOT EXISTS \`$DESTINO\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci" 2>/dev/null; then
    pasa "el usuario puede crear/acceder a la base '$DESTINO'"
  else
    falla "sin permiso para '$DESTINO'. En cPanel: créala y añade el usuario con TODOS los privilegios"
  fi
  ND="$(mysql --defaults-extra-file="$CNF" -N -B -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DESTINO'" 2>/dev/null || echo 0)"
  aviso "tablas actuales en '$DESTINO': ${ND:-0} (0 es lo esperable antes de restaurar)"
fi

if [ "$RESUMEN" != "1" ]; then log ""; log "-- 2) Bucket privado de copias --"; fi
ACCT="$(leer_var R2_ACCOUNT_ID)"
if [ -z "$ACCT" ]; then
  falla "no puedo leer R2_ACCOUNT_ID: no puedo comprobar R2"
else
  COD="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://${ACCT}.r2.cloudflarestorage.com/${BUCKET}/" || echo 000)"
  case "$COD" in
    403|400|401) pasa "el bucket '$BUCKET' existe y exige credenciales (HTTP $COD)" ;;
    404)         falla "el bucket '$BUCKET' no existe todavía (HTTP 404)" ;;
    200)         falla "el bucket '$BUCKET' responde 200 sin credenciales: puede ser público" ;;
    *)           aviso "respuesta inesperada del bucket (HTTP $COD): revísalo en el panel" ;;
  esac
  if [ -n "$BUCKET_PUBLICA" ]; then
    COD2="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${BUCKET_PUBLICA%/}/${BUCKET}/" || echo 000)"
    if [ "$COD2" = "200" ]; then
      falla "el bucket de copias parece PÚBLICO: no metas datos privados ahí"
    else
      pasa "el bucket de copias no se sirve por la base pública (HTTP $COD2)"
    fi
  else
    aviso "sin --bucket-publica no puedo comprobar si es público: confírmalo en el panel"
    aviso "regla: en el bucket público NUNCA entra nada privado"
  fi
fi

if [ "$RESUMEN" != "1" ]; then log ""; log "-- 3) Acceso operativo --"; fi
COD3="$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$DOMINIO/" || echo 000)"
case "$COD3" in
  200|30*) pasa "el sitio responde desde aquí (HTTP $COD3): la IP no está bloqueada" ;;
  000)     falla "sin respuesta (HTTP 000): la IP $IP sigue bloqueada por cpguard/imunify" ;;
  *)       falla "respuesta HTTP $COD3: revisa el cortafuegos" ;;
esac
HC="${DOMINIO#https://}"; HC="${HC%%/*}"
if timeout 6 bash -c "</dev/tcp/${HC}/22" 2>/dev/null; then
  pasa "SSH responde en ${HC}:22"
else
  aviso "SSH no responde en el puerto 22 (cerrado o filtrado)"
fi

log ""
if [ "$FALTA" -eq 0 ]; then
  log "=============================================="
  log "  VEREDICTO: LISTO para restaurar y verificar"
  log "  ($OK comprobaciones correctas)"
  log "=============================================="
  log "  Lanza: bash scripts/restaurar-verificado.sh --destino $DESTINO --volcado <ruta .sql.gz>"
  exit 0
else
  log "=============================================="
  log "  VEREDICTO: FALTA ${FALTA} cosa(s)"
  printf "%b\n" "$FALTAS"
  log "=============================================="
  log "  Remedios detallados: docs/HESTIAT-OPERATIONS.md"
  exit 1
fi
