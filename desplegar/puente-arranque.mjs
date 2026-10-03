/**
 * Hestiat 2.0 — PUENTE DE ARRANQUE para cPanel / LiteSpeed.
 *
 * QUÉ ES
 *   Este fichero se copia como `.output/server/index.mjs` en el docroot. Así, `app.cjs`
 *   (el arranque que LiteSpeed ya usa, y que NO se toca) hace `require("./.output/server/index.mjs")`
 *   y acaba levantando el servidor de Next.js en lugar del de Nitro.
 *
 * POR QUÉ FUNCIONA SIN RECONFIGURAR EL HOSTING
 *   Según documenta el propio `app.cjs` de producción, LiteSpeed arranca la app con
 *   `require(startupFile)` desde `/usr/local/lsws/fcgi-bin/lsnode.js` e **intercepta la
 *   llamada a `listen()`** del proceso para servirlo por su propio socket. Es decir: la
 *   aplicación no necesita saber en qué puerto escucha; basta con que llame a `listen()`.
 *   El servidor de Next lo hace, así que es interceptado igual que lo era Nitro.
 *
 *   Además se replican las variables que Nitro leía (HOST/PORT) para no cambiar ni una
 *   convención respecto a lo que LiteSpeed espera.
 *
 * DÓNDE VA EL BUILD
 *   Next se compila con `output: "standalone"`. El despliegue es:
 *
 *     1. cd frontend && npm ci && npm run build
 *     2. mkdir -p ../.next-standalone
 *        cp -r .next/standalone/. ../.next-standalone/
 *        cp -r .next/static ../.next-standalone/.next/static
 *        cp -r public ../.next-standalone/public          (si existe)
 *     3. cp desplegar/puente-arranque.mjs ../.output/server/index.mjs
 *     4. reiniciar el pool:  pkill -f 'lsnode:/home/ppxgfdyc/hestiat.com/'
 *
 *   El árbol `.next-standalone/` lleva su propio `server.js` y sus dependencias mínimas,
 *   sin arrastrar los cientos de MB de `node_modules`.
 *
 * VUELTA ATRÁS
 *   cp .output.antes-del-cutover/server/index.mjs .output/server/index.mjs  (o el renombrado
 *   completo que describe docs/VENTANA-MANTENIMIENTO.md). El puente no toca datos ni base.
 *
 * NO CONTIENE SECRETOS: lee el fichero de entorno del servidor, igual que app.cjs.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const aquí = dirname(fileURLToPath(import.meta.url));       // .../.output/server
const docroot = resolve(aquí, "../..");                      // el docroot de la aplicación
const ENV_FILE = process.env.HESTIAT_ENV_FILE ?? "/home/ppxgfdyc/hestiat-app.env";

/* 1. Entorno: misma lógica que app.cjs, para no cambiar hábitos del servidor. */
try {
  const raw = readFileSync(ENV_FILE, "utf8");
  for (const linea of raw.split("\n")) {
    const t = linea.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const clave = t.slice(0, eq).trim();
    let valor = t.slice(eq + 1).trim();
    if (valor.length > 1 && (valor[0] === '"' || valor[0] === "'") && valor.endsWith(valor[0])) {
      valor = valor.slice(1, -1);
    }
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
  console.log("[hestiat] entorno cargado desde", ENV_FILE);
} catch (error) {
  console.error("[hestiat] no se pudo leer", ENV_FILE, "→", error.message);
}

/* 2. Base de datos: el frontend lee el esquema NUEVO (la base migrada). */
process.env.DB_NAME_NEW = process.env.DB_NAME_NEW ?? "ppxgfdyc_hestiat2";

/* 3. Convenciones de escucha idénticas a las de Nitro, que es lo que LiteSpeed ya conoce. */
process.env.NODE_ENV = process.env.NODE_ENV ?? "production";
process.env.HOST = process.env.HOST ?? process.env.HOSTNAME ?? "0.0.0.0";
process.env.PORT = process.env.PORT ?? process.env.NITRO_PORT ?? "3000";
/* El servidor de Next mira `HOSTNAME` ANTES que `HOST` (comprobado en la prueba local:
   con HOSTNAME puesto por el sistema se ligaba a ese nombre y no atendía en 127.0.0.1).
   Se fijan los dos para que el enlace sea el mismo que espera LiteSpeed. */
process.env.HOSTNAME = process.env.HOST;

/* 4. Arrancar el servidor de Next. Si no está desplegado, se avisa con claridad en vez de
      morir en silencio: un error legible ahorra media hora de diagnóstico. */
const servidor = resolve(docroot, ".next-standalone/server.js");
try {
  console.log("[hestiat] arrancando Next desde", servidor, "· HOST=" + process.env.HOST, "PORT=" + process.env.PORT);
  await import(servidor);
} catch (error) {
  console.error("[hestiat] FALLO al arrancar Next.", "¿Está desplegado .next-standalone/? →", error.message);
  console.error("[hestiat] Vuelve atrás: restaura .output desde .output.antes-del-cutover.");
  process.exitCode = 1;
}
