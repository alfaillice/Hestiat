/**
 * Estados, propietario y reglas del alojamiento — SOLO SERVIDOR.
 *
 * Va aparte de `editor.server.ts` para que cada archivo se entienda de una vez, pero comparte la
 * misma idea: un único editor, permisos comprobados en servidor, y todo escrito en los DOS esquemas
 * (el panel y el catálogo público) para que no haya dos verdades.
 *
 * Sobre los estados: NO se ha creado ningún campo nuevo. El vocabulario que pedía el pliego encaja
 * con lo que ya existía en la base:
 *   · publicado  → `alojamiento.activo = 1` + `accommodation.status = 'published'`
 *   · borrador   → activo 0 + `draft`
 *   · oculto     → activo 0 + `paused`
 *   · bloqueado  → activo 0 + `archived`
 *   · pendiente de revisión → `estado_auditoria = 'needs_review'` (columna que ya existía)
 * Duplicar eso en un campo nuevo habría sido crear una segunda verdad sobre lo mismo.
 */
import { pool, poolLegacy } from "@/lib/db";
import type { ResultadoGuardado } from "@/lib/editor.server";

export type EstadoAlojamiento = "borrador" | "pendiente" | "publicado" | "oculto" | "bloqueado";

export interface EstadoInfo {
  id: EstadoAlojamiento;
  etiqueta: string;
  explicacion: string;
  /** ¿Lo ve el público en la web? */
  publico: boolean;
  /** ¿Puede ponerlo un anfitrión, o es decisión de la administración? */
  soloAdmin: boolean;
}

export const ESTADOS: EstadoInfo[] = [
  { id: "borrador", etiqueta: "Borrador", explicacion: "Se está preparando. No aparece en la web.", publico: false, soloAdmin: false },
  { id: "pendiente", etiqueta: "Pendiente de revisión", explicacion: "Listo para publicar, esperando revisión.", publico: false, soloAdmin: false },
  { id: "publicado", etiqueta: "Publicado", explicacion: "Visible y reservable en la web.", publico: true, soloAdmin: false },
  { id: "oculto", etiqueta: "Oculto", explicacion: "No se muestra, pero se conserva todo.", publico: false, soloAdmin: false },
  { id: "bloqueado", etiqueta: "Bloqueado", explicacion: "Retirado por la administración. No puede publicarse sin revisión.", publico: false, soloAdmin: true },
];

/** Estado actual a partir de las tres columnas reales. */
export function estadoDe(activo: unknown, status: unknown, auditoria: unknown): EstadoAlojamiento {
  if (String(auditoria ?? "") === "needs_review") return "pendiente";
  const s = String(status ?? "");
  if (Number(activo) === 1 || s === "published") return "publicado";
  if (s === "paused") return "oculto";
  if (s === "archived") return "bloqueado";
  return "borrador";
}

/** Un estado es público si el alojamiento está publicado. */
export function esPublico(estado: EstadoAlojamiento): boolean {
  return estado === "publicado";
}

/* ------------------------------------------------------------------- guardado -- */

export async function guardarEstado(
  legacyId: number,
  formulario: FormData,
  esAdmin: boolean,
): Promise<ResultadoGuardado> {
  const pedido = String(formulario.get("estado") ?? "") as EstadoAlojamiento;
  const info = ESTADOS.find((e) => e.id === pedido);
  if (!info) return { ok: false, error: "Estado no reconocido." };
  if (info.soloAdmin && !esAdmin) {
    return { ok: false, error: `Solo la administración puede poner el estado «${info.etiqueta}».` };
  }

  const activo = info.publico ? 1 : 0;
  const status = info.id === "publicado" ? "published" : info.id === "oculto" ? "paused" : info.id === "bloqueado" ? "archived" : "draft";
  const auditoria = info.id === "pendiente" ? "needs_review" : null;

  await poolLegacy.query(
    `UPDATE alojamiento SET activo = ?, estado_auditoria = ?,
            publicado_en = CASE WHEN ? = 1 THEN COALESCE(publicado_en, NOW()) ELSE publicado_en END,
            actualizado_en = NOW()
      WHERE id = ?`,
    [activo, auditoria, activo, legacyId],
  );
  await pool.query(
    `UPDATE accommodation SET status = ?,
            published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
            updated_at = NOW()
      WHERE legacy_id = ?`,
    [status, status, legacyId],
  );
  return { ok: true, mensaje: `Estado guardado: ${info.etiqueta}.` };
}

/* -------------------------------------------------------------------- reglas -- */

const siNo = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "");
  if (s === "1") return 1;
  if (s === "0") return 0;
  return null;
};

export async function guardarReglas(legacyId: number, f: FormData): Promise<ResultadoGuardado> {
  const checkIn = String(f.get("check_in") ?? "").trim().slice(0, 8);
  const checkOut = String(f.get("check_out") ?? "").trim().slice(0, 8);
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (checkIn && !hora.test(checkIn)) return { ok: false, error: "La hora de entrada debe tener el formato HH:MM." };
  if (checkOut && !hora.test(checkOut)) return { ok: false, error: "La hora de salida debe tener el formato HH:MM." };

  const edad = String(f.get("edad_minima") ?? "").trim();
  const edadNum = edad === "" ? null : Number(edad);
  if (edadNum !== null && (!Number.isInteger(edadNum) || edadNum < 0 || edadNum > 100)) {
    return { ok: false, error: "La edad mínima debe estar entre 0 y 100." };
  }

  const minN = String(f.get("estancia_minima") ?? "").trim();
  const maxN = String(f.get("estancia_maxima") ?? "").trim();
  const minNum = minN === "" ? null : Math.max(0, Math.round(Number(minN)));
  const maxNum = maxN === "" ? null : Math.max(0, Math.round(Number(maxN)));
  if (minNum !== null && maxNum !== null && minNum > 0 && maxNum > 0 && minNum > maxNum) {
    return { ok: false, error: "La estancia mínima no puede ser mayor que la máxima." };
  }

  const mascotas = siNo(f.get("admite_mascotas"));
  const fumar = siNo(f.get("admite_fumadores"));
  const fiestas = siNo(f.get("admite_fiestas"));
  const extra = String(f.get("reglas_extra") ?? "").trim().slice(0, 1000);

  await poolLegacy.query(
    `UPDATE alojamiento SET check_in=?, check_out=?, admite_mascotas=?, admite_fumadores=?, admite_fiestas=?,
            edad_minima=?, reglas_extra=?, estancia_minima=?, estancia_maxima=?, actualizado_en=NOW()
      WHERE id=?`,
    [checkIn || null, checkOut || null, mascotas, fumar, fiestas, edadNum, extra || null, minNum, maxNum, legacyId],
  );
  await pool.query(
    `UPDATE accommodation SET check_in_time=?, check_out_time=?, pets_allowed=?, smoking_allowed=?,
            parties_allowed=?, min_age=?, extra_rules=?, min_nights=?, max_nights=?, updated_at=NOW()
      WHERE legacy_id=?`,
    [checkIn || null, checkOut || null, mascotas, fumar, fiestas, edadNum, extra || null, minNum, maxNum, legacyId],
  );
  return { ok: true, mensaje: "Reglas guardadas." };
}

/* ----------------------------------------------------------------- propietario -- */

/** Cambia el anfitrión del alojamiento. Solo administración. */
export async function cambiarPropietario(legacyId: number, formulario: FormData): Promise<ResultadoGuardado> {
  const usuarioId = Number(formulario.get("usuario_id"));
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) return { ok: false, error: "Anfitrión no válido." };

  const [usuarios] = await poolLegacy.query<any[]>(
    `SELECT id, COALESCE(nombre_mostrado, nombre, apellidos) AS nombre, rol, activo, bloqueado_en
       FROM usuario WHERE id = ? LIMIT 1`,
    [usuarioId],
  );
  const u = usuarios[0];
  if (!u) return { ok: false, error: "Ese usuario no existe." };
  if (Number(u.activo) !== 1 || u.bloqueado_en) return { ok: false, error: "Ese usuario no está activo." };
  if (u.rol !== "anfitrion" && u.rol !== "admin") {
    return { ok: false, error: "Solo puede ser propietario un anfitrión o un administrador." };
  }

  const conn = await poolLegacy.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM alojamiento_anfitrion WHERE alojamiento_id = ?`, [legacyId]);
    await conn.query(`INSERT INTO alojamiento_anfitrion (alojamiento_id, usuario_id) VALUES (?, ?)`, [legacyId, usuarioId]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return { ok: true, mensaje: `Propietario cambiado a ${String(u.nombre ?? usuarioId)}.` };
}

/* ------------------------------------------------------------------ eliminación -- */

/**
 * Elimina un alojamiento por completo. Solo administración, y nunca si tiene reservas.
 *
 * La política del proyecto es explícita: un alojamiento con reservas no se borra —se desactiva—
 * porque borrarlo destruiría el historial de un huésped. Aquí se aplica esa misma regla, no otra.
 * Antes de borrar se quitan sus dependencias en los dos esquemas, en una transacción por base, y
 * después sus objetos del almacenamiento.
 */
export async function eliminarAlojamiento(
  legacyId: number,
  borrarObjeto: (url: string) => Promise<unknown>,
  confirmacion: string,
): Promise<ResultadoGuardado> {
  // Confirmación explícita: hay que escribir el nombre del alojamiento. Sin eso no se borra nada,
  // ni siquiera desde una petición fabricada a mano.
  const [tituloFila] = await poolLegacy.query<any[]>(`SELECT titulo FROM alojamiento WHERE id = ? LIMIT 1`, [legacyId]);
  const titulo = String(tituloFila[0]?.titulo ?? "").trim();
  if (!titulo || confirmacion.trim().toLowerCase() !== titulo.toLowerCase()) {
    return { ok: false, error: "Para eliminarlo, escribe exactamente el nombre del alojamiento." };
  }

  const [reservas] = await poolLegacy.query<any[]>(`SELECT COUNT(*) AS n FROM reserva WHERE alojamiento_id = ?`, [legacyId]);
  if (Number(reservas[0]?.n ?? 0) > 0) {
    return { ok: false, error: "Este alojamiento tiene reservas asociadas y no puede eliminarse. Desactívalo en su lugar." };
  }

  const [fotos] = await poolLegacy.query<any[]>(`SELECT url, variantes FROM alojamiento_foto WHERE alojamiento_id = ?`, [legacyId]);
  const [nueva] = await pool.query<any[]>(`SELECT id FROM accommodation WHERE legacy_id = ? LIMIT 1`, [legacyId]);
  const accommodationId = nueva[0] ? Number(nueva[0].id) : null;

  const conn = await poolLegacy.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM disponibilidad WHERE alojamiento_id = ?`, [legacyId]);
    await conn.query(`DELETE FROM alojamiento_foto WHERE alojamiento_id = ?`, [legacyId]);
    await conn.query(`DELETE FROM alojamiento_servicio WHERE alojamiento_id = ?`, [legacyId]);
    await conn.query(`DELETE FROM alojamiento_experiencia WHERE alojamiento_id = ?`, [legacyId]);
    await conn.query(`DELETE FROM alojamiento_servicio_turistico WHERE alojamiento_id = ?`, [legacyId]);
    await conn.query(`DELETE FROM alojamiento_anfitrion WHERE alojamiento_id = ?`, [legacyId]);
    await conn.query(`DELETE FROM ical_feed WHERE alojamiento_id = ?`, [legacyId]);
    await conn.query(`DELETE FROM ical_export_token WHERE alojamiento_id = ?`, [legacyId]);
    await conn.query(`DELETE FROM alojamiento WHERE id = ?`, [legacyId]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  if (accommodationId !== null) {
    const conn2 = await pool.getConnection();
    try {
      await conn2.beginTransaction();
      await conn2.query(`DELETE FROM accommodation_photo WHERE accommodation_id = ?`, [accommodationId]);
      await conn2.query(`DELETE FROM accommodation_amenity WHERE accommodation_id = ?`, [accommodationId]);
      await conn2.query(`DELETE FROM review WHERE accommodation_id = ?`, [accommodationId]);
      await conn2.query(`DELETE FROM accommodation WHERE id = ?`, [accommodationId]);
      await conn2.commit();
    } catch (e) {
      await conn2.rollback();
      throw e;
    } finally {
      conn2.release();
    }
  }

  // Objetos del almacenamiento: se intenta, y si uno falla no se deshace lo demás (las filas ya no
  // existen, así que un objeto huérfano es solo eso, un objeto huérfano).
  let borrados = 0;
  for (const foto of fotos) {
    const urls = [String(foto.url)];
    try {
      const variantes = foto.variantes ? JSON.parse(String(foto.variantes)) : [];
      for (const v of variantes) urls.push(String(v));
    } catch {
      /* variantes ilegibles: se borra solo la principal */
    }
    for (const url of urls) {
      try {
        await borrarObjeto(url);
        borrados += 1;
      } catch (error) {
        console.error("[hestiat] no se ha podido borrar el objeto", url, error);
      }
    }
  }

  return { ok: true, mensaje: `Alojamiento eliminado (${fotos.length} fotografías, ${borrados} objetos).` };
}
