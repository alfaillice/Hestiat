#!/usr/bin/env bash
# =============================================================================
# Hestiat — instala la copia de seguridad diaria de las bases de datos.
#
#   1. Instala el script en /root/hestiat-backup-bd.sh.
#   2. Instala el servicio y el temporizador de systemd (diario, 03:30 UTC).
#   3. Hace UNA copia ahora mismo, para comprobar que funciona de verdad.
#   4. Muestra el registro y el resultado del temporizador.
#
# Uso:  bash scripts/instalar-backup-vps.sh
# =============================================================================
set -euo pipefail
VPS=root@104.243.34.239
KEY="$HOME/.ssh/hestiat_vps"
SSH_OPTS=(-i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)

scp -q "${SSH_OPTS[@]}" scripts/backup-bd-vps.sh scripts/hestiat-backup.service scripts/hestiat-backup.timer "$VPS:/tmp/"

ssh "${SSH_OPTS[@]}" "$VPS" '
set -e
install -m 750 /tmp/backup-bd-vps.sh /root/hestiat-backup-bd.sh
install -m 644 /tmp/hestiat-backup.service /etc/systemd/system/hestiat-backup.service
install -m 644 /tmp/hestiat-backup.timer /etc/systemd/system/hestiat-backup.timer
touch /var/log/hestiat/backup.log
systemctl daemon-reload
systemctl enable --now hestiat-backup.timer >/dev/null 2>&1
echo "   temporizador activado:"
systemctl list-timers hestiat-backup.timer --no-pager | sed -n "2p" | sed "s/^/     /"
echo
echo "   primera copia, ahora (puede tardar un par de minutos):"
/root/hestiat-backup-bd.sh
echo "   resultado: $?  (0 = las dos bases copiadas y verificadas)"
echo
echo "   ficheros generados:"
ls -lh /opt/hestiat/backups/diarias/ | tail -4 | sed "s/^/     /"
echo
echo "   registro:"
tail -8 /var/log/hestiat/backup.log | sed "s/^/     /"
echo
echo "   comprobación de que la copia se puede leer (10 primeras tablas de la base original):"
F=$(ls -1t /opt/hestiat/backups/diarias/*.sql.gz | tail -1)
gzip -dc "$F" | grep "^CREATE TABLE" | head -10 | sed "s/^/     /"
echo
echo "   espacio ocupado por las copias: $(du -sh /opt/hestiat/backups | cut -f1) · disco libre: $(df -h / | tail -1 | awk "{print \$4}")"
'
