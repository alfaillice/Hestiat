import { test } from "node:test";
import assert from "node:assert/strict";
import { faltaClasificacion, faltaEnriquecimiento } from "../lib/catalogo-resiliente.ts";

test("si falta una tabla de categorías de experiencias se permite consulta básica", () => {
  assert.equal(faltaClasificacion({ code: "ER_NO_SUCH_TABLE", message: "Table 'db.exp_categoria' doesn't exist" }, "experiencia"), true);
  assert.equal(faltaClasificacion({ code: "ER_BAD_FIELD_ERROR", message: "Unknown column 'cl.categoria_id'" }, "experiencia"), true);
});
test("si falta clasificación de servicios se permite consulta básica", () => {
  assert.equal(faltaClasificacion({ code: "ER_NO_SUCH_TABLE", message: "Table 'db.servicio_clasificacion' doesn't exist" }, "servicio"), true);
  assert.equal(faltaClasificacion({ code: "ER_BAD_FIELD_ERROR", message: "Unknown column 'sub.nombre' in 'field list'" }, "servicio"), true);
});
test("no ocultar fallos de base, permisos, seguridad ni tablas principales", () => {
  for (const code of ["ER_ACCESS_DENIED_ERROR", "ECONNREFUSED", "PROTOCOL_CONNECTION_LOST"]) {
    assert.equal(faltaClasificacion({ code, message: "unknown" }, "experiencia"), false);
  }
  assert.equal(faltaClasificacion({ code: "ER_NO_SUCH_TABLE", message: "Table 'db.experiencia' doesn't exist" }, "experiencia"), false);
  assert.equal(faltaClasificacion({ code: "ER_NO_SUCH_TABLE", message: "Table 'db.servicio_turistico' doesn't exist" }, "servicio"), false);
  assert.equal(faltaClasificacion({ code: "ER_BAD_FIELD_ERROR", message: "Unknown column 'e.is_active'" }, "experiencia"), false);
});
test("enriquecimiento opcional solamente", () => {
  assert.equal(faltaEnriquecimiento({ code: "ER_NO_SUCH_TABLE", message: "Table 'db.catalogo_dato' doesn't exist" }), true);
  assert.equal(faltaEnriquecimiento({ code: "ER_ACCESS_DENIED_ERROR", message: "Access denied for user" }), false);
});
