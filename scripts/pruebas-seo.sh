#!/bin/bash
# =============================================================================
# PRUEBAS DE SEO — se ejecutan EN EL SERVIDOR y no modifican nada.
#
# Comprueban los invariantes que tienen que cumplirse siempre:
#   1. El sitemap es un índice y sus cinco ficheros responden con URLs.
#   2. Ninguna URL declarada lleva parámetros ni rutas privadas.
#   3. Las URLs declaradas responden 200, con su canonical y sin noindex.
#   4. robots.txt bloquea lo privado, los filtros y las sondas de escaneo.
#   5. Las fichas sin contenido suficiente NO piden indexación (noindex).
#   6. Las páginas se comparten con imagen (og:image).
#   7. Las páginas que no existen devuelven 404 de verdad (sin soft 404).
#
# Uso:  bash /root/pruebas-seo.sh      · Devuelve 0 si todo pasa.
# =============================================================================
set -u
ENVF=/opt/hestiat/shared/.env
U=$(grep "^DB_USER=" "$ENVF" | cut -d= -f2-)
P=$(grep "^DB_PASSWORD=" "$ENVF" | cut -d= -f2-)
Q() { mariadb -u"$U" -p"$P" -N -B hestiat2 -e "$1"; }
WEB=https://hestiat.com
fallos=0
ok()   { echo "   PASS  $*"; }
mal()  { echo "   FALLO $*"; fallos=$((fallos+1)); }

echo "1) SITEMAP: índice y ficheros por tipo"
indice=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 60 "$WEB/sitemap.xml")
[ "$indice" = "200" ] && ok "el índice responde 200" || mal "el índice responde $indice"
for t in paginas ciudades alojamientos experiencias servicios; do
  cab=$(curl -sSI --max-time 90 "$WEB/sitemaps/$t.xml")
  n=$(printf '%s' "$cab" | grep -i '^x-sitemap-urls' | tr -d '\r' | sed 's/.*: //')
  est=$(printf '%s' "$cab" | head -1 | awk '{print $2}')
  if [ -n "$n" ] && [ "$n" -gt 0 ] 2>/dev/null; then ok "$t: $n URLs declaradas"; else mal "$t: respuesta $est, sin recuento"; fi
done

echo "2) SITEMAP: ni parámetros ni rutas privadas"
malas=0
for t in paginas ciudades alojamientos experiencias servicios; do
  cuerpo=$(curl -sS --max-time 90 "$WEB/sitemaps/$t.xml")
  m=$(printf '%s' "$cuerpo" | grep -o '<loc>[^<]*</loc>' | grep -cE '\?|/admin|/api/|/login|/host/')
  malas=$((malas+m))
done
[ "$malas" -eq 0 ] && ok "ninguna URL con parámetros ni rutas privadas" || mal "$malas URLs sospechosas en los sitemaps"

echo "3) URLs declaradas: 200, canonical propio y sin noindex"
revisadas=0
for t in ciudades alojamientos experiencias servicios; do
  for u in $(curl -sS --max-time 90 "$WEB/sitemaps/$t.xml" | grep -o '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g' | head -2); do
    h=$(curl -sS -D - -o /dev/null --max-time 40 "$u")
    c=$(printf '%s' "$h" | head -1 | awk '{print $2}')
    revisadas=$((revisadas+1))
    [ "$c" = "200" ] && ok "$(basename "$u" | cut -c1-34): 200" || mal "$(basename "$u" | cut -c1-34): $c"
    cuerpo=$(curl -sS --max-time 40 "$u")
    can=$(printf '%s' "$cuerpo" | grep -o 'rel="canonical" href="[^"]*"' | head -1 | sed 's/.*href="//;s/"//')
    [ "$can" = "$u" ] && ok "   canonical correcto" || mal "   canonical distinto: $can"
    printf '%s' "$cuerpo" | grep -q 'name="robots" content="[^"]*noindex' && mal "   pide noindex estando declarada" || ok "   indexable"
  done
done

echo "4) robots.txt"
r=$(curl -sS --max-time 30 "$WEB/robots.txt")
for regla in "/admin" "/api/" "/search?" "/xmlrpc.php"; do
  printf '%s' "$r" | grep -q "Disallow: $regla" && ok "bloquea $regla" || mal "no bloquea $regla"
done
printf '%s' "$r" | grep -q "Sitemap: $WEB/sitemap.xml" && ok "declara el sitemap" || mal "no declara el sitemap"

echo "5) Las fichas sin contenido suficiente NO piden indexación"
FLACA=$(Q "SELECT slug FROM accommodation a WHERE a.status='published' AND COALESCE(slug,'')<>'' AND NOT (a.lat IS NOT NULL AND (EXISTS(SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id=a.id) OR COALESCE(a.price_per_night,a.indicative_price)>0) AND (SELECT COUNT(*) FROM accommodation_amenity m WHERE m.accommodation_id=a.id)>=3) LIMIT 1")
if [ -n "$FLACA" ]; then
  h=$(curl -sS --max-time 40 "$WEB/alojamiento/$FLACA")
  printf '%s' "$h" | grep -q 'name="robots" content="[^"]*noindex' && ok "una ficha sin contenido pide noindex" || mal "una ficha sin contenido NO pide noindex"
  printf '%s' "$h" | grep -q 'rel="canonical"' && ok "   y conserva su canonical" || mal "   sin canonical"
else
  mal "no se encontró ninguna ficha flaca para probar"
fi

echo "6) Imagen al compartir (og:image)"
for u in "$WEB/destino/madrid" "$(curl -sS --max-time 60 "$WEB/sitemaps/alojamientos.xml" | grep -o '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g' | head -1)"; do
  curl -sS --max-time 40 "$u" | grep -q 'property="og:image"' && ok "$(basename "$u" | cut -c1-34): tiene og:image" || mal "$(basename "$u" | cut -c1-34): sin og:image"
done

echo "7) Páginas inexistentes: 404 real"
for u in "/alojamiento/no-existe-esta-ficha-xyz" "/experiencias/tampoco-existe-xyz" "/destino/ciudad-que-no-existe-xyz"; do
  c=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$WEB$u")
  [ "$c" = "404" ] && ok "$u → 404" || mal "$u → $c (debería ser 404)"
done

echo
if [ "$fallos" -eq 0 ]; then echo "RESULTADO: todas las comprobaciones pasan"; else echo "RESULTADO: $fallos comprobaciones fallan"; fi
exit $fallos
