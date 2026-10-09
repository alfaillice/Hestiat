#!/bin/bash
# =============================================================================
# Hestiat — reduce el número de releases guardadas.
#
# POR DEFECTO NO BORRA NADA: solo dice qué haría, con nombres y tamaños, para que se
# pueda revisar antes. Para borrar de verdad hay que pedirlo a propósito:
#
#     bash /root/hestiat-limpiar-releases-vps.sh              ← solo informa
#     bash /root/hestiat-limpiar-releases-vps.sh --confirmar  ← borra
#
# QUÉ CONSERVA (nunca se toca nada de esto):
#   · la release en uso;
#   · la más reciente de cada día (para poder volver a cualquier jornada);
#   · las 5 más nuevas (para poder deshacer los últimos despliegues);
#   · la más antigua completa (referencia del estado inicial).
#
# No toca ninguna base de datos ni ningún fichero de la aplicación.
# =============================================================================
set -uo pipefail

RELEASES=/opt/hestiat/releases
APP=/opt/hestiat/app
CONFIRMAR=0
[ "${1:-}" = "--confirmar" ] && CONFIRMAR=1

EN_USO=$(basename "$(readlink -f "$APP")")
[ -d "$RELEASES/$EN_USO" ] || { echo "ABORTO: no encuentro la release en uso ($EN_USO)."; exit 1; }

# La aplicación tiene que estar respondiendo antes de plantearse tocar nada.
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3000/ || echo 000)
[ "$CODIGO" = "200" ] || { echo "ABORTO: la aplicación responde $CODIGO, no 200. No se toca nada."; exit 1; }

MAPA=$(mktemp)
for d in $(ls -1 "$RELEASES"); do
  DIA=$(echo "$d" | cut -c1-8)
  if [ -z "$(grep "^$DIA " "$MAPA" 2>/dev/null)" ]; then echo "$DIA $d" >> "$MAPA"; fi
done

CONSERVAR=$( {
  echo "$EN_USO"
  cut -d' ' -f2 "$MAPA"
  ls -1 "$RELEASES" | tail -5
  ls -1 "$RELEASES" | head -1
} | sort -u )
rm -f "$MAPA"

TOTAL=$(ls -1 "$RELEASES" | wc -l)
NCONS=$(echo "$CONSERVAR" | wc -l)
echo "releases ahora: $TOTAL · se conservan: $NCONS · se liberarían: $((TOTAL - NCONS))"
echo
echo "SE CONSERVAN (nunca se borran):"
for r in $CONSERVAR; do
  marca=""
  [ "$r" = "$EN_USO" ] && marca="  ← EN USO"
  printf "   %s  %5s%s\n" "$r" "$(du -sh "$RELEASES/$r" 2>/dev/null | cut -f1)" "$marca"
done
echo
echo "SE BORRARÍAN:"
LIBERAR=0
for d in $(ls -1 "$RELEASES"); do
  if ! echo "$CONSERVAR" | grep -qx "$d"; then
    MB=$(du -sm "$RELEASES/$d" 2>/dev/null | cut -f1); LIBERAR=$((LIBERAR + MB))
    printf "   %s  %s MB\n" "$d" "$MB"
  fi
done
echo "   --- total a liberar: $((LIBERAR / 1024)) GB ---"
echo

if [ "$CONFIRMAR" != "1" ]; then
  echo "MODO INFORME: no se ha borrado nada."
  echo "Para borrarlas de verdad:  bash /root/hestiat-limpiar-releases-vps.sh --confirmar"
  exit 0
fi

echo "BORRANDO (la release en uso y las conservadas quedan intactas)..."
for d in $(ls -1 "$RELEASES"); do
  if ! echo "$CONSERVAR" | grep -qx "$d"; then rm -rf "${RELEASES:?}/$d"; fi
done
echo "   releases ahora: $(ls -1 "$RELEASES" | wc -l) · espacio: $(du -sh "$RELEASES" | cut -f1) · disco libre: $(df -h / | tail -1 | awk '{print $4}')"
echo "   la aplicación sigue respondiendo: $(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3000/)"
