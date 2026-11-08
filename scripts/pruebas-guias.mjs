/**
 * PRUEBA DEL CUERPO DE LAS GUÍAS
 *
 * Comprueba lo único que no puede romperse al convertir las direcciones del cuerpo
 * en enlaces: que el texto siga siendo exactamente el mismo, palabra por palabra.
 *
 * Cómo ejecutarla (en el servidor, donde está la base de datos):
 *
 *   1. Traer los cuerpos, sin romper los saltos de línea, en base64:
 *      mariadb -N -B hestiat2 -e "SELECT CONCAT(slug,'|',COALESCE(destino,''),'|',estado,'|',
 *        REPLACE(TO_BASE64(cuerpo),'\n','')) FROM guia ORDER BY id" > /tmp/guias.txt
 *
 *   2. Traer a un JSON los mismos cuerpos (slug, destino, estado, cuerpo) y apuntarlo aquí.
 *
 *   3. node scripts/pruebas-guias.mjs /tmp/guias-db.json
 *
 * Sale con código 0 solo si, en todas las guías, el texto reconstruido es idéntico al
 * original y todas las direcciones quedan como enlaces internos de Hestiat.
 */
import fs from "node:fs";
import { trozosDelCuerpo, textoReconstruido } from "../frontend/lib/guia-render.ts";

const ruta = process.argv[2];
const guias = JSON.parse(fs.readFileSync(ruta, "utf8"));
let fallos = 0;

for (const g of guias) {
  const trozos = trozosDelCuerpo(g.cuerpo);
  const enlaces = trozos.filter((t) => t.tipo === "enlace");
  const igual = textoReconstruido(trozos) === g.cuerpo;
  const internos = enlaces.every((e) => e.interno && e.href.startsWith("https://hestiat.com/"));
  const presentes = enlaces.every((e) => g.cuerpo.includes(e.href));
  console.log(
    `${g.slug} | texto idéntico: ${igual ? "SÍ" : "NO"} | enlaces: ${enlaces.length} | ` +
      `todos internos: ${internos ? "sí" : "NO"} | todos presentes: ${presentes ? "sí" : "NO"}`,
  );
  if (!igual || !internos || !presentes || enlaces.length === 0) fallos += 1;
  if (g.estado !== "en_revision") {
    console.log(`  AVISO: ${g.slug} no está en revisión, está en "${g.estado}"`);
    fallos += 1;
  }
}

console.log(fallos === 0 ? "RESULTADO: correcto" : `RESULTADO: ${fallos} fallos`);
process.exit(fallos === 0 ? 0 : 1);
