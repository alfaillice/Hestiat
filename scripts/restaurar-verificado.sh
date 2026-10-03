#!/usr/bin/env bash
# =============================================================================
# Hestiat — Restauración y verificación de la copia de seguridad de la base
#
# QUÉ HACE
#   Ejecuta el procedimiento de 7 pasos de docs/HESTIAT-OPERATIONS.md:
#     1. Obtener el volcado (local o descargándolo)
#     2. Validar la integridad del archivo con gzip -t
#     3. Comprobar el cierre limpio y el número de tablas del propio volcado
#     4. Restaurar en la base DESTINO
#     5. Verificar: 33 tablas y TODOS los recuentos de filas coincidentes
#     6. Registrar el resultado y calcular el SHA-256
#     7. Redactar el ACTA DE COPIA VERIFICADA
#
# DÓNDE SE EJECUTA
#   En el servidor (terminal de cPanel o SSH), que es donde están el volcado y la
#   base de datos. NO se ejecuta en el entorno de trabajo: allí no hay MySQL.
#
# CUÁNDO
#   Cuando estén cerrados los tres bloqueos de HESTIAT-OPERATIONS.md:
#     · base de datos DESTINO creada y con el usuario añadido con permisos
#     · bucket privado para las copias (para guardar el acta y el archivo)
#     · (el desbloqueo de la IP es para el trabajo remoto, no para este script)
#
# SEGURIDAD
#   · NO modifica la base de producción: solo la lee para contar filas.
#   · Restaura SIEMPRE en la base DESTINO, nunca en la de producción.
#   · Si DESTINO es temporal, lo elimina al terminar; si es la base definitiva
#     de Hestiat 2.0, la conserva.
#   · Las credenciales van a un fichero temporal 0600 y NUNCA se imprimen.
#   · Con --dry-run no toca nada: solo informa de lo que haría.
#
# USO
#   bash restaurar-verificado.sh --destino hestiat2 --volcado /home/ppxgfdyc/backups/hestiat-...sql.gz
#   bash restaurar-verificado.sh --destino ppxgfdyc_hestiat_verif --temporal
#   bash restaurar-verificado.sh --destino hestiat2 --descargar usuario@servidor:/home/ppxgfdyc/backups/hestiat-...sql.gz
#   bash restaurar-verificado.sh --destino hestiat2 --dry-run
#
# CÓDIGOS DE SALIDA
#   0 copia VERIFICADA · 1 error de precondición · 2 integridad o recuentos incorrectos
# =============================================================================
set -uo pipefail

# ------------------------------------------------------------------ defectos --
ENVF="/home/ppxgfdyc/hestiat-app.env"          # solo lectura; de aquí salen las credenciales
VOLCADO=""
DESTINO=""
TEMPORAL=0
DESCARGAR=""
ESPERADO_TABLAS=33
ACTA_DIR="/home/ppxgfdyc/backups"
LOG_TXT=""
DRY=0
TABLAS_CLAVE="accommodation alojamiento usuario user reserva reservation resena review experiencia servicio_turistico nucleo ical_feed calendar_feed"

# ------------------------------------------------------------------ utilidades --
log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; [ -n "${LOG_TXT}" ] && printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" >> "${LOG_TXT}"; return 0; }
die() { log "ERROR: $*"; limpiar; exit "${2:-1}"; }
limpiar() { [ -n "${CNF:-}" ] && rm -f "${CNF}"; [ -n "${LOCK:-}" ] && rmdir "${LOCK}" 2>/dev/null; return 0; }
usage() { sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

# lee una clave del .env soportando comillas
leer_var() {
  awk -v k="$1" '
    index($0, k"=") == 1 {
      sub("^"k"=", "");
      gsub(/^[ \t"'"'"']+|[ \t"'"'"']+$/, "");
      print; exit
    }' "$ENVF"
}

# ------------------------------------------------------------------ argumentos --
while [ $# -gt 0 ]; do
  case "$1" in
    --destino)   DESTINO="${2:-}"; shift 2 ;;
    --volcado)   VOLCADO="${2:-}"; shift 2 ;;
    --descargar) DESCARGAR="${2:-}"; shift 2 ;;
    --temporal)  TEMPORAL=1; shift ;;
    --acta-dir)  ACTA_DIR="${2:-}"; shift 2 ;;
    --env)       ENVF="${2:-}"; shift 2 ;;
    --esperado)  ESPERADO_TABLAS="${2:-33}"; shift 2 ;;
    --dry-run)   DRY=1; shift ;;
    -h|--help)   usage ;;
    *) echo "opción desconocida: $1"; usage ;;
  esac
done

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$ACTA_DIR" 2>/dev/null
LOG_TXT="$ACTA_DIR/restauracion-$STAMP.log"
ACTA="$ACTA_DIR/ACTA-COPIA-VERIFICADA-$STAMP.md"

log "=== Hestiat · restauración y verificación de copia · $STAMP ==="
[ "$DRY" = "1" ] && log "MODO SIMULACIÓN: no se modificará nada"

# ------------------------------------------------------- precondiciones --
for c in mysqldump mysql gzip awk sha256sum; do
  command -v "$c" >/dev/null 2>&1 || die "falta la herramienta '$c'"
done
[ -r "$ENVF" ] || die "no puedo leer la configuración: $ENVF"
[ -n "$DESTINO" ] || die "falta --destino (nombre de la base donde restaurar)"

DB_PROD="$(leer_var DB_NAME)"
[ -n "$DB_PROD" ] || die "no puedo leer DB_NAME de la configuración"

if [ "$DESTINO" = "$DB_PROD" ]; then
  die "el destino NO puede ser la base de producción ($DB_PROD). Usa una base nueva." 1
fi

# cerrojo: una sola ejecución a la vez
LOCK="$ACTA_DIR/.restauracion.lock"
if ! mkdir "$LOCK" 2>/dev/null; then die "ya hay una restauración en curso"; fi
trap 'limpiar' EXIT

# credenciales en fichero temporal 0600 (nunca en la línea de comandos ni en el registro)
CNF="$(mktemp)"
chmod 600 "$CNF"
{
  echo "[client]"
  echo "host=$(leer_var DB_HOST)"
  echo "user=$(leer_var DB_USER)"
  echo "password=$(leer_var DB_PASSWORD)"
} > "$CNF"
log "credenciales preparadas en fichero temporal 0600 (contenido no mostrado)"

Q() { mysql --defaults-extra-file="$CNF" -N -B -e "$1" 2>/dev/null; }

# =========================================================== PASO 1: volcado ==
log "== PASO 1: obtener el volcado =="
if [ -z "$VOLCADO" ] && [ -n "$DESCARGAR" ]; then
  case "$DESCARGAR" in
    http://*|https://*) FNAME="$ACTA_DIR/$(basename "$DESCARGAR")"
        log "descargando por HTTP: $(basename "$DESCARGAR")"
        [ "$DRY" = "1" ] || curl -fsSL --retry 3 -o "$FNAME" "$DESCARGAR" || die "fallo la descarga por HTTP"
        VOLCADO="$FNAME" ;;
    *:*) DEST_REMOTO="$DESCARGAR"
        NOMBRE="${DEST_REMOTO##*/}"
        FNAME="$ACTA_DIR/$NOMBRE"
        log "descargando por scp/rsync: $NOMBRE"
        if command -v rsync >/dev/null 2>&1; then
          [ "$DRY" = "1" ] || rsync -av --partial "$DEST_REMOTO" "$FNAME" || die "fallo rsync"
        else
          [ "$DRY" = "1" ] || scp "$DEST_REMOTO" "$FNAME" || die "fallo scp"
        fi
        VOLCADO="$FNAME" ;;
    *) die "formato de --descargar no reconocido" ;;
  esac
fi
if [ -z "$VOLCADO" ]; then
  VOLCADO="$(ls -1t "$ACTA_DIR"/hestiat-*.sql.gz 2>/dev/null | head -1)"
fi
[ -n "$VOLCADO" ] && [ -f "$VOLCADO" ] || die "no encuentro el volcado. Usa --volcado o --descargar"
log "volcado: $VOLCADO ($(stat -c%s "$VOLCADO" 2>/dev/null || echo '?') B)"

# ================================================= PASO 2: integridad gzip ==
log "== PASO 2: integridad del archivo (gzip -t) =="
if gzip -t "$VOLCADO" 2>/dev/null; then
  log "gzip -t: INTEGRO"
  GZIP_OK=1
else
  log "gzip -t: ARCHIVO CORRUPTO"
  GZIP_OK=0
fi

# ============================================ PASO 3: contenido y cierre ==
log "== PASO 3: contenido del volcado y cierre limpio =="
N_TABLAS="$(gzip -dc "$VOLCADO" | grep -c '^CREATE TABLE')"
CIERRE="$(gzip -dc "$VOLCADO" | tail -5 | grep -c 'Dump completed')"
CABECERA="$(gzip -dc "$VOLCADO" | head -3 | grep -o 'MariaDB dump[^*]*' | head -1)"
N_INSERT="$(gzip -dc "$VOLCADO" | grep -c '^INSERT INTO')"
log "CREATE TABLE: $N_TABLAS (esperado $ESPERADO_TABLAS) · INSERT INTO: $N_INSERT"
log "cabecera: ${CABECERA:-desconocida} · cierre limpio: $([ "$CIERRE" -ge 1 ] && echo SI || echo NO)"

# ================================================= PASO 4: restauración ==
log "== PASO 4: restaurar en la base destino =="
if [ "$DRY" = "1" ]; then
  log "SIMULACIÓN: crear/limpiar '$DESTINO' y restaurar (no se ejecuta)"
  REST_OK=0
else
  log "preparando la base destino '$DESTINO'"
  Q "DROP DATABASE IF EXISTS \`$DESTINO\`" >/dev/null 2>&1
  mysql --defaults-extra-file="$CNF" -e "CREATE DATABASE \`$DESTINO\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci" 2>>"$LOG_TXT"
  RC_CREATE=$?
  if [ "$RC_CREATE" != "0" ]; then
    log "no puedo crear '$DESTINO'. ¿Existe la base y tiene el usuario permisos? (ver HESTIAT-OPERATIONS.md 1.2)"
    REST_OK=1
  else
    log "restaurando (puede tardar varios minutos)..."
    gzip -dc "$VOLCADO" | mysql --defaults-extra-file="$CNF" "$DESTINO" 2>>"$LOG_TXT"
    REST_OK=$?
    log "restauración terminada (código $REST_OK)"
  fi
fi

# ================================================= PASO 5: verificación ==
log "== PASO 5: verificación de tablas y recuentos =="
TABLAS_DEST="$(Q "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DESTINO'")"
log "tablas restauradas: $TABLAS_DEST (esperado $ESPERADO_TABLAS)"

INFORME=""
COINCIDEN=0
DIFIEREN=0
TABLAS_PROD="$(Q "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_PROD' ORDER BY TABLE_NAME")"
while IFS= read -r t; do
  [ -z "$t" ] && continue
  P="$(Q "SELECT COUNT(*) FROM \`$DB_PROD\`.\`$t\`")"
  D="$(Q "SELECT COUNT(*) FROM \`$DESTINO\`.\`$t\`")"
  if [ "$P" = "$D" ]; then
    COINCIDEN=$((COINCIDEN+1)); MARCA="coincide"
  else
    DIFIEREN=$((DIFIEREN+1)); MARCA="DIFERENTE"
  fi
  INFORME="${INFORME}| \`$t\` | $P | $D | $MARCA |\n"
done <<< "$TABLAS_PROD"

log "recuentos: $COINCIDEN coinciden · $DIFIEREN difieren"

# ================================================= PASO 6: hash y limpieza ==
log "== PASO 6: hash del volcado y limpieza =="
SHA="$(sha256sum "$VOLCADO" | awk '{print $1}')"
log "SHA-256 del volcado: ${SHA:0:16}... (completo en el acta)"
if [ "$TEMPORAL" = "1" ] && [ "$DRY" != "1" ]; then
  Q "DROP DATABASE IF EXISTS \`$DESTINO\`" >/dev/null 2>&1
  log "base temporal '$DESTINO' eliminada"
else
  log "base '$DESTINO' conservada (no es temporal)"
fi

# ================================================= PASO 7: acta ==
log "== PASO 7: acta de copia verificada =="
VEREDICTO="NO VERIFICADA"
if [ "$GZIP_OK" = "1" ] && [ "$N_TABLAS" = "$ESPERADO_TABLAS" ] && [ "$CIERRE" -ge 1 ] \
   && [ "${REST_OK:-1}" = "0" ] && [ "$TABLAS_DEST" = "$ESPERADO_TABLAS" ] && [ "$DIFIEREN" = "0" ] && [ "$COINCIDEN" -gt 0 ]; then
  VEREDICTO="COPIA VERIFICADA"
fi

{
  echo "# Acta de copia verificada — Hestiat"
  echo
  echo "**Veredicto: $VEREDICTO**"
  echo
  echo "- Fecha (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- Volcado: \`$VOLCADO\`"
  echo "- Tamaño: $(stat -c%s "$VOLCADO" 2>/dev/null || echo '?') B"
  echo "- SHA-256: \`$SHA\`"
  echo "- Base de producción (solo lectura, para comparar): \`$DB_PROD\`"
  echo "- Base destino de la restauración: \`$DESTINO\`$([ "$TEMPORAL" = "1" ] && echo ' (temporal, ya eliminada)' || echo ' (conservada)')"
  echo
  echo "## Comprobaciones"
  echo
  echo "| Comprobación | Resultado |"
  echo "|---|---|"
  echo "| Integridad del archivo (\`gzip -t\`) | $([ "$GZIP_OK" = "1" ] && echo 'INTEGRO' || echo 'CORRUPTO') |"
  echo "| Sentencias \`CREATE TABLE\` en el volcado | $N_TABLAS (esperado $ESPERADO_TABLAS) |"
  echo "| Cierre limpio del volcado | $([ "$CIERRE" -ge 1 ] && echo 'sí' || echo 'no') |"
  echo "| Cabecera | ${CABECERA:-desconocida} |"
  echo "| Sentencias \`INSERT INTO\` | $N_INSERT |"
  echo "| Código de la restauración | ${REST_OK:-?} |"
  echo "| Tablas restauradas | $TABLAS_DEST (esperado $ESPERADO_TABLAS) |"
  echo "| Recuentos coincidentes | $COINCIDEN |"
  echo "| Recuentos diferentes | $DIFIEREN |"
  echo
  echo "## Recuento de filas por tabla (producción vs restaurado)"
  echo
  echo "| Tabla | Producción | Restaurado | Resultado |"
  echo "|---|---|---|---|"
  printf "$INFORME"
  echo
  if [ "$VEREDICTO" = "COPIA VERIFICADA" ]; then
    echo "## Consecuencia"
    echo
    echo "La copia queda **verificada por restauración**. Conforme a HESTIAT-OPERATIONS.md,"
    echo "queda **levantada la prohibición de borrar** el código de la aplicación anterior,"
    echo "siempre que se cumplan también el resto de pasos previos (auditoría fresca y copia"
    echo "de la aplicación con hash y prueba de extracción)."
  else
    echo "## Consecuencia"
    echo
    echo "La copia **no** se considera verificada. **No se borra nada.** Revisar el registro"
    echo "\`$LOG_TXT\` y resolver las causas antes de reintentar."
  fi
} > "$ACTA"

log "acta escrita: $ACTA"
log "=== FIN · veredicto: $VEREDICTO ==="

[ "$VEREDICTO" = "COPIA VERIFICADA" ] && exit 0 || exit 2
