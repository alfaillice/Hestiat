# Plan de ejecución del cutover — Hestiat 2.0

Los cuatro pasos del puente de arranque, la verificación obligatoria y la vuelta atrás.
Complementa `docs/VENTANA-MANTENIMIENTO.md` (runbook completo) y `scripts/despliegue.sh`.

**Estado**: el puente está **probado en local** (arranca Next.js 15.5.27 y responde en las
cuatro rutas). No se ha ejecutado en producción.

---

## Paso 0 · Antes de empezar (5 minutos)

```
# 1. Estado de partida: debe dar 200
bash scripts/despliegue.sh verificar

# 2. Copia de datos final y verificada
bash scripts/restaurar-verificado.sh --destino ppxgfdyc_hestiat2 \
     --volcado /home/ppxgfdyc/backups/hestiat-<sello>.sql.gz --temporal=false

# 3. Red de seguridad del código: conservar el build actual
cp -a /home/ppxgfdyc/hestiat.com/.output /home/ppxgfdyc/backups/output-$(date +%Y%m%d-%H%M%S)
```

---

## Paso 1 · Construir el frontend

```
cd /home/ppxgfdyc/hestiat2/frontend
npm ci
npm run build
```

**Debe generar** `.next/standalone/`. Si no aparece, `next.config.mjs` no tiene
`output: "standalone"` y hay que corregirlo antes de seguir.

---

## Paso 2 · Montar el árbol standalone

```
cd /home/ppxgfdyc/hestiat2/frontend
rm -rf /home/ppxgfdyc/hestiat.com/.next-standalone
mkdir -p /home/ppxgfdyc/hestiat.com/.next-standalone
cp -r .next/standalone/. /home/ppxgfdyc/hestiat.com/.next-standalone/
mkdir -p /home/ppxgfdyc/hestiat.com/.next-standalone/.next
cp -r .next/static /home/ppxgfdyc/hestiat.com/.next-standalone/.next/static
[ -d public ] && cp -r public /home/ppxgfdyc/hestiat.com/.next-standalone/public
```

Sin este árbol el puente no arranca: el `server.js` de Next y sus dependencias mínimas viven
ahí. Son ~2.000 ficheros, no los 345 MB de `node_modules`.

**Comprobar antes de tocar nada**:
```
test -f /home/ppxgfdyc/hestiat.com/.next-standalone/server.js && echo "árbol listo" || echo "FALTA: no seguir"
```

---

## Paso 3 · Instalar el puente como punto de entrada

```
out=/home/ppxgfdyc/hestiat.com
cp "$out/.output/server/index.mjs" "$out/backups-index-mjs-"$(date +%Y%m%d-%H%M%S)
cp /home/ppxgfdyc/hestiat2/desplegar/puente-arranque.mjs "$out/.output/server/index.mjs"
```

Copia primero el anterior: es la vuelta atrás más barata, en un solo fichero.

`app.cjs` **no se toca**: sigue haciendo `require("./.output/server/index.mjs")`, solo que
ahora ese fichero levanta Next en lugar de Nitro. Y funciona sin reconfigurar el hosting
porque, como documenta el propio `app.cjs`, **LiteSpeed intercepta el `listen()` del proceso**.

---

## Paso 4 · Reiniciar el pool

```
pkill -f 'lsnode:/home/ppxgfdyc/hestiat.com/'
sleep 10
curl -s -o /dev/null -w 'arranque: %{http_code}\n' https://hestiat.com/
```

LiteSpeed relanza la aplicación en la siguiente petición. No se levanta a mano.

---

## Verificación obligatoria

```
for r in / /search /experiencias /alojamiento/gemas-beach; do
  printf '%-28s %s\n' "$r" "$(curl -s -o /dev/null -w '%{http_code}' https://hestiat.com$r)"
done
```

| Comprobación | Resultado esperado |
|---|---|
| `/experiencias` | **200** — es la señal de que el servidor de Next está vivo y renderizando |
| `/` · `/search` · `/alojamiento/<slug>` | **200** con base de datos accesible |
| Ruta inexistente | **404** correcto, sin 500 |
| Coherencia de assets | el HTML pide un asset que responde **200** (`bash scripts/despliegue.sh verificar`) |

**Si `/experiencias` da 200 y el resto 500**, el puente funciona y lo que falla es la conexión
a base de datos: revisar `DB_HOST`, `DB_USER`, `DB_PASSWORD` y `DB_NAME_NEW` en
`/home/ppxgfdyc/hestiat-app.env`.

---

## Vuelta atrás

**Opción rápida** (solo el punto de entrada, si el problema es el puente):
```
out=/home/ppxgfdyc/hestiat.com
cp "$out"/backups-index-mjs-* "$out/.output/server/index.mjs"
pkill -f 'lsnode:/home/ppxgfdyc/hestiat.com/'
```

**Opción completa** (si el árbol nuevo estorba):
```
out=/home/ppxgfdyc/hestiat.com
cd "$out"
mv .output .output.fallido
cp -a /home/ppxgfdyc/backups/output-<sello> .output
pkill -f 'lsnode:/home/ppxgfdyc/hestiat.com/'
sleep 10
curl -s -o /dev/null -w '%{http_code}\n' https://hestiat.com/
```

**Opción con el script**, que además verifica:
```
bash scripts/despliegue.sh vuelta-atras
```

### Qué queda intacto pase lo que pase

| Elemento | Dónde |
|---|---|
| `.output.antes-del-cutover` (si se usó `despliegue.sh corte`) | docroot |
| Copia del `index.mjs` anterior | docroot, `backups-index-mjs-*` |
| Copia completa del `.output` previo | `/home/ppxgfdyc/backups/output-*` |
| Volcado de datos verificado | `/home/ppxgfdyc/backups/hestiat-*.sql.gz` (0600) |
| Base original `ppxgfdyc_hestiat` | **intacta y sin tocar** |

**El cutover solo sustituye código.** Los datos no están en riesgo: la base nueva es una copia
y la original permanece como respaldo definitivo.

---

## Después

1. **24 horas de observación** antes de borrar el código anterior (fase E del plan de cutover).
2. `bash scripts/despliegue.sh registro` para dejar el acta del despliegue.
3. **No activar Cloudflare Proxy** hasta autorización expresa.
