import { test } from "node:test";
import assert from "node:assert/strict";
import { enlaceDeRecuperacion, textoDeRecuperacion, htmlDeRecuperacion } from "../lib/recuperacion-reglas.ts";

/** El contenido del correo se prueba SIN enviar ningún mensaje. */

test("el enlace lleva el testigo a la página correcta", () => {
  const e = enlaceDeRecuperacion("b".repeat(64));
  assert.ok(e.startsWith("https://"));
  assert.ok(e.includes("/restablecer/"));
  assert.ok(e.endsWith("b".repeat(64)));
});

test("el texto dice qué hacer y avisa de la caducidad y del uso único", () => {
  const t = textoDeRecuperacion(enlaceDeRecuperacion("c".repeat(64)));
  assert.ok(t.includes("/restablecer/"));
  assert.ok(/una vez/i.test(t));
  assert.ok(/una hora/i.test(t));
  assert.ok(/no se ha tocado/i.test(t));
});

test("el saludo usa el nombre cuando lo hay", () => {
  assert.ok(textoDeRecuperacion("https://x/y", "Ana").startsWith("Hola Ana:"));
  assert.ok(textoDeRecuperacion("https://x/y", null).startsWith("Hola:"));
});

test("la versión con formato enlaza al mismo sitio", () => {
  const e = enlaceDeRecuperacion("d".repeat(64));
  const h = htmlDeRecuperacion(e);
  assert.ok(h.includes(`href="${e}"`));
  assert.ok(h.includes("<p>"));
});
