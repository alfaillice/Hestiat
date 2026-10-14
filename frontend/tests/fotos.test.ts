/**
 * Pruebas automatizadas del tipo de imagen por bytes de cabecera.
 *
 * Es la pieza que decide si un archivo subido es una imagen de verdad. No se puede basar en lo que
 * declare el navegador: un archivo puede llamarse .jpg y ser cualquier cosa. Aquí se comprueban los
 * bytes reales de cada formato, y que lo que no es imagen se rechaza.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tipoPorCabecera, nombreDeTipoFormato } from "../lib/fotos-tipos.ts";

function bytes(inicio: number[], largo = 16): Uint8Array {
  const b = new Uint8Array(largo);
  inicio.forEach((v, i) => (b[i] = v));
  return b;
}

test("detecta JPEG por su cabecera FF D8 FF", () => {
  assert.equal(tipoPorCabecera(bytes([0xff, 0xd8, 0xff, 0xe0])), "jpg");
});

test("detecta PNG por su cabecera 89 50 4E 47", () => {
  assert.equal(tipoPorCabecera(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
});

test("detecta WebP por RIFF + WEBP", () => {
  const b = new Uint8Array(16);
  "RIFF".split("").forEach((c, i) => (b[i] = c.charCodeAt(0)));
  "WEBP".split("").forEach((c, i) => (b[8 + i] = c.charCodeAt(0)));
  assert.equal(tipoPorCabecera(b), "webp");
});

test("rechaza lo que no es imagen", () => {
  // Un PDF empieza por %PDF
  assert.equal(tipoPorCabecera(bytes([0x25, 0x50, 0x44, 0x46])), null);
  // Un ZIP (y por tanto un docx) empieza por PK
  assert.equal(tipoPorCabecera(bytes([0x50, 0x4b, 0x03, 0x04])), null);
  // Texto plano
  assert.equal(tipoPorCabecera(bytes([0x68, 0x6f, 0x6c, 0x61])), null);
  // Un GIF es una imagen, pero NO está admitida en este gestor
  assert.equal(tipoPorCabecera(bytes([0x47, 0x49, 0x46, 0x38])), null);
});

test("un archivo demasiado corto no se acepta", () => {
  assert.equal(tipoPorCabecera(new Uint8Array([0xff, 0xd8, 0xff])), null);
  assert.equal(tipoPorCabecera(new Uint8Array(0)), null);
});

test("RIFF sin WEBP no cuela como imagen", () => {
  const b = new Uint8Array(16);
  "RIFF".split("").forEach((c, i) => (b[i] = c.charCodeAt(0)));
  "AVI ".split("").forEach((c, i) => (b[8 + i] = c.charCodeAt(0)));
  assert.equal(tipoPorCabecera(b), null);
});

test("los nombres se muestran legibles", () => {
  assert.equal(nombreDeTipoFormato("jpg"), "JPEG");
  assert.equal(nombreDeTipoFormato("png"), "PNG");
  assert.equal(nombreDeTipoFormato("webp"), "WEBP");
});
