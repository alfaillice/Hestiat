#!/bin/bash
# INFORME DE TRÁFICO ORGÁNICO — sin cookies, sin rastreadores, sin terceros.
#
# Lee los registros del servidor y cuenta las visitas REALES a:
#   · las fichas de experiencias   (/experiencias/<slug>)
#   · las páginas de categoría     (/experiencias?categoria=… y /servicios?categoria=…)
#
# Devuelve los últimos 30 días, día a día, para poder ver si los cambios de SEO han movido algo.
#
# Lo que NO hace, y conviene saberlo:
#   · No usa cookies ni identifica a nadie: cuenta PETICIONES, no personas.
#   · No cuenta como orgánico lo que llega sin referente (puede ser tráfico directo o una búsqueda
#     que el navegador no identifica), así que saca dos columnas: con buscador y total. La verdad
#     está entre las dos.
#   · Excluye a los rastreadores (Googlebot y compañía) para no inflar las cifras.
#
# Se puede lanzar a mano cuando se quiera:  bash scripts/informe-organico.sh
set -u
LOG="${1:-}"
if [ -z "$LOG" ]; then
  for c in /var/log/nginx/access.log /var/log/nginx/*access*.log /var/log/hestiat/access.log; do
    [ -f "$c" ] && LOG="$c" && break
  done
fi
[ -z "$LOG" ] || [ ! -f "$LOG" ] && { echo "No encuentro el registro de accesos. Pásalo como argumento."; exit 1; }

echo "INFORME DE TRÁFICO ORGÁNICO — Hestiat"
echo "Registro: $LOG"
echo "Ventana: últimos 30 días"
echo

lectura() {
  # $1 = expresión de la ruta a contar · $2 = etiqueta
  awk -v etiqueta="$2" -v ruta="$1" -v hace30="$(date -d '30 days ago' +%d/%b/%Y)" '
  {
    linea = $0
    # fecha entre corchetes: [13/Oct/2026:05:10:31 +0000]
    if (match(linea, /\[[0-9]{2}\/[A-Za-z]{3}\/[0-9]{4}:/)) {
      f = substr(linea, RSTART+1, 11)
    } else next
    # solo los últimos 30 días (comparación simple de cadena del año/mes/día)
    if (f == hace30) { dentro = 1 } else if (dentro == 1 && f != hace30) { dentro = 2 }
    # petición: "GET /ruta HTTP/1.1"
    p = ""
    if (match(linea, /"(GET|HEAD|POST) [^ ]+/)) { p = substr(linea, RSTART, RLENGTH) }
    if (p !~ ruta) next
    # el agente va entre la última pareja de comillas
    n = split(linea, trozos, "\"")
    ua = (n >= 2) ? trozos[n-1] : ""
    if (ua ~ /[Bb]ot|[Cc]rawler|[Ss]pider|Googlebot|bingbot|Yandex|facebookexternalhit/) next
    # el referente es la penúltima pareja de comillas
    ref = (n >= 4) ? trozos[n-3] : ""
    total[f]++
    if (ref ~ /google\.|bing\.|duckduckgo|ecosia|yahoo\.|search\./) buscador[f]++
  }
  END {
    print etiqueta
    printf "  %-12s %10s %10s\n", "FECHA", "BUSCADOR", "TOTAL"
    for (d in total) printf "  %-12s %10d %10d\n", d, buscador[d]+0, total[d]
  }' "$LOG" 2>/dev/null
}

lectura "/experiencias/[^ ?\"]+" "FICHAS DE EXPERIENCIAS"
echo
lectura "/experiencias\?categoria=|/servicios\?categoria=" "PÁGINAS DE CATEGORÍA"
echo
echo "Consejo: lánzalo también dentro de 30 días y compara los dos informes."
