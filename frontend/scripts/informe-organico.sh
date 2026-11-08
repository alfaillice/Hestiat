#!/bin/bash
# INFORME DE TRÁFICO ORGÁNICO — sin cookies, sin rastreadores de terceros, sin identificar a nadie.
#
# Cuenta las visitas REALES a:
#   · las fichas de experiencias   (/experiencias/<slug>)
#   · las páginas de categoría     (/experiencias?categoria=… y /servicios?categoria=…)
#
# Separa DOS bloques: las que llegan desde un buscador (Google, Bing, DuckDuckGo, Yahoo, Ecosia) y
# el resto. El referente ya viene en el registro del servidor (formato combinado), así que no hay
# que tocar nada del servidor: solo leerlo bien.
#
# DOS ERRORES CORREGIDOS (13-10-2026), los dos medidos sobre los registros reales:
#   1. El referente se leía del campo equivocado, y por eso el bloque de buscadores salía siempre a 0
#      aunque en el registro hubiera 87 visitas de google.com, 18 de duckduckgo y 14 de bing.
#   2. El filtro de rastreadores distinguía mayúsculas, así que «ClaudeBot» (y compañía) contaban
#      como visitas de personas e inflaban las cifras. Ahora se compara todo en minúsculas.
#
# Lo que NO hace: no usa cookies y cuenta PETICIONES, no personas. Una misma persona que recarga
# tres veces son tres. No hay forma de saberlo sin rastrear, y eso es justo lo que se evita.
#
# Se lanza a mano:  bash informe-organico.sh
set -u

FICHEROS=$(ls -1t /var/log/nginx/access.log /var/log/nginx/access.log.* /var/log/hestiat/nginx-access.log /var/log/hestiat/nginx-access.log.* 2>/dev/null | head -32)
[ -z "$FICHEROS" ] && { echo "No encuentro registros de acceso."; exit 1; }

echo "INFORME DE TRÁFICO ORGÁNICO — Hestiat"
echo "Ficheros leídos: $(echo "$FICHEROS" | wc -l) (los más recientes)"
echo "Buscadores contados: Google, Bing, DuckDuckGo, Yahoo, Ecosia"
echo

lectura() {
  zcat -f $FICHEROS 2>/dev/null | awk -v etiqueta="$2" -v ruta="$1" '
  {
    if (match($0, /\[[0-9]{2}\/[A-Za-z]{3}\/[0-9]{4}/)) f = substr($0, RSTART+1, 11); else next
    if (match($0, /"(GET|HEAD|POST) [^ ]+/)) p = substr($0, RSTART, RLENGTH); else next
    if (p !~ ruta) next

    # Las DOS últimas comillas de la línea son el referente y el agente, en ese orden. Se leen así,
    # y no por número de campo, para que no se descuadre si algo cambia de sitio.
    ref = ""; ua = ""
    if (match($0, /"[^"]*" "[^"]*"[[:space:]]*$/)) {
      ultimo = substr($0, RSTART, RLENGTH)
      k = split(ultimo, c, "\"")
      ref = (k >= 3) ? c[2] : ""
      ua  = (k >= 4) ? c[4] : ""
    }

    if (tolower(ua) ~ /bot|crawler|spider|slurp|semrush|ahrefs|facebookexternalhit|python-requests|curl|wget/) next

    total[f]++
    if (tolower(ref) ~ /google\.|bing\.|duckduckgo|yahoo\.|ecosia|search\./) buscador[f]++
  }
  END {
    print etiqueta
    printf "  %-13s %10s %10s %10s\n", "FECHA", "BUSCADORES", "RESTO", "TOTAL"
    sb = 0; st = 0
    for (d in total) { sb += buscador[d]; st += total[d] }
    if (st == 0) { printf "  %-13s %10s %10s %10s\n", "(sin datos)", "-", "-", "0" }
    for (d in total) printf "  %-13s %10d %10d %10d\n", d, buscador[d]+0, total[d]-buscador[d], total[d]
    printf "  %-13s %10d %10d %10d\n", "TOTAL", sb, st-sb, st
  }'
}

lectura "/experiencias/[^ ?\"]+" "FICHAS DE EXPERIENCIAS"
echo
lectura "/experiencias\?categoria=|/servicios\?categoria=" "PÁGINAS DE CATEGORÍA"
echo
echo "Vuelve a lanzarlo dentro de 30 días y compara los totales."
