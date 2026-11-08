import { test } from "node:test";
import assert from "node:assert/strict";
import { conCatalogoOpcional, faltaEnriquecimiento } from "../lib/catalogo-resiliente.ts";

/** Error con la forma que devuelve mysql2. */
function errorBd(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

test("catalogo_dato ausente: la lectura devuelve vacío en vez de romper la ficha", async () => {
  const resultado = await conCatalogoOpcional<string[]>(async () => {
    throw errorBd("ER_NO_SUCH_TABLE", "Table 'hestiat2.catalogo_dato' doesn't exist");
  }, []);
  assert.deepEqual(resultado, []);
  assert.equal(faltaEnriquecimiento(errorBd("ER_NO_SUCH_TABLE", "Table 'hestiat2.catalogo_dato' doesn't exist")), true);
});

test("catalogo_dato vacía: no hay error y se usa el dato original (lista vacía)", async () => {
  const resultado = await conCatalogoOpcional(async () => [] as string[], ["no-deberia-usarse"]);
  assert.deepEqual(resultado, []);
});

test("catalogo_dato con filas: se devuelven sin alterar", async () => {
  const filas = [{ item_id: 7, campo: "telefono", enriched_value: "956000000" }];
  const resultado = await conCatalogoOpcional(async () => filas, []);
  assert.deepEqual(resultado, filas);
});

test("no se toleran fallos reales: conexión, permisos ni tablas principales", async () => {
  for (const e of [
    errorBd("ECONNREFUSED", "connect ECONNREFUSED 127.0.0.1:3306"),
    errorBd("ER_ACCESS_DENIED_ERROR", "Access denied for user"),
    errorBd("ER_NO_SUCH_TABLE", "Table 'hestiat2.accommodation' doesn't exist"),
    errorBd("PROTOCOL_CONNECTION_LOST", "Connection lost"),
  ]) {
    await assert.rejects(() => conCatalogoOpcional(async () => { throw e; }, []));
  }
});

test("un error que no es de tabla ausente se propaga tal cual", async () => {
  const original = errorBd("ER_BAD_FIELD_ERROR", "Unknown column 'd.campo' in 'field list'");
  await assert.rejects(
    () => conCatalogoOpcional(async () => { throw original; }, []),
    (err: unknown) => (err as { code?: string }).code === "ER_BAD_FIELD_ERROR",
  );
});
