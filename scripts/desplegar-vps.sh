#!/usr/bin/env bash
# =============================================================================
# Hestiat — despliegue a la VPS (104.243.34.239)
#
# 1. Construye el frontend en local (Next.js standalone).
# 2. Ensambla una release COMPLETA (servidor + estáticos + público): nunca por
#    diferencias de tamaño, siempre el árbol entero.
# 3. La sube a /opt/hestiat/releases/<marca-de-tiempo>.
# 4. Cambia el enlace /opt/hestiat/app y reinicia el servicio. Si la web no
#    responde 200 en 18 s, VUELVE SOLA a la release anterior.
# 5. Comprueba desde fuera que producción responde.
#
# No borra releases anteriores. Uso:  bash scripts/desplegar-vps.sh
# =============================================================================
set -euo pipefail

APP=/home/hestiat2/frontend
VPS=root@104.243.34.239
KEY="$HOME/.ssh/hestiat_vps"
SSH_OPTS=(-i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)
TS="$(date -u +%Y%m%d-%H%M%S)"
STAGE="/tmp/hestiat-release-$TS"

cd "$APP"

echo "== 1/5 construyendo ($TS) =="
npm run build 2>&1 | tail -20

echo "== 2/5 ensamblando la release completa =="
rm -rf "$STAGE"
mkdir -p "$STAGE/.next"
cp -r .next/standalone/. "$STAGE/"
rm -rf "$STAGE/.next/static" "$STAGE/public"
cp -r .next/static "$STAGE/.next/static"
cp -r public "$STAGE/public"
[ -f "$STAGE/server.js" ] || { echo "FALLO: la release no tiene server.js"; exit 1; }
[ -f "$STAGE/.next/static" ] || true
echo "   ficheros en la release: $(find "$STAGE" -type f | wc -l)"

echo "== 3/5 subiendo =="
tar czf "$STAGE.tgz" -C "$STAGE" .
scp "${SSH_OPTS[@]}" "$STAGE.tgz" "$VPS:/tmp/"

echo "== 4/5 publicando (cambio de enlace + reinicio, con vuelta atrás) =="
ssh "${SSH_OPTS[@]}" "$VPS" "
set -e
D=/opt/hestiat/releases/$TS
mkdir -p \$D
tar xzf /tmp/$(basename "$STAGE").tgz -C \$D
chown -R hestiat:hestiat \$D
ANTERIOR=\$(readlink -f /opt/hestiat/app)
ln -sfn \$D /opt/hestiat/app
systemctl restart hestiat
C=000
for i in 1 2 3 4 5 6; do
  sleep 3
  C=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3000/ || echo 000)
  [ \"\$C\" = 200 ] && break
done
echo \"   aplicación en 127.0.0.1:3000 → \$C\"
if [ \"\$C\" != 200 ]; then
  echo '   FALLO: vuelvo a la release anterior'
  ln -sfn \$ANTERIOR /opt/hestiat/app
  systemctl restart hestiat
  sleep 8
  curl -s -o /dev/null -w '   restaurada: %{http_code}\n' --max-time 20 http://127.0.0.1:3000/ || true
  exit 1
fi
echo \"   en servicio: \$(readlink -f /opt/hestiat/app)\"
# La caché pública guarda HTML de la versión anterior: se vacía para no servir nada viejo.
bash /root/hestiat-purgar-cache.sh 2>/dev/null || true
rm -f /tmp/$(basename "$STAGE").tgz
"

echo "== 5/5 comprobación desde fuera =="
for r in / /experiencias /servicios; do
  curl -s -o /dev/null -w "   $r → %{http_code}\n" --max-time 30 "https://hestiat.com$r"
done
echo "   VERSIÓN DESPLEGADA: $TS"
rm -rf "$STAGE" "$STAGE.tgz"
