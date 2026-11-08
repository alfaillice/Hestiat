import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarTipoCatalogo, esTipoLista } from "../lib/tipos-catalogo.ts";

/**
 * Tipo de catálogo de /api/catalogo/lista.
 *
 * Cubre el defecto corregido: cualquier valor que no fuese exactamente «service» devolvía
 * experiencias sin avisar.
 */

test("acepta los valores en inglés", () => {
  assert.equal(normalizarTipoCatalogo("service"), "service");
  assert.equal(normalizarTipoCatalogo("experience"), "experience");
});

test("acepta los valores en español, que son los que usa el panel del anfitrión", () => {
  assert.equal(normalizarTipoCatalogo("servicio"), "service");
  assert.equal(normalizarTipoCatalogo("servicios"), "service");
  assert.equal(normalizarTipoCatalogo("experiencia"), "experience");
  assert.equal(normalizarTipoCatalogo("experiencias"), "experience");
  assert.equal(normalizarTipoCatalogo("servicio_turistico"), "service");
});

test("no distingue mayúsculas ni espacios sobrantes", () => {
  assert.equal(normalizarTipoCatalogo("SERVICIO"), "service");
  assert.equal(normalizarTipoCatalogo("  Experiencia  "), "experience");
});

test("un valor vacío o ausente mantiene el comportamiento anterior: experiencias", () => {
  assert.equal(normalizarTipoCatalogo(""), "experience");
  assert.equal(normalizarTipoCatalogo("   "), "experience");
  assert.equal(normalizarTipoCatalogo(null), "experience");
  assert.equal(normalizarTipoCatalogo(undefined), "experience");
});

test("un valor no reconocido devuelve null, que la ruta traduce a 400", () => {
  assert.equal(normalizarTipoCatalogo("loquesea"), null);
  assert.equal(normalizarTipoCatalogo("alojamiento"), null);
  assert.equal(normalizarTipoCatalogo("servicio turistico"), null);
  assert.equal(normalizarTipoCatalogo("servicio;drop"), null);
});

test("el tipo canónico se reconoce como tal", () => {
  assert.equal(esTipoLista("service"), true);
  assert.equal(esTipoLista("experience"), true);
  assert.equal(esTipoLista("servicio"), false);
  assert.equal(esTipoLista(null), false);
});
