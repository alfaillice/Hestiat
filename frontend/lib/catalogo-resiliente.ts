/**
 * Recuperación conservadora de catálogos cuando faltan tablas opcionales de clasificación.
 * Solo admite errores estructurales de tablas auxiliares, NUNCA fallos de conexión o permisos.
 */
export function faltaClasificacion(error: unknown, tipo: "experiencia" | "servicio"): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  const code = e.code ?? "";
  const message = (e.message ?? "").toLowerCase();
  const tablas = tipo === "experiencia"
    ? /exp_categoria|experiencia_clasificacion/
    : /serv_categoria|servicio_clasificacion/;
  const alias = tipo === "experiencia" ? /['`](?:c|s|cl)\./ : /['`](?:c|sub|cl)\./;
  return (code === "ER_NO_SUCH_TABLE" && tablas.test(message)) ||
    (code === "ER_BAD_FIELD_ERROR" && alias.test(message));
}

/** Si falta el enriquecimiento opcional, los valores originales siguen siendo publicables. */
export function faltaEnriquecimiento(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return e.code === "ER_NO_SUCH_TABLE" && /catalogo_dato/i.test(e.message ?? "");
}
