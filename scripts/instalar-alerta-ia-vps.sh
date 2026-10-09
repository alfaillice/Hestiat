#!/usr/bin/env bash
# =============================================================================
# Hestiat — instala la alerta automática del agente de IA.
#
#   1. Copia el script y las unidades de systemd.
#   2. Activa el temporizador (cada 15 minutos, junto al de vigilancia del VPS).
#   3. Lo ejecuta UNA vez para comprobar que funciona de verdad: con el estado actual debe enviar
#      un correo al administrador.
#   4. Lo ejecuta una segunda vez para comprobar que NO repite el aviso si el estado no cambia.
#
# Uso:  bash scripts/instalar-alerta-ia-vps.sh
# =============================================================================
set -euo pipefail
VPS=root@104.243.34.239
KEY="$HOME/.ssh/hestiat_vps"
SSH_OPTS=(-i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)

scp -q "${SSH_OPTS[@]}" scripts/alerta-ia-vps.sh scripts/hestiat-alerta-ia.service scripts/hestiat-alerta-ia.timer "$VPS:/tmp/"

ssh "${SSH_OPTS[@]}" "$VPS" '
set -e
install -m 750 /tmp/alerta-ia-vps.sh /root/hestiat-alerta-ia.sh
install -m 644 /tmp/hestiat-alerta-ia.service /etc/systemd/system/hestiat-alerta-ia.service
install -m 644 /tmp/hestiat-alerta-ia.timer /etc/systemd/system/hestiat-alerta-ia.timer
touch /var/log/hestiat/alerta-ia.log
systemctl daemon-reload
systemctl enable --now hestiat-alerta-ia.timer >/dev/null 2>&1
echo "   temporizador:"
systemctl list-timers hestiat-alerta-ia.timer --no-pager | sed -n "2p" | sed "s/^/     /"
echo
echo "   PRIMERA ejecución (debe mandar UN aviso al administrador):"
/root/hestiat-alerta-ia.sh || true
tail -3 /var/log/hestiat/alerta-ia.log | sed "s/^/     /"
echo
echo "   SEGUNDA ejecución seguida (no debe repetir el aviso):"
ANTES=$(wc -l < /var/log/hestiat/alerta-ia.log)
/root/hestiat-alerta-ia.sh || true
DESPUES=$(wc -l < /var/log/hestiat/alerta-ia.log)
echo "     líneas nuevas en el registro: $((DESPUES - ANTES)) (1 = hizo la comprobación sin enviar otro correo)"
echo
echo "   estado guardado: $(cat /var/lib/hestiat/alerta-ia.estado 2>/dev/null)"
echo "   registro completo:"
tail -6 /var/log/hestiat/alerta-ia.log | sed "s/^/     /"
'
