import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarWhatsapp, enlaceWhatsapp, mensajeWhatsapp } from "../lib/whatsapp.ts";

/** Reglas del contacto por WhatsApp. No tocan la base de datos ni envían nada. */

test("un móvil español de nueve dígitos se completa con el 34", () => {
  assert.equal(normalizarWhatsapp("612345678"), "34612345678");
  assert.equal(normalizarWhatsapp("712 345 678"), "34712345678");
});

test("se quitan espacios, guiones y paréntesis", () => {
  assert.equal(normalizarWhatsapp("+34 (612) 345-678"), "34612345678");
  assert.equal(normalizarWhatsapp("0034 612345678"), "34612345678");
});

test("los números que no sirven devuelven null: sin botón", () => {
  for (const malo of ["", "   ", null, undefined, "123", "abcdef", "+", "1234567890123456789", "0000"]) {
    assert.equal(normalizarWhatsapp(malo), null, "debería rechazar " + String(malo));
  }
});

test("los números internacionales se respetan", () => {
  assert.equal(normalizarWhatsapp("+351912345678"), "351912345678");
  assert.equal(normalizarWhatsapp("+33 6 12 34 56 78"), "33612345678");
});

test("el mensaje lleva el título del alojamiento y su enlace", () => {
  const m = mensajeWhatsapp("Gemas Beach", "https://hestiat.com/alojamiento/gemas-beach");
  assert.ok(m.includes("Gemas Beach"));
  assert.ok(m.includes("https://hestiat.com/alojamiento/gemas-beach"));
  assert.ok(m.includes("disponibilidad"));
});

test("el enlace es de wa.me y lleva el mensaje codificado", () => {
  const u = enlaceWhatsapp("34612345678", "Hola, ¿disponible?");
  assert.ok(u.startsWith("https://wa.me/34612345678?text="));
  assert.ok(u.includes(encodeURIComponent("Hola, ¿disponible?")));
  assert.ok(!u.includes(" "));
});
