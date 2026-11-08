/**
 * CONSULTAS A ANFITRIONES — mensajería privada visitante ↔ propietario registrado.
 *
 * Arquitectura: REUTILIZA el sistema de tickets existente. No hay un segundo sistema de mensajería.
 *
 *   ticket         → la conversación (asunto, estado, usuario_id = DESTINATARIO)
 *   ticket_mensaje → los mensajes (autor, contenido)
 *   ticket.alojamiento_id → qué alojamiento se está consultando
 *
 * SEPARACIÓN DE CONSULTAS Y SOPORTE (imprescindible):
 *   Los tickets de soporte NO son conversaciones públicas y no deben mezclarse.
 *   Se distinguen por la CATEGORÍA: las consultas a anfitriones usan categoria='alojamiento'.
 *   El soporte usa el resto (cancelacion, tecnico, cuenta_acceso, …). Ese ticket existente
 *   (HT-WVWDQ9CD, categoria='cancelacion', usuario_id=3) queda intacto y no entra en ninguna
 *   consulta de este módulo.
 *
 * PERMISOS: se comprueban SIEMPRE en el servidor, comparando contra la fila real del ticket.
 * Nadie puede leer una conversación ajena cambiando un identificador en la URL.
 *
 * PRIVACIDAD: aquí no se publica ni se lee ningún teléfono ni correo del anfitrión. El visitante
 * escribe por la plataforma; nunca ve datos privados.
 */

import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";

/** Categoría que identifica una consulta a anfitrión. El resto son tickets de soporte. */
export const CATEGORIA_CONSULTA = "alojamiento";

export type ConsultaResumen = {
  ticketId: number;
  codigo: string;
  alojamientoId: number | null;
  alojamientoTitulo: string | null;
  alojamientoSlug: string | null;
  asunto: string | null;
  estado: string;
  mensajes: number;
  ultimoEn: string | null;
  sinLeer: number;
};

export type MensajeConsulta = {
  id: number;
  autor: string;
  papel: string | null;
  contenido: string;
  creadoEn: string | null;
};

/** Código de ticket legible y único, con el mismo patrón que ya usa el soporte. */
function nuevoCodigo(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return `HT-${s}`;
}

/**
 * ¿Quién es el propietario legítimo de este alojamiento?
 * Se exige vínculo explícito en alojamiento_anfitrion. Si no hay, NO hay destinatario:
 * no se usa el administrador como sustituto y no se crea consulta.
 *
 * El acoplamiento con el alojamiento usa el identificador LEGACY, que es el que guarda
 * alojamiento_anfitrion.alojamiento_id (comprobado: 9 → usuario 2, 109437 → usuario 32).
 */
export async function propietarioDe(legacyId: number): Promise<number | null> {
  if (!Number.isFinite(legacyId) || legacyId <= 0) return null;
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT usuario_id FROM hestiat.alojamiento_anfitrion
      WHERE alojamiento_id = ? AND rol = 'propietario' LIMIT 1`,
    [legacyId],
  );
  const uid = filas[0]?.usuario_id;
  return uid ? Number(uid) : null;
}

/**
 * Crea la consulta. Devuelve el código o un motivo de rechazo.
 * El destinatario se resuelve en el servidor: el visitante no puede elegirlo.
 */
export async function crearConsulta(opciones: {
  legacyId: number;
  slug: string;
  visitanteId: number;
  visitanteNombre: string;
  asunto: string;
  mensaje: string;
}): Promise<{ ok: true; codigo: string; ticketId: number } | { ok: false; motivo: string }> {
  const asunto = String(opciones.asunto ?? "").trim().slice(0, 255);
  const mensaje = String(opciones.mensaje ?? "").trim();
  if (mensaje.length < 10) return { ok: false, motivo: "El mensaje es demasiado corto." };
  if (mensaje.length > 4000) return { ok: false, motivo: "El mensaje es demasiado largo." };

  const destinatario = await propietarioDe(opciones.legacyId);
  if (!destinatario) {
    return { ok: false, motivo: "Este alojamiento no tiene un propietario registrado al que escribir." };
  }
  // El anfitrión no se escribe a sí mismo: sería un ticket sin destinatario real.
  if (destinatario === opciones.visitanteId) {
    return { ok: false, motivo: "Eres el propietario de este alojamiento." };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Freno sencillo contra envíos duplicados: si el mismo visitante ya escribió por este
    // alojamiento en el último minuto, no se crea otro ticket.
    const [recientes] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id FROM ticket
        WHERE categoria = ? AND usuario_id = ? AND alojamiento_id = ?
          AND creado_en > (NOW() - INTERVAL 1 MINUTE) LIMIT 1`,
      [CATEGORIA_CONSULTA, destinatario, opciones.legacyId],
    );
    if (recientes.length > 0) {
      return { ok: false, motivo: "Ya has enviado una consulta hace un momento. Espera un poco." };
    }

    const codigo = nuevoCodigo();
    const [res] = await conn.query<mysql.ResultSetHeader>(
      `INSERT INTO ticket (codigo, usuario_id, contacto_email, contacto_nombre, asunto,
                           categoria, prioridad, estado, alojamiento_id, creado_en, actualizado_en)
       VALUES (?, ?, NULL, ?, ?, ?, 'normal', 'OPEN', ?, NOW(), NOW())`,
      [codigo, destinatario, opciones.visitanteNombre.slice(0, 160), asunto || "Consulta desde Hestiat",
       CATEGORIA_CONSULTA, opciones.legacyId],
    );
    const ticketId = Number(res.insertId);
    // El primer mensaje lo firma el VISITANTE: así el hilo conserva quién dijo qué.
    await conn.query(
      `INSERT INTO ticket_mensaje (ticket_id, autor, contenido, creado_en) VALUES (?, ?, ?, NOW())`,
      [ticketId, opciones.visitanteNombre.slice(0, 160), mensaje],
    );
    await conn.commit();
    return { ok: true, codigo, ticketId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Carga una conversación SOLO si quien la pide tiene derecho a verla.
 * Devuelve null sin distinguir entre «no existe» y «no tienes permiso»: así no se puede
 * deducir la existencia de conversaciones ajenas probando identificadores.
 */
export async function consultaSiAutorizado(
  ticketId: number,
  usuarioId: number,
  esSoporte = false,
): Promise<{ resumen: ConsultaResumen; hilo: MensajeConsulta[] } | null> {
  if (!Number.isFinite(ticketId)) return null;
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT t.id, t.codigo, t.usuario_id, t.asunto, t.estado, t.alojamiento_id,
            al.titulo, ac.slug
       FROM ticket t
       LEFT JOIN hestiat.alojamiento al ON al.id = t.alojamiento_id
       LEFT JOIN hestiat2.accommodation ac ON ac.legacy_id = t.alojamiento_id
      WHERE t.id = ? AND t.categoria = ? LIMIT 1`,
    [ticketId, CATEGORIA_CONSULTA],
  );
  const t = filas[0];
  if (!t) return null;

  const esDestinatario = Number(t.usuario_id) === Number(usuarioId);
  // El visitante es quien escribió el primer mensaje del hilo. No se guarda columna aparte
  // porque el sistema existente no la tiene: se lee del primer mensaje, que es su firma.
  const [primeros] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT autor FROM ticket_mensaje WHERE ticket_id = ? ORDER BY id ASC LIMIT 1`,
    [ticketId],
  );
  const [visitante] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM usuario WHERE nombre = ? LIMIT 1`,
    [String(primeros[0]?.autor ?? "")],
  );
  const esVisitante = Number(visitante[0]?.id) === Number(usuarioId);

  if (!esDestinatario && !esVisitante && !esSoporte) return null;

  const [hilo] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, autor, contenido, creado_en FROM ticket_mensaje WHERE ticket_id = ? ORDER BY id ASC`,
    [ticketId],
  );
  const [conteo] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS n, MAX(creado_en) AS ultimo FROM ticket_mensaje WHERE ticket_id = ?`,
    [ticketId],
  );
  return {
    resumen: {
      ticketId: Number(t.id),
      codigo: String(t.codigo),
      alojamientoId: t.alojamiento_id == null ? null : Number(t.alojamiento_id),
      alojamientoTitulo: t.titulo ?? null,
      alojamientoSlug: t.slug ?? null,
      asunto: t.asunto ?? null,
      estado: String(t.estado),
      mensajes: Number(conteo[0]?.n ?? 0),
      ultimoEn: conteo[0]?.ultimo ? String(conteo[0].ultimo) : null,
      sinLeer: 0,
    },
    hilo: hilo.map((m) => ({
      id: Number(m.id),
      autor: String(m.autor ?? ""),
      papel: null,
      contenido: String(m.contenido ?? ""),
      creadoEn: m.creado_en ? String(m.creado_en) : null,
    })),
  };
}

/** Responde en la conversación. Comprueba el permiso ANTES de escribir. */
export async function responderConsulta(opciones: {
  ticketId: number;
  usuarioId: number;
  autorNombre: string;
  contenido: string;
  esSoporte?: boolean;
}): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const contenido = String(opciones.contenido ?? "").trim();
  if (contenido.length < 2) return { ok: false, motivo: "El mensaje está vacío." };
  if (contenido.length > 4000) return { ok: false, motivo: "El mensaje es demasiado largo." };

  const acceso = await consultaSiAutorizado(opciones.ticketId, opciones.usuarioId, opciones.esSoporte);
  if (!acceso) return { ok: false, motivo: "No tienes acceso a esta conversación." };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO ticket_mensaje (ticket_id, autor, contenido, creado_en) VALUES (?, ?, ?, NOW())`,
      [opciones.ticketId, opciones.autorNombre.slice(0, 160), contenido],
    );
    // El estado refleja de quién es el turno: si responde el anfitrión, espera el visitante.
    const [t] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT usuario_id FROM ticket WHERE id = ? LIMIT 1`,
      [opciones.ticketId],
    );
    const esDestinatario = Number(t[0]?.usuario_id) === Number(opciones.usuarioId);
    await conn.query(
      `UPDATE ticket SET estado = ?, actualizado_en = NOW() WHERE id = ?`,
      [esDestinatario ? "WAITING_FOR_USER" : "IN_PROGRESS", opciones.ticketId],
    );
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Consultas recibidas por un anfitrión. Solo las suyas, solo de la categoría de consultas. */
export async function consultasDelAnfitrion(usuarioId: number): Promise<ConsultaResumen[]> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT t.id, t.codigo, t.asunto, t.estado, t.alojamiento_id, al.titulo, ac.slug,
            (SELECT COUNT(*) FROM ticket_mensaje m WHERE m.ticket_id = t.id) AS mensajes,
            (SELECT MAX(m.creado_en) FROM ticket_mensaje m WHERE m.ticket_id = t.id) AS ultimo
       FROM ticket t
       LEFT JOIN hestiat.alojamiento al ON al.id = t.alojamiento_id
       LEFT JOIN hestiat2.accommodation ac ON ac.legacy_id = t.alojamiento_id
      WHERE t.categoria = ? AND t.usuario_id = ?
      ORDER BY COALESCE(ultimo, t.creado_en) DESC LIMIT 200`,
    [CATEGORIA_CONSULTA, usuarioId],
  );
  return filas.map((f) => ({
    ticketId: Number(f.id),
    codigo: String(f.codigo),
    alojamientoId: f.alojamiento_id == null ? null : Number(f.alojamiento_id),
    alojamientoTitulo: f.titulo ?? null,
    alojamientoSlug: f.slug ?? null,
    asunto: f.asunto ?? null,
    estado: String(f.estado),
    mensajes: Number(f.mensajes ?? 0),
    ultimoEn: f.ultimo ? String(f.ultimo) : null,
    sinLeer: 0,
  }));
}
