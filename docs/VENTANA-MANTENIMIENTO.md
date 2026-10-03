# Ventana de mantenimiento y cutover — Hestiat 2.0

Runbook para sustituir la aplicación en marcha por el frontend Next.js, con verificación
y vuelta atrás en cada paso. Complementa `docs/CUTOVER-PLAN.md` y `scripts/despliegue.sh`.

---

## 0. Aviso previo: por qué NO se ha pulsado el corte todavía

Hay **un bloqueo técnico real**, no una precaución:

- LiteSpeed arranca la aplicación con **`app.cjs` → `.output/server/index.mjs`**, que es un
  servidor **Nitro**.
- El frontend es **Next.js**: produce `.next/` y arranca con `next start` — **otro punto de
  entrada**.
- **Ejecutar `corte` sin resolver eso deja el sitio fuera de servicio**: LiteSpeed intentaría
  arrancar el fichero equivocado.

Además, el frontend **todavía no está construido en el servidor** (solo está compilado y
verificado en el entorno de trabajo: `npm install` + `npm run build` pasan, tipos incluidos).

**Por tanto: no se lanza `corte` hasta cerrar los dos puntos E.1 y E.2.** Lo demás está listo.

---

## 1. Lo que está preparado

| Elemento | Estado |
|---|---|
| Frontend compilado y verificando tipos | **Hecho** (`/`, `/search`, `/experiencias`, `/alojamiento/[slug]`) |
| Diseño replicado de producción (tokens OKLCH reales) | **Hecho** |
| Datos migrados al esquema nuevo | **Hecho** (27.359 alojamientos, 17.619 fotos, 12.185 servicios) |
| Copia de datos verificada por restauración | **Hecho** (`docs/ACTA-COPIAS-VERIFICADA.md`) |
| Copia de la aplicación con hash y extracción | **Hecho** (3.106.370 B, 314 ficheros, entry idéntico) |
| Script de despliegue con vuelta atrás | **Hecho** (`scripts/despliegue.sh`) |
| Build de Next en el servidor | **PENDIENTE** (punto E.1) |
| Punto de entrada compatible con LiteSpeed | **PENDIENTE** (punto E.2) |

---

## 2. Antes de la ventana (día anterior)

1. **Avisar** a los usuarios si procede.
2. **Copia de datos final**, inmediatamente antes del corte, y verificarla por restauración:
   ```
   bash scripts/restaurar-verificado.sh --destino ppxgfdyc_hestiat2 \
        --volcado /home/ppxgfdyc/backups/hestiat-<sello>.sql.gz --temporal=false
   ```
3. **Comprobar el estado de partida** (debe dar 200):
   ```
   bash scripts/despliegue.sh verificar
   ```
4. **Bajar el TTL del DNS** si se va a tocar DNS. En este plan **no se toca DNS**.

## 3. Durante la ventana — pasos

### E.1 Construir el frontend en el servidor
```
cd /home/ppxgfdyc/hestiat2/frontend      # o donde quede el código
npm ci && npm run build
```
Verificar: `.next/` generado y sin errores de tipos.

### E.2 Punto de entrada compatible con LiteSpeed
Dos opciones, y hay que elegir una **antes** de cortar:

- **A. Reconfigurar la aplicación** para que arranque el servidor de Next
  (`next start`, o el `server.js` del build *standalone*). Es la vía limpia, y requiere
  acción en el panel del hosting.
- **B. Puente de arranque**: generar un `.output/server/index.mjs` que arranque el servidor
  de Next respetando las mismas variables de puerto y host que usa LiteSpeed, para que
  `app.cjs` siga siendo válido y **no haya que tocar la configuración del hosting**.

Sea cual sea, el requisito es el mismo: **el proceso debe escuchar donde LiteSpeed espera y
respetar las variables `PORT`/`HOSTNAME` y las de base de datos.**

### E.3 Preparar el build y verificar el candidato
```
bash scripts/despliegue.sh preparar /home/ppxgfdyc/backups/app/hestiat2-build.zip
```
El script **no toca producción**: descomprime en `.output.nuevo` y comprueba que el índice
de cliente que nombra el manifiesto **existe de verdad** en su `public/`. Si no, aborta.

### E.4 Corte atómico
```
bash scripts/despliegue.sh corte
```
Hace, en este orden: `.output` → `.output.antes-del-cutover`, el nuevo → `.output`, vacía el
pool (`pkill -f 'lsnode:/home/ppxgfdyc/hestiat.com/'`), espera y **verifica**. Si la
verificación falla, **avisa y no da el corte por bueno**.

### E.5 Verificación obligatoria
```
bash scripts/despliegue.sh verificar
```
Debe dar **200** en `/`, `/search` y `/experiencias`, 404 correcto en una ruta inexistente, y
**coherencia de assets**: el HTML debe pedir un asset que responda 200 (es lo que nos falló
en el incidente del mosaico de builds).

Comprobación adicional de las cuatro rutas del frontend:
```
for r in / /search /experiencias /alojamiento/gemas-beach; do
  printf '%-28s %s\n' "$r" "$(curl -s -o /dev/null -w '%{http_code}' https://hestiat.com$r)"
done
```

### E.6 Batería de humo
Datos reales, autenticación (`/admin` y `/host` → 307 a login), autorización con casos
negativos (propietario A no ve lo de B), fotos servidas, reservas y rendimiento.

---

## 4. Vuelta atrás — procedimiento documentado

**Disponible en cualquier momento**, y es un solo bloque:

```
cd /home/ppxgfdyc/hestiat.com
mv .output .output.fallido && mv .output.antes-del-cutover .output
pkill -f 'lsnode:/home/ppxgfdyc/hestiat.com/'
sleep 10
curl -s -o /dev/null -w '%{http_code}\n' https://hestiat.com/
```

O con el propio script:
```
bash scripts/despliegue.sh vuelta-atras
```

### Qué se conserva como red de seguridad

| Elemento | Para qué |
|---|---|
| `.output.antes-del-cutover` | Volver al build anterior completo |
| `.output.old` | Build previo ya existente en el servidor |
| `/home/ppxgfdyc/backups/hestiat-*.sql.gz` (0600) | Restaurar datos |
| `/home/ppxgfdyc/backups/app/hestiat-app-*.tar.gz` | Reconstruir el código antiguo |
| Base original `ppxgfdyc_hestiat` | **Intacta**: respaldo definitivo de los datos |

**Los datos no corren riesgo en el cutover**: el corte solo sustituye código. La base nueva
es una copia; la original permanece intacta y sin tocar.

---

## 5. Después de la ventana

1. **Observación de 24 h** sin incidencias antes del borrado del código anterior (fase E del
   plan de cutover).
2. Registrar el despliegue: `bash scripts/despliegue.sh registro`.
3. **No activar Cloudflare Proxy** hasta autorización expresa del cliente.

---

## 6. Qué falta, resumido

1. **E.1** construir el frontend en el servidor.
2. **E.2** resolver el punto de entrada (reconfigurar la aplicación **o** el puente de arranque).
3. **El token de R2** (acción del cliente en Cloudflare) para que las copias salgan del servidor.
