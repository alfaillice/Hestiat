#!/bin/bash
# =============================================================================
# PONE LA CLAVE DEL MODELO EN EL ENTORNO DEL SERVICIO.
#
# Lo hace todo sin que la clave aparezca jamás en pantalla, en el historial ni en un registro:
#   1. pide la clave (no se muestra lo que escribes);
#   2. guarda una copia del fichero de entorno antes de tocarlo;
#   3. escribe la línea IA_API_KEY, reemplazando cualquier intento anterior;
#   4. deja el propietario y los permisos correctos (root:hestiat, 640);
#   5. reinicia el servicio y comprueba los tres indicadores.
#
# Uso, como root:   bash /root/poner-clave-ia.sh
# =============================================================================
umask 077
ENVF=/opt/hestiat/shared/.env

[ "$(id -u)" = "0" ] || { echo "Hay que ejecutarlo como root (sudo -i y luego bash /root/poner-clave-ia.sh)."; exit 1; }
[ -f "$ENVF" ] || { echo "No encuentro $ENVF en este servidor ($(curl -sS --max-time 10 https://ifconfig.me 2>/dev/null))."; exit 1; }

read -rsp "Pega la clave del modelo y pulsa Enter (no se verá): " K
echo
[ -n "$K" ] || { echo "No has escrito nada: no se cambia nada."; exit 1; }

cp -p "$ENVF" "/root/env-antes-de-la-clave-$(date -u +%Y%m%d-%H%M%S).bak"
grep -v '^IA_API_KEY=' "$ENVF" > "$ENVF.tmp" 2>/dev/null || true
cat "$ENVF.tmp" > "$ENVF"
printf 'IA_API_KEY=%s\n' "$K" >> "$ENVF"
rm -f "$ENVF.tmp"
unset K

chown root:hestiat "$ENVF"
chmod 640 "$ENVF"

systemctl restart hestiat
for i in 1 2 3 4 5 6 7 8; do sleep 3; [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/)" = "200" ] && break; done

echo
bash /root/comprobar-clave.sh
echo
echo "Cuando los puntos 1 y 3 digan 1, la prueba completa es:  bash /root/pruebas-ia-conectada.sh --real"
