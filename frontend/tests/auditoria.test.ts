/**
 * Pruebas automatizadas de la fila de auditoría.
 * Reproducen los dos errores REALES de producción que hacían perder la traza del agente:
 *   · el nombre de una herramienta enviado a la columna numérica `entidad_id`
 *   · `entidad` vacío en una columna NOT NULL
 * y comprueban que la corrección respeta los anchos reales de las columnas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { prepararFilaAuditoria, ANCHO_AUDITORIA } from "../lib/ia-auditoria-fila.ts";

test("nombre de herramienta (texto) nunca va a la columna numérica", () => {
  const f = prepararFilaAuditoria({
    accion: "herramienta:search_publications",
    usuarioEmail: "admin@ejemplo.test",
    entidad: "ia_herramienta",
    entidadId: "search_publications",
    detalle: { canal: "panel" },
  });
  assert.equal(f.entidadId, null, "entidad_id debe quedar vacío: una herramienta no tiene id numérico");
  assert.ok(f.entidad.includes("search_publications"), "el nombre debe conservarse en entidad");
  assert.ok(f.entidad.startsWith("ia_herramienta"), "debe mantenerse el tipo de entidad");
  assert.equal(JSON.parse(f.detalle).identificador_texto, "search_publications");
  assert.ok(f.accion.startsWith("ia:"));
});

test("entidad nunca queda vacía, aunque la llamada no la envíe", () => {
  const f = prepararFilaAuditoria({ accion: "herramienta_inexistente", entidadId: "no_existe" });
  assert.notEqual(f.entidad, null);
  assert.ok(typeof f.entidad === "string" && f.entidad.length > 0, "NOT NULL exige texto");
  assert.equal(f.entidadId, null);
});

test("un identificador numérico real sí se guarda como número", () => {
  const f = prepararFilaAuditoria({ accion: "envio_cancelado", entidad: "lead_contacto", entidadId: 12 });
  assert.equal(f.entidadId, 12);
  assert.equal(typeof f.entidadId, "number");
  assert.equal(f.entidad, "lead_contacto", "sin sufijo añadido cuando el id es numérico");
});

test("respeta los anchos reales de las columnas (modo estricto)", () => {
  const f = prepararFilaAuditoria({
    accion: "h".repeat(200),
    usuarioEmail: "e".repeat(300),
    entidad: "x".repeat(200),
    entidadId: "y".repeat(200),
    detalle: { relleno: "z".repeat(2000) },
  });
  assert.ok(f.accion.length <= ANCHO_AUDITORIA.accion, "accion <= 64");
  assert.ok(f.entidad.length <= ANCHO_AUDITORIA.entidad, "entidad <= 48");
  assert.ok(f.detalle.length <= ANCHO_AUDITORIA.detalle, "detalle <= 512");
  assert.ok(f.usuarioEmail.length <= ANCHO_AUDITORIA.usuarioEmail, "usuario_email <= 191");
  assert.deepEqual({ ...ANCHO_AUDITORIA }, { accion: 64, entidad: 48, detalle: 512, usuarioEmail: 191 });
});

test("sin identificador no se añade nada y el correo por defecto es el del sistema", () => {
  const f = prepararFilaAuditoria({ accion: "conversacion" });
  assert.equal(f.entidadId, null);
  assert.equal(f.entidad, "ia");
  assert.equal(f.usuarioEmail, "sistema:agente-ia");
  assert.equal(f.usuarioId, null);
});
