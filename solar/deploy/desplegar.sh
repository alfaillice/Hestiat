#!/usr/bin/env bash
# Despliegue de la web solar de hestiat.com (sitio estático Astro).
#
# Ejecutar en el VPS como root, por fases, en este orden:
#   bash desplegar.sh estado      # solo lectura: qué sirve hoy hestiat.com y qué escucha
#   bash desplegar.sh preparar    # clona/actualiza la rama solar-web, compila y crea la release
#   bash desplegar.sh probar      # sirve la release nueva en 127.0.0.1:3999 (revisar por túnel SSH)
#   bash desplegar.sh activar     # hestiat.com pasa a la release nueva (guarda config anterior)
#   bash desplegar.sh verificar   # comprobaciones HTTP sobre hestiat.com
#   bash desplegar.sh revertir    # vuelve a la configuración nginx anterior si algo falla
#   bash desplegar.sh retirar     # BORRA el marketplace antiguo (pide confirmación escrita)
#
# No toca: base de datos, shop.hestiat.com, newtimes.news, correo, DNS.
set -euo pipefail

REPO_URL="https://github.com/alfaillice/Hestiat.git"   # si el repo es privado, usar clave de despliegue (ver README)
RAMA="solar-web"
SRC="/root/hestiat-src"
BASE="/var/www/hestiat-solar"
RELEASES="$BASE/releases"
RELEASE="$RELEASES/$(date +%Y%m%d-%H%M%S)"
CURRENT="$BASE/current"
PREVIEW="$BASE/preview"
RESPALDO="/root/respaldo-nginx-hestiat"   # solo configuración nginx, nunca web ni base de datos
SITE_NUEVO="/etc/nginx/sites-available/hestiat-solar"
SITE_PRUEBA="/etc/nginx/sites-available/hestiat-solar-prueba"
DEPLOY_DIR="$SRC/solar/deploy"

log() { printf '\n==> %s\n' "$*"; }
pide_si() {
  read -r -p "$1 Escribe SI para continuar: " r
  [ "$r" = "SI" ] || { echo "Cancelado."; exit 1; }
}

fase_estado() {
  log "Sitios nginx que mencionan hestiat.com:"
  grep -l "server_name.*hestiat.com" /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf 2>/dev/null || echo "(ninguno)"
  log "Puertos en escucha relevantes:"
  ss -ltnp | grep -E ':(80|443|3000|3002|3999)\b' || echo "(ninguno de 3000/3002/3999)"
  log "Servicios hestiat:"
  systemctl list-units --type=service --all | grep -i hestiat || echo "(ninguno)"
  log "Carpeta de la web antigua:"
  ls -d /home/ubuntu/hestiat-nueva 2>/dev/null || echo "(no encontrada)"
  log "Comprobación de puerto 3999 (debe estar libre):"
  ss -ltn | grep ':3999' && echo "AVISO: 3999 ocupado" || echo "3999 libre"
}

fase_preparar() {
  mkdir -p "$RELEASES" "$RESPALDO"
  if [ -d "$SRC/.git" ]; then
    git -C "$SRC" fetch -q origin "$RAMA"
    git -C "$SRC" checkout -q "$RAMA"
    git -C "$SRC" reset -q --hard "origin/$RAMA"
  else
    git clone -q --branch "$RAMA" "$REPO_URL" "$SRC"
  fi
  cd "$SRC/solar"
  npm ci --no-audit --no-fund
  npm run build
  mkdir -p "$RELEASE"
  cp -r dist/. "$RELEASE/"
  log "Release creada: $RELEASE"
  ls "$RELEASE" | head -30
}

ultima_release() { ls -1d "$RELEASES"/* | tail -1; }

fase_probar() {
  local nueva; nueva="$(ultima_release)"
  [ -f "$nueva/index.html" ] || { echo "No hay release válida en $nueva"; exit 1; }
  if ss -ltn | grep -q ':3999 '; then echo "Puerto 3999 ocupado. Detén lo que lo usa y reintenta."; exit 1; fi
  ln -sfn "$nueva" "$PREVIEW"
  cp "$DEPLOY_DIR/hestiat-solar-prueba.conf" "$SITE_PRUEBA"
  ln -sfn "$SITE_PRUEBA" /etc/nginx/sites-enabled/hestiat-solar-prueba
  nginx -t
  systemctl reload nginx
  log "Vista previa lista. Desde tu equipo: ssh -L 3999:127.0.0.1:3999 <usuario>@<servidor>  y abre http://localhost:3999"
  curl -fsS -o /dev/null -w "Prueba local 3999: HTTP %{http_code}\n" http://127.0.0.1:3999/
}

fase_activar() {
  local nueva; nueva="$(ultima_release)"
  [ -f "$nueva/index.html" ] || { echo "No hay release válida en $nueva"; exit 1; }
  pide_si "Esto cambia hestiat.com a la web solar nueva."

  local ts; ts="$(date +%Y%m%d-%H%M%S)"
  local dir="$RESPALDO/$ts"
  mkdir -p "$dir"
  # Guarda la lista de sitios que hoy sirven hestiat.com, para poder volver atrás.
  grep -l "server_name.*hestiat.com" /etc/nginx/sites-enabled/* 2>/dev/null > "$dir/sitios-anteriores.txt" || true
  cat "$dir/sitios-anteriores.txt"
  # Copia de configuración (no de web ni de base de datos).
  while read -r f; do cp -L "$f" "$dir/"; done < "$dir/sitios-anteriores.txt"
  echo "$ts" > "$RESPALDO/ultimo"

  # Retira los sitios antiguos de hestiat.com (sin borrar sus ficheros).
  while read -r f; do rm -f "/etc/nginx/sites-enabled/$(basename "$f")"; done < "$dir/sitios-anteriores.txt"

  cp "$DEPLOY_DIR/hestiat-solar.conf" "$SITE_NUEVO"
  ln -sfn "$SITE_NUEVO" /etc/nginx/sites-enabled/hestiat-solar
  ln -sfn "$nueva" "$CURRENT"

  if ! nginx -t; then
    echo "nginx -t falló. Revirtiendo."
    fase_revertir
    exit 1
  fi
  systemctl reload nginx
  log "hestiat.com apunta a la web solar nueva. Verifica con: bash desplegar.sh verificar"
}

fase_verificar() {
  local ok=1
  for u in https://hestiat.com/ https://hestiat.com/calculadora/camper/ https://hestiat.com/instalacion/48v/ https://hestiat.com/permisos/; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$u" || true)
    echo "$u -> $code"
    [ "$code" = "200" ] || ok=0
  done
  local body; body="$(curl -fsS https://hestiat.com/ || true)"
  if printf '%s' "$body" | grep -q "hestiat"; then echo "Contenido: OK"; else echo "Contenido: NO encontrado"; ok=0; fi
  [ "$ok" = "1" ] && log "Verificación correcta." || log "Hay fallos. Si procede: bash desplegar.sh revertir"
}

fase_revertir() {
  [ -f "$RESPALDO/ultimo" ] || { echo "No hay respaldo de nginx que restaurar."; exit 1; }
  local ts; ts="$(cat "$RESPALDO/ultimo")"
  local dir="$RESPALDO/$ts"
  rm -f /etc/nginx/sites-enabled/hestiat-solar
  while read -r f; do
    ln -sfn "/etc/nginx/sites-available/$(basename "$f")" "/etc/nginx/sites-enabled/$(basename "$f")"
  done < "$dir/sitios-anteriores.txt"
  nginx -t && systemctl reload nginx
  log "Configuración nginx anterior restaurada desde $dir (los ficheros de web no se tocan)."
}

fase_retirar() {
  log "Se van a eliminar:"
  echo "  - servicio hestiat-nueva (si existe)"
  echo "  - carpeta /home/ubuntu/hestiat-nueva"
  echo "NO se toca la base de datos. Eso requiere una orden aparte y explícita."
  pide_si "Irreversible: no hay respaldo de la web antigua."
  systemctl stop hestiat-nueva 2>/dev/null || true
  systemctl disable hestiat-nueva 2>/dev/null || true
  rm -f /etc/systemd/system/hestiat-nueva.service
  systemctl daemon-reload
  rm -rf /home/ubuntu/hestiat-nueva
  log "Web antigua retirada. Base de datos intacta."
}

case "${1:-}" in
  estado)     fase_estado ;;
  preparar)   fase_preparar ;;
  probar)     fase_probar ;;
  activar)    fase_activar ;;
  verificar)  fase_verificar ;;
  revertir)   fase_revertir ;;
  retirar)    fase_retirar ;;
  *) echo "Uso: bash desplegar.sh {estado|preparar|probar|activar|verificar|revertir|retirar}"; exit 1 ;;
esac
