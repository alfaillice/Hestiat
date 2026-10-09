#!/usr/bin/env bash
# =============================================================================
# Hestiat — aplica la política de caché pública en nginx.
#
#   1. Guarda copia de seguridad de la configuración actual con fecha.
#   2. Instala la configuración nueva.
#   3. Comprueba la sintaxis. Si falla, RESTAURA la anterior y no recarga nada.
#   4. Si la sintaxis es correcta, recarga nginx (sin cortar el servicio).
#
# Uso:  bash scripts/aplicar-cache-vps.sh
# =============================================================================
set -euo pipefail
VPS=root@104.243.34.239
KEY="$HOME/.ssh/hestiat_vps"
SSH_OPTS=(-i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)

scp -q "${SSH_OPTS[@]}" scripts/nginx-hestiat.conf scripts/hestiat-cache.conf "$VPS:/tmp/"

ssh "${SSH_OPTS[@]}" "$VPS" '
set -e
FECHA=$(date -u +%Y%m%d-%H%M%S)
cp /etc/nginx/sites-available/hestiat "/root/hestiat-nginx-$FECHA.bak"
cp /etc/nginx/conf.d/hestiat-cache.conf "/root/hestiat-cache-conf-$FECHA.bak" 2>/dev/null || true
echo "   copia de seguridad: /root/hestiat-nginx-$FECHA.bak"
install -m 644 /tmp/nginx-hestiat.conf /etc/nginx/sites-available/hestiat
install -m 644 /tmp/hestiat-cache.conf /etc/nginx/conf.d/hestiat-cache.conf
if nginx -t 2>/tmp/nginx-test.txt; then
  systemctl reload nginx
  echo "   sintaxis correcta · nginx recargado sin cortar el servicio"
else
  echo "   SINTAXIS INCORRECTA · restaurando:"
  cat /tmp/nginx-test.txt
  cp "/root/hestiat-nginx-$FECHA.bak" /etc/nginx/sites-available/hestiat
  cp "/root/hestiat-cache-conf-$FECHA.bak" /etc/nginx/conf.d/hestiat-cache.conf 2>/dev/null || true
  nginx -t && systemctl reload nginx
  echo "   anterior restaurada"
  exit 1
fi
# Script de purga: se ejecuta en cada despliegue para no servir HTML viejo.
cat > /root/hestiat-purgar-cache.sh <<"FIN"
#!/bin/bash
# Vacía la caché pública de nginx. Se ejecuta en cada despliegue.
find /var/cache/nginx/hestiat -type f -delete 2>/dev/null || true
echo "caché pública vaciada"
FIN
chmod +x /root/hestiat-purgar-cache.sh
echo "   purga lista: /root/hestiat-purgar-cache.sh"
'

echo "== comprobación: la caché funciona y respeta la sesión =="
for i in 1 2; do
  printf "   portada, petición %s → %s\n" "$i" "$(curl -sSI --max-time 30 https://hestiat.com/ | grep -i '^x-cache' | tr -d '\r')"
done
printf "   con sesión (debe ser BYPASS) → %s\n" "$(curl -sSI --max-time 30 -H 'Cookie: hestiat_sesion=0000000000000000000000000000000000000000000000000000000000000000' https://hestiat.com/ | grep -i '^x-cache' | tr -d '\r')"
printf "   con filtros (debe ser BYPASS) → %s\n" "$(curl -sSI --max-time 30 'https://hestiat.com/experiencias?categoria=museos' | grep -i '^x-cache' | tr -d '\r')"
printf "   panel privado (sin caché) → %s\n" "$(curl -sSI --max-time 30 https://hestiat.com/host | grep -iE '^(x-cache|cache-control)' | tr -d '\r' | tr '\n' ' ')"
