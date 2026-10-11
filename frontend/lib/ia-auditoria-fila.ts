/**
 * CONSTRUCCIÓN DE LA FILA DE AUDITORÍA — módulo PURO, sin base de datos ni dependencias.
 *
 * Vive aparte para poder probarlo con pruebas automatizadas (tests/auditoria.test.ts).
 *
 * Nace de dos errores REALES de producción que hacían que se perdiera la traza del agente:
 *   · `admin_auditoria.entidad` es varchar(48) NOT NULL → nunca puede ir vacío.
 *   · `admin_auditoria.entidad_id` es bigint unsigned → un identificador que no sea un NÚMERO
 *     (el nombre de una herramienta del agente) no cabe: el INSERT fallaba entero.
 * Además, el servidor está en modo estricto: pasarse del ancho de la columna no recorta el texto,
 * hace fallar la inserción. Los anchos de aquí son los REALES de la tabla.
 */

/** Anchos reales de las columnas de `admin_auditoria`. */
export const ANCHO_AUDITORIA = { accion: 64, entidad: 48, detalle: 512, usuarioEmail: 191 } as const;

export interface DatosAuditoria {
  accion: string;
  usuarioId?: number | null;
  usuarioEmail?: string | null;
  entidad?: string | null;
  entidadId?: string | number | null;
  detalle?: Record<string, unknown>;
}

export interface FilaAuditoria {
  accion: string;
  usuarioId: number | null;
  usuarioEmail: string;
  entidad: string;
  entidadId: number | null;
  detalle: string;
}

export function prepararFilaAuditoria(datos: DatosAuditoria): FilaAuditoria {
  const idTexto = datos.entidadId != null ? String(datos.entidadId).trim() : "";
  const esNumero = idTexto !== "" && /^\d+$/.test(idTexto);

  let entidad = (datos.entidad ?? "ia").toString().trim() || "ia";
  const detalle: Record<string, unknown> = { ...(datos.detalle ?? {}) };
  if (idTexto !== "" && !esNumero) {
    // Identificador de texto: se conserva donde sí cabe, para no perder la traza.
    if (!entidad.includes(idTexto)) entidad = `${entidad}:${idTexto}`;
    if (detalle.identificador_texto == null) detalle.identificador_texto = idTexto;
  }

  return {
    accion: `ia:${datos.accion}`.slice(0, ANCHO_AUDITORIA.accion),
    usuarioId: datos.usuarioId ?? null,
    usuarioEmail: (datos.usuarioEmail ?? "sistema:agente-ia").slice(0, ANCHO_AUDITORIA.usuarioEmail),
    entidad: entidad.slice(0, ANCHO_AUDITORIA.entidad),
    entidadId: esNumero ? Number(idTexto) : null,
    detalle: JSON.stringify(detalle).slice(0, ANCHO_AUDITORIA.detalle),
  };
}
