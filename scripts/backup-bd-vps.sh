#!/bin/bash
# =============================================================================
# Hestiat — copia de seguridad de las dos bases de datos.
#
#   · Diaria, de las dos bases (la original y la nueva).
#   · Coherente: `--single-transaction`, sin bloquear la web mientras copia.
#   · VERIFICADA: después de copiar se comprueba que el fichero se descomprime
#     y que contiene tablas. Una copia que no se puede leer no es una copia.
#   · Retención: 7 días de copias diarias + 4 copias semanales.
#   · Las credenciales se leen del entorno del servicio, nunca de este fichero.
#     Se usa MYSQL_PWD para que la contraseña no aparezca en la lista de procesos.
#   · Devuelve 0 si todo fue bien y 1 si alguna base falló: así el temporizador
#     deja el resultado en el registro de systemd y se puede vigilar.
#
# Instalado en /root/hestiat-backup-bd.sh — ver scripts/instalar-backup-vps.sh
# =============================================================================
set -uo pipefail

BASE=/opt/hestiat/backups
DIARIAS="$BASE/diarias"
SEMANALES="$BASE/semanales"
DIAS=7
SEMANAS=4
LOG=/var/log/hestiat/backup.log

mkdir -p "$DIARIAS" "$SEMANALES"
FECHA=$(date -u +%Y%m%d-%H%M)

# --- credenciales, del entorno del servicio (nunca escritas aquí) ---
set -a
# shellcheck disable=SC1091
. /opt/hestiat/shared/.env
set +a
export MYSQL_PWD="${DB_PASSWORD:?falta DB_PASSWORD en el entorno}"
USUARIO="${DB_USER:?falta DB_USER en el entorno}"
SERVIDOR="${DB_HOST:-127.0.0.1}"
ORIGINAL="${DB_NAME_LEGACY:-hestiat}"
NUEVA="${DB_NAME_NEW:-hestiat2}"

anota() { echo "$(date -u '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

anota "--- copia iniciada ($FECHA) ---"
fallos=0

for BD in "$ORIGINAL" "$NUEVA"; do
  FICHERO="$DIARIAS/$BD-$FECHA.sql.gz"
  if mysqldump --user="$USUARIO" --host="$SERVIDOR" \
       --single-transaction --quick --routines --events --triggers --no-tablespaces \
       "$BD" 2>>"$LOG" | gzip -9 > "$FICHERO"; then
    TABLAS=$(gzip -dc "$FICHERO" 2>/dev/null | grep -c '^CREATE TABLE')
    if [ "$TABLAS" -ge 10 ] && gzip -t "$FICHERO" 2>/dev/null; then
      anota "OK $BD · $TABLAS tablas · $(du -h "$FICHERO" | cut -f1)"
    else
      anota "FALLO $BD · la copia no parece completa ($TABLAS tablas)"
      fallos=1
      rm -f "$FICHERO"
    fi
  else
    anota "FALLO $BD · mysqldump devolvió error"
    fallos=1
    rm -f "$FICHERO"
  fi
done

# --- copia semanal (los domingos se conserva la del día) ---
if [ "$(date -u +%u)" = "7" ]; then
  for f in "$DIARIAS"/*-"$FECHA".sql.gz; do
    [ -e "$f" ] && cp -p "$f" "$SEMANALES/"
  done
  anota "copia semanal conservada"
fi

# --- retención: se conservan las más recientes ---
ls -1t "$DIARIAS"/*.sql.gz 2>/dev/null | tail -n +$((DIAS * 2 + 1)) | xargs -r rm -f
ls -1t "$SEMANALES"/*.sql.gz 2>/dev/null | tail -n +$((SEMANAS * 2 + 1)) | xargs -r rm -f
anota "retención: $(ls -1 "$DIARIAS" 2>/dev/null | wc -l) diarias · $(ls -1 "$SEMANALES" 2>/dev/null | wc -l) semanales · $(du -sh "$BASE" | cut -f1)"
anota "--- copia terminada (fallos=$fallos) ---"

exit $fallos
