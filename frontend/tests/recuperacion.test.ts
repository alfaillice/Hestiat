import { test } from "node:test";
import assert from "node:assert/strict";
import { huellaDelToken, tokenPlausible, revisarPasswordNueva, MINUTOS_VALIDEZ, LARGO_MINIMO_PASSWORD, MAX_SOLICITUDES_POR_HORA } from "../lib/recuperacion-reglas.ts";

/** Reglas de la recuperación de acceso. No tocan la base de datos. */

test("la huella del testigo es estable y no deja ver el testigo", () => {
  const t = "a".repeat(64);
  const h = huellaDelToken(t);
  assert.equal(h.length, 64);
  assert.equal(h, huellaDelToken(t));
  assert.notEqual(h, t);
  assert.ok(!h.includes(t));
});

test("solo se aceptan testigos con la forma esperada", () => {
  assert.equal(tokenPlausible("a".repeat(64)), true);
  assert.equal(tokenPlausible("A".repeat(64)), false);
  assert.equal(tokenPlausible("a".repeat(63)), false);
  assert.equal(tokenPlausible(""), false);
  assert.equal(tokenPlausible("'; DROP TABLE usuario; --"), false);
});

test("la contraseña nueva debe tener largo suficiente y coincidir", () => {
  assert.equal(revisarPasswordNueva("corta123", "corta123"), null);
  assert.ok(revisarPasswordNueva("corta1", "corta1"));
  assert.ok(revisarPasswordNueva("", ""));
  assert.ok(revisarPasswordNueva("unabuena12", "otraigual13"));
  assert.equal(revisarPasswordNueva("x".repeat(LARGO_MINIMO_PASSWORD), "x".repeat(LARGO_MINIMO_PASSWORD)), null);
});

test("los límites están declarados en un solo sitio", () => {
  assert.equal(MINUTOS_VALIDEZ, 60);
  assert.equal(LARGO_MINIMO_PASSWORD, 8);
  assert.equal(MAX_SOLICITUDES_POR_HORA, 3);
});
