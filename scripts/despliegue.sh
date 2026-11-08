#!/usr/bin/env bash
# =============================================================================
# Hestiat 2.0 — despliegue y cutover (automatiza docs/CUTOVER-PLAN.md)
#
# QUÉ HACE
#   1. Comprueba precondiciones (copia verificada, build presente, destino sano).
#   2. Prepara el build nuevo en .output.nuevo SIN tocar el que está en servicio.
#   3. Hace el renombrado ATÓMICO: .output → .output.antes-del-cutover, y el nuevo → .output.
#   4. Vacía el pool de la aplicación para que LiteSpeed levante el nuevo.
#   5. Verifica que producción responde HTTP 200 y que la coherencia es correcta
#      (el HTML debe pedir un asset que exista y responda 200).
#   6. Deja preparados los comandos de vuelta atrás y el registro del despliegue.
#
# FILOSOFÍA
#   Primero existe el sustituto validado; solo después se sustituye. Si algo falla
#   en cualquier punto, NO se toca producción y se informa.
#
# USO (en el servidor, por SSH o Terminal de cPanel)
#   bash scripts/despliegue.sh preparar   <ruta-del-zip-del-build>
#   bash scripts/despliegue.sh corte                      # renombrado atómico + reinicio
#   bash scripts/despliegue.sh verificar
#   bash scripts/despliegue.sh vuelta-atras               # revierte al build anterior
#   bash scripts/despliegue.sh registro
# =============================================================================
set -uo pipefail

DOC="${DOC:-/home/ppxgfdyc/hestiat.com}"
BASE="${BASE:-/home/ppxgfdyc}"
BK="${BK:-$BASE/backups}"
URL="${URL:-https://hestiat.com}"
PATRON_LSNODE='lsnode:/home/ppxgfdyc/hestiat.com/'
EST="$BK/despliegue-estado.txt"
ACCION="${1:-verificar}"

log()  { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$EST"; }
die()  { log "ERROR: $*"; log "No se ha modificado producción."; exit 1; }
hay()  { command -v "$1" >/dev/null 2>&1; }

# --------------------------------------------------------------- verificar --
verificar() {
  local fallos=0
  log "== verificación de producción =="
  local cod; cod="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$URL/" || echo 000)"
  [ "$cod" = "200" ] && log "  / → 200" || { log "  / → $cod  (FALLO)"; fallos=$((fallos+1)); }
  for r in /search /experiencias; do
    cod="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$URL$r" || echo 000)"
    [ "$cod" = "200" ] && log "  $r → 200" || { log "  $r → $cod  (aviso)"; }
  done
  cod="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$URL/no-existe-xyz" || echo 000)"
  [ "$cod" = "404" ] && log "  404 correcto" || log "  /no-existe-xyz → $cod (se esperaba 404)"

  # coherencia: el HTML debe pedir un asset que exista y responda 200
  local html script codigo
  html="$(curl -s --compressed -H 'Accept-Encoding: gzip, deflate' --max-time 40 "$URL/search" | tr -d '\000')"
  script="$(printf '%s' "$html" | grep -ao '/assets/index-[A-Za-z0-9_.-]*\.js' | head -1)"
  if [ -z "$script" ]; then
    log "  no he podido leer el asset que pide el HTML"; fallos=$((fallos+1))
  else
    codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$URL$script")"
    [ "$codigo" = "200" ] && log "  coherencia: $script → 200" || { log "  coherencia ROTA: $script → $codigo"; fallos=$((fallos+1)); }
  fi
  [ "$fallos" -eq 0 ] && { log "  VEREDICTO: producción correcta"; return 0; }
  log "  VEREDICTO: $fallos comprobación(es) fallida(s)"; return 2
}

# ---------------------------------------------------------------- preparar --
preparar() {
  local zip="${2:-}"
  [ -n "$zip" ] || die "falta la ruta del zip del build"
  [ -f "$zip" ] || die "no existe el zip: $zip"
  hay unzip || die "falta unzip"
  log "== preparando el build nuevo en .output.nuevo =="
  rm -rf "$DOC/.output.nuevo"
  mkdir -p "$DOC/.output.nuevo"
  unzip -q "$zip" -d "$DOC/.output.nuevo" || die "no se pudo descomprimir"
  # admitir zip con la carpeta .output dentro o los ficheros en la raíz
  if [ -d "$DOC/.output.nuevo/.output" ]; then mv "$DOC/.output.nuevo/.output" "$DOC/.output.nuevo.tmp" && rm -rf "$DOC/.output.nuevo" && mv "$DOC/.output.nuevo.tmp" "$DOC/.output.nuevo"; fi
  [ -f "$DOC/.output.nuevo/server/index.mjs" ] || die "el build no contiene server/index.mjs"
  local n; n="$(find "$DOC/.output.nuevo" -type f | wc -l)"
  log "  ficheros extraídos: $n"
  local idx; idx="$(grep -ao '/assets/index-[A-Za-z0-9_.-]*\.js' "$DOC/.output.nuevo/server/"*manifest*.mjs 2>/dev/null | head -1)"
  [ -n "$idx" ] || die "el manifiesto no referencia ningún índice de cliente"
  [ -f "$DOC/.output.nuevo/public$idx" ] || die "el HTML pediría $idx, que no existe en el build (NO se toca producción)"
  log "  coherencia del candidato: $idx existe en el build"
  log "  LISTO para el corte. Ejecuta: bash scripts/despliegue.sh corte"
}

# ------------------------------------------------------------------- corte --
corte() {
  [ -f "$DOC/.output.nuevo/server/index.mjs" ] || die "no hay build preparado en .output.nuevo"
  log "== CORTE atómico =="
  rm -rf "$DOC/.output.antes-del-cutover"
  mv "$DOC/.output" "$DOC/.output.antes-del-cutover" || die "no se pudo apartar el build actual"
  mv "$DOC/.output.nuevo" "$DOC/.output" || { mv "$DOC/.output.antes-del-cutover" "$DOC/.output"; die "falló el renombrado: revertido"; }
  log "  .output → .output.antes-del-cutover · .output.nuevo → .output"
  touch "$DOC/tmp/restart.txt" 2>/dev/null
  hay pkill && pkill -9 -f "$PATRON_LSNODE" 2>/dev/null
  log "  pool vaciado; LiteSpeed relanza en la siguiente petición"
  sleep 8
  curl -s -o /dev/null --max-time 40 "$URL/?t=$(date +%s)" || true
  sleep 4
  if verificar; then
    log "  DESPLIEGUE CORRECTO"
    log "  Vuelta atrás si hiciera falta: bash scripts/despliegue.sh vuelta-atras"
  else
    log "  FALLO tras el corte. Revierte con: bash scripts/despliegue.sh vuelta-atras"
    exit 2
  fi
}

# ----------------------------------------------------------- vuelta atrás --
vuelta_atras() {
  [ -d "$DOC/.output.antes-del-cutover" ] || die "no hay build anterior que restaurar"
  log "== vuelta atrás =="
  mv "$DOC/.output" "$DOC/.output.fallido" 2>/dev/null
  mv "$DOC/.output.antes-del-cutover" "$DOC/.output" || die "no se pudo restaurar"
  hay pkill && pkill -9 -f "$PATRON_LSNODE" 2>/dev/null
  log "  restaurado el build anterior; pool vaciado"
  sleep 10
  curl -s -o /dev/null --max-time 40 "$URL/" || true
  verificar && log "  VUELTA ATRÁS CORRECTA"
}

# --------------------------------------------------------------- registro --
registro() {
  log "== registro del despliegue =="
  {
    echo "# Registro de despliegue — Hestiat 2.0"
    echo
    echo "Fecha (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo
    echo "- Build en servicio: \`$(sha256sum "$DOC/.output/server/index.mjs" 2>/dev/null | cut -d' ' -f1)\`"
    echo "- Build anterior conservado: \`$(sha256sum "$DOC/.output.antes-del-cutover/server/index.mjs" 2>/dev/null | cut -d' ' -f1)\`"
    echo "- Vuelta atrás: \`mv .output .output.fallido && mv .output.antes-del-cutover .output\`"
    echo "- Base de datos: esquema nuevo en \`ppxgfdyc_hestiat2\`; la original \`ppxgfdyc_hestiat\` permanece intacta"
    echo
    echo "## Recuerda"
    echo
    echo "- **No activar Cloudflare Proxy** hasta que el cliente lo autorice."
    echo "- El borrado del código anterior (plan, fase E) se hace **después** de 24 h de observación."
  } > "$BK/REGISTRO-DESPLIEGUE.md"
  log "  escrito: $BK/REGISTRO-DESPLIEGUE.md"
}

case "$ACCION" in
  preparar) preparar "$@" ;;
  corte) corte ;;
  vuelta-atras) vuelta_atras ;;
  registro) registro ;;
  verificar|*) verificar ;;
esac
