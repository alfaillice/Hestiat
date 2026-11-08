/**
 * PRUEBAS DE INTEGRACIÓN — FICHAS SIN `catalogo_dato`.
 *
 * Comprueban contra una instancia REAL del frontend que las tres fichas responden 200 (nunca 500)
 * cuando la tabla opcional de enriquecimiento no existe o está vacía. La base de producción no tiene
 * `catalogo_dato`, así que apuntar BASE_URL a esa instancia ya prueba el caso "no existe".
 *
 * Uso:
 *   BASE_URL=http://127.0.0.1:3010 npm run test:integration
 * (las rutas se pueden cambiar con SLUG_ALOJAMIENTO / SLUG_EXPERIENCIA / SLUG_SERVICIO)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? process.env.HESTIAT_BASE_URL ?? "";
const RUTAS: Array<[string, string]> = [
  ["alojamiento", "/alojamiento/" + (process.env.SLUG_ALOJAMIENTO ?? "casa-de-campo-en-elche")],
  ["experiencia", "/experiencias/" + (process.env.SLUG_EXPERIENCIA ?? "porta-do-dique-180315679")],
  ["servicio", "/servicios/" + (process.env.SLUG_SERVICIO ?? "-12670247549")],
];

for (const [tipo, ruta] of RUTAS) {
  test(`ficha de ${tipo} responde 200 con catalogo_dato ausente`, async (t) => {
    if (!BASE) {
      t.skip("BASE_URL no definido");
      return;
    }
    const respuesta = await fetch(BASE + ruta, { redirect: "follow" });
    assert.equal(respuesta.status, 200, `${ruta} devolvió ${respuesta.status}`);
    const html = await respuesta.text();
    assert.ok(html.includes("<html"), "la respuesta no es HTML");
    assert.ok(!/Application error|Server Components render/i.test(html), "la página contiene un error de servidor");
  });
}

test("buscador y listados siguen respondiendo 200 con catalogo_dato ausente", async (t) => {
  if (!BASE) {
    t.skip("BASE_URL no definido");
    return;
  }
  for (const ruta of ["/search", "/experiencias", "/servicios", "/sitemap.xml"]) {
    const r = await fetch(BASE + ruta, { redirect: "follow" });
    assert.equal(r.status, 200, `${ruta} devolvió ${r.status}`);
  }
});
