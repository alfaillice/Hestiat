import { test } from "node:test";
import assert from "node:assert/strict";
import { leerEntradaReserva } from "../lib/reserva-entrada.ts";

/**
 * Entrada de /api/reservas.
 *
 * Cubre el defecto corregido: la ruta llegaba a la consulta con un identificador de alojamiento no
 * numérico en lugar de negarse antes.
 */

test("acepta una solicitud completa y conserva los textos tal cual", () => {
  const e = leerEntradaReserva({
    accommodationId: "27358",
    slug: "gemas-beach",
    desde: "2027-01-10",
    hasta: "2027-01-12",
    huespedes: "3",
  });
  assert.ok(e);
  assert.equal(e.accommodationId, 27358);
  assert.equal(e.slug, "gemas-beach");
  assert.equal(e.desde, "2027-01-10");
  assert.equal(e.hasta, "2027-01-12");
  assert.equal(e.huespedes, 3);
});

test("sin un alojamiento válido no se sigue", () => {
  const malos = ["", "abc", "0", 0, -1, null, undefined, "NaN", "1,5", 1.5, {}];
  for (const m of malos) {
    assert.equal(leerEntradaReserva({ accommodationId: m, slug: "x" }), null, `debería rechazar ${String(m)}`);
  }
});

test("los huéspedes ausentes se quedan en 1, como antes", () => {
  const e = leerEntradaReserva({ accommodationId: 5 });
  assert.ok(e);
  assert.equal(e.huespedes, 1);
  assert.equal(e.slug, "");
  assert.equal(e.desde, "");
});

test("un identificador válido no depende de la forma en que llegue", () => {
  assert.equal(leerEntradaReserva({ accommodationId: "7" })?.accommodationId, 7);
  assert.equal(leerEntradaReserva({ accommodationId: 7 })?.accommodationId, 7);
});
