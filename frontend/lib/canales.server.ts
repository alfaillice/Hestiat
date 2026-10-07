/**
 * Canales de reserva (Airbnb, Booking…) por iCalendar — SOLO servidor.
 *
 * Qué es real y qué no:
 *  - **ICS/iCal**: es el mecanismo que Airbnb y Booking ofrecen sin ser partner. Aquí se
 *    importa el calendario del canal (URL .ics pública) y se exporta el de Hestiat.
 *  - **API oficial** de Airbnb/Booking: exige autorización y contrato que Hestiat no tiene.
 *    No se implementa ni se simula; la interfaz lo dice con esas palabras.
 *
 * Reutiliza lo que YA existe: `ical_feed` (canal, url, última sync, estado, error),
 * `ical_export_token` (token por alojamiento) y `disponibilidad`
 * (`motivo`, `origen`, `uid_externo`), más `getExportCalendar()` para la exportación.
 *
 * Reglas que no se negocian:
 *  - Un evento importado se escribe con `motivo='ical'`, `origen=<canal>` y `uid_externo=UID`.
 *  - `INSERT IGNORE`: **nunca** pisa una reserva ni un bloqueo manual de Hestiat.
 *  - Al desconectar o re-sincronizar un canal se borran SOLO sus filas (`origen = canal`),
 *    jamás las que tienen `reserva_id`.
 */
import { randomBytes } from "node:crypto";

import { query, queryOne } from "./db-legacy.server";
import { ownsListing } from "./auth.server";
import { MAX_DESCARGA_BYTES, TIMEOUT_MS, nochesDeEvento, parsearIcs, validarUrlIcs, sumarDias, type Canal, type EventoIcs, MAX_EVENTOS, MAX_DIAS_POR_EVENTO, CANALES } from "./ics";

// La validación y el parser viven en `@/lib/ics` (lógica pura, probable sin base de datos).
export { CANALES, MINUTOS_CADUCIDAD } from "./ics";
import { MINUTOS_CADUCIDAD } from "./ics";
export type { Canal, EventoIcs, Validacion } from "./ics";

/* ------------------------------------------------------------------ esquema --- */

let esquemaCanales: Promise<void> | undefined;

/** Añade `ical_feed.eventos` (nº de eventos importados) si falta. Aditivo e idempotente. */
export async function asegurarEsquemaCanales(): Promise<void> {
  if (!esquemaCanales) {
    esquemaCanales = (async () => {
      const columnas = await query<{ COLUMN_NAME: string }>(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ical_feed'`,
      );
      const tiene = new Set(columnas.map((c) => String(c.COLUMN_NAME).toLowerCase()));
      if (!tiene.has("eventos")) await query(`ALTER TABLE ical_feed ADD COLUMN eventos INT UNSIGNED NULL`);
    })().catch((error) => {
      esquemaCanales = undefined;
      throw error;
    });
  }
  return esquemaCanales;
}

/* ------------------------------------------------------- token de exportación --- */

/** Devuelve (creándolo si hace falta) el token de exportación de un alojamiento. */
/**
 * ¿Puede este usuario gestionar los calendarios del alojamiento?
 *
 * El anfitrión dueño **o un administrador**: el editor es el mismo para los dos, así que si aquí
 * solo se aceptara al dueño, un administrador no podría tocar los calendarios desde el editor
 * compartido. Se comprueba en servidor, no en la interfaz.
 */
export async function puedeGestionar(usuarioId: number, alojamientoId: number): Promise<boolean> {
  if (await ownsListing(usuarioId, alojamientoId)) return true;
  const filas = await query<Record<string, unknown>>(
    `SELECT rol FROM usuario WHERE id = ? AND activo = 1 AND bloqueado_en IS NULL LIMIT 1`,
    [usuarioId],
  );
  return String(filas[0]?.["rol"] ?? "") === "admin";
}

export async function obtenerTokenExport(usuarioId: number, alojamientoId: number) {
  if (!(await puedeGestionar(usuarioId, alojamientoId))) return null;
  await asegurarEsquemaCanales();
  const existente = await queryOne<{ token: string }>(
    `SELECT token FROM ical_export_token WHERE alojamiento_id = ? LIMIT 1`,
    [alojamientoId],
  );
  if (existente) return { token: String(existente.token), creado: false };
  const token = randomBytes(16).toString("hex"); // 32 caracteres, como espera la tabla
  await query(`INSERT INTO ical_export_token (alojamiento_id, token) VALUES (?,?) ON DUPLICATE KEY UPDATE token = token`, [
    alojamientoId,
    token,
  ]);
  return { token, creado: true };
}

/* ------------------------------------------------------------- validar URL --- */

/** Descarga el ICS con límites de tamaño, tiempo y tipo de contenido. */
export async function descargarIcs(url: string): Promise<{ ok: true; texto: string } | { ok: false; tipo: "invalid" | "error"; motivo: string }> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: control.signal,
      redirect: "follow",
      headers: { "user-agent": "Hestiat/1.0 (+https://hestiat.com; sincronizacion de calendario)", accept: "text/calendar, text/plain, */*" },
    });
    if (!res.ok) {
      return { ok: false, tipo: "error", motivo: `El canal respondió ${res.status}. Comprueba que el calendario siga siendo público.` };
    }
    const largo = Number(res.headers.get("content-length") ?? 0);
    if (largo > MAX_DESCARGA_BYTES) return { ok: false, tipo: "invalid", motivo: "El calendario es demasiado grande (más de 2 MB)." };
    const texto = (await res.text()).slice(0, MAX_DESCARGA_BYTES);
    if (!/BEGIN:VCALENDAR/i.test(texto)) {
      return { ok: false, tipo: "invalid", motivo: "La respuesta no es un calendario iCal válido (no contiene BEGIN:VCALENDAR)." };
    }
    return { ok: true, texto };
  } catch (error) {
    const motivo =
      error instanceof Error && error.name === "AbortError"
        ? "El canal tardó demasiado en responder."
        : "No se ha podido descargar el calendario (red o permisos de la URL).";
    return { ok: false, tipo: "error", motivo };
  } finally {
    clearTimeout(temporizador);
  }
}

/* -------------------------------------------------------- importar / sincronizar --- */

export type ResultadoSync = {
  ok: boolean;
  estado: "ok" | "error" | "invalid";
  motivo: string | null;
  eventos: number;
  fechas: number;
};

/** Escribe en `disponibilidad` las noches del canal, sin pisar nada de Hestiat. */
async function importarEventos(alojamientoId: number, canal: Canal, eventos: EventoIcs[]): Promise<{ eventos: number; fechas: number }> {
  // 1. Se retiran SOLO las noches importadas antes de este mismo canal.
  await query(`DELETE FROM disponibilidad WHERE alojamiento_id = ? AND origen = ? AND reserva_id IS NULL`, [alojamientoId, canal]);

  let fechas = 0;
  for (const ev of eventos) {
    const inicio = ev.desde;
    let fin = ev.hasta;
    const dias = Math.round((new Date(`${fin}T00:00:00Z`).getTime() - new Date(`${inicio}T00:00:00Z`).getTime()) / 86_400_000);
    if (dias > MAX_DIAS_POR_EVENTO) fin = sumarDias(inicio, MAX_DIAS_POR_EVENTO);
    for (let f = inicio; f <= fin; f = sumarDias(f, 1)) {
      // INSERT IGNORE: si esa noche ya es una reserva o un bloqueo manual, se respeta.
      const res = (await query(
        `INSERT IGNORE INTO disponibilidad (alojamiento_id, fecha, motivo, reserva_id, origen, uid_externo)
         VALUES (?,?, 'ical', NULL, ?, ?)`,
        [alojamientoId, f, canal, ev.uid ?? null],
      )) as unknown as { affectedRows?: number };
      if ((res?.affectedRows ?? 0) > 0) fechas += 1;
    }
  }
  return { eventos: eventos.length, fechas };
}

/** Conecta (o actualiza) el calendario de un canal: valida, descarga e importa. */
export async function conectarCanal(usuarioId: number, alojamientoId: number, canal: Canal, url: string): Promise<ResultadoSync & { error?: string }> {
  if (!(await puedeGestionar(usuarioId, alojamientoId))) return { ok: false, estado: "error", motivo: "Ese alojamiento no es tuyo.", eventos: 0, fechas: 0 };
  await asegurarEsquemaCanales();

  const limpia = url.trim();
  const validacion = validarUrlIcs(limpia);
  if (!validacion.ok) {
    await guardarFeed(alojamientoId, canal, limpia, "invalid", validacion.motivo, 0);
    return { ok: false, estado: "invalid", motivo: validacion.motivo, eventos: 0, fechas: 0 };
  }

  const descarga = await descargarIcs(limpia);
  if (!descarga.ok) {
    await guardarFeed(alojamientoId, canal, limpia, descarga.tipo, descarga.motivo, 0);
    return { ok: false, estado: descarga.tipo, motivo: descarga.motivo, eventos: 0, fechas: 0 };
  }

  const eventos = parsearIcs(descarga.texto);
  const { eventos: nEventos, fechas } = await importarEventos(alojamientoId, canal, eventos);
  await guardarFeed(alojamientoId, canal, limpia, "ok", null, nEventos);
  return { ok: true, estado: "ok", motivo: null, eventos: nEventos, fechas };
}

async function guardarFeed(
  alojamientoId: number,
  canal: Canal,
  url: string,
  estado: "ok" | "error" | "invalid",
  error: string | null,
  eventos: number,
) {
  await query(
    `INSERT INTO ical_feed (alojamiento_id, canal, url, ultima_sync, ultimo_estado, ultimo_error, activo, eventos)
     VALUES (?,?,?,NOW(),?,?,1,?)
     ON DUPLICATE KEY UPDATE url = VALUES(url), ultima_sync = NOW(), ultimo_estado = VALUES(ultimo_estado),
                             ultimo_error = VALUES(ultimo_error), activo = 1, eventos = VALUES(eventos)`,
    [alojamientoId, canal, url.slice(0, 1024), estado, error ? error.slice(0, 255) : null, eventos],
  );
}

/** Re-sincroniza un canal ya conectado. */
export async function sincronizarCanal(usuarioId: number, alojamientoId: number, canal: Canal): Promise<ResultadoSync> {
  if (!(await puedeGestionar(usuarioId, alojamientoId))) return { ok: false, estado: "error", motivo: "Ese alojamiento no es tuyo.", eventos: 0, fechas: 0 };
  const feed = await queryOne<{ url: string }>(`SELECT url FROM ical_feed WHERE alojamiento_id = ? AND canal = ? LIMIT 1`, [alojamientoId, canal]);
  if (!feed) return { ok: false, estado: "error", motivo: "Ese canal no está conectado.", eventos: 0, fechas: 0 };
  return conectarCanal(usuarioId, alojamientoId, canal, String(feed.url));
}

/** Desconecta el canal: quita sus noches importadas y olvida la URL. Nunca toca reservas. */
export async function desconectarCanal(usuarioId: number, alojamientoId: number, canal: Canal) {
  if (!(await puedeGestionar(usuarioId, alojamientoId))) return { ok: false as const, error: "Ese alojamiento no es tuyo." };
  const res = (await query(`DELETE FROM disponibilidad WHERE alojamiento_id = ? AND origen = ? AND reserva_id IS NULL`, [
    alojamientoId,
    canal,
  ])) as unknown as { affectedRows?: number };
  await query(`DELETE FROM ical_feed WHERE alojamiento_id = ? AND canal = ?`, [alojamientoId, canal]);
  return { ok: true as const, fechas: res?.affectedRows ?? 0 };
}

/* ------------------------------------------------------------------ consultas --- */

export type EstadoCanal = {
  canal: Canal;
  conectado: boolean;
  url: string | null;
  ultimaSync: string | null;
  estado: string | null;
  error: string | null;
  eventos: number | null;
  caducado: boolean;
  /** Nombre que le pone el anfitrión al calendario (por ejemplo «Airbnb piso centro»). */
  nombre: string | null;
  /** Sincronización activada o en pausa. `sincronizarSiCaduca` respeta este campo. */
  activo: boolean;
};

export async function listarCanales(usuarioId: number, alojamientoId: number) {
  if (!(await puedeGestionar(usuarioId, alojamientoId))) return null;
  await asegurarEsquemaCanales();
  const filas = await query<Record<string, unknown>>(
    `SELECT canal, url, ultima_sync, ultimo_estado, ultimo_error, eventos, nombre, activo FROM ical_feed WHERE alojamiento_id = ?`,
    [alojamientoId],
  );
  const porCanal = new Map(filas.map((f) => [String(f["canal"]), f]));
  const canales: EstadoCanal[] = CANALES.map((canal) => {
    const f = porCanal.get(canal);
    const ultima = f?.["ultima_sync"] ? String(f["ultima_sync"]) : null;
    const caducado = !ultima || Date.now() - new Date(ultima.replace(" ", "T")).getTime() > MINUTOS_CADUCIDAD * 60_000;
    return {
      canal,
      conectado: Boolean(f),
      url: f?.["url"] ? String(f["url"]) : null,
      ultimaSync: ultima,
      estado: f?.["ultimo_estado"] ? String(f["ultimo_estado"]) : null,
      error: f?.["ultimo_error"] ? String(f["ultimo_error"]) : null,
      eventos: f?.["eventos"] === null || f?.["eventos"] === undefined ? null : Number(f["eventos"]),
      caducado,
      nombre: f?.["nombre"] ? String(f["nombre"]) : null,
      // Sin fila no hay canal; con fila, `activo` manda (por defecto activo).
      activo: Boolean(f) && Number(f?.["activo"] ?? 1) === 1,
    };
  });
  return { canales };
}

/** Pausa o reanuda la sincronización de un calendario ya conectado. */
export async function activarCanal(
  usuarioId: number,
  alojamientoId: number,
  canal: Canal,
  activo: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await puedeGestionar(usuarioId, alojamientoId))) return { ok: false, error: "Ese alojamiento no es tuyo." };
  await asegurarEsquemaCanales();
  const res = (await query(`UPDATE ical_feed SET activo = ? WHERE alojamiento_id = ? AND canal = ?`, [
    activo ? 1 : 0,
    alojamientoId,
    canal,
  ])) as unknown as { affectedRows?: number };
  if (Number(res?.affectedRows ?? 0) === 0) return { ok: false, error: "Ese calendario no está conectado." };
  return { ok: true };
}

/** Pone o cambia el nombre con el que el anfitrión reconoce el calendario. */
export async function renombrarCanal(
  usuarioId: number,
  alojamientoId: number,
  canal: Canal,
  nombre: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await puedeGestionar(usuarioId, alojamientoId))) return { ok: false, error: "Ese alojamiento no es tuyo." };
  await asegurarEsquemaCanales();
  const limpio = nombre.trim().slice(0, 120);
  const res = (await query(`UPDATE ical_feed SET nombre = ? WHERE alojamiento_id = ? AND canal = ?`, [
    limpio || null,
    alojamientoId,
    canal,
  ])) as unknown as { affectedRows?: number };
  if (Number(res?.affectedRows ?? 0) === 0) return { ok: false, error: "Ese calendario no está conectado." };
  return { ok: true };
}

/** Noches del alojamiento con su origen, para pintar el calendario por colores. */
export async function nochesConOrigen(usuarioId: number, alojamientoId: number, desde: string, hasta: string) {
  if (!(await puedeGestionar(usuarioId, alojamientoId))) return null;
  const filas = await query<Record<string, unknown>>(
    `SELECT fecha, motivo, origen, reserva_id FROM disponibilidad
     WHERE alojamiento_id = ? AND fecha >= ? AND fecha <= ? ORDER BY fecha`,
    [alojamientoId, desde, hasta],
  );
  return filas.map((f) => ({
    fecha: String(f["fecha"]),
    motivo: String(f["motivo"]),
    origen: f["origen"] ? String(f["origen"]) : "manual",
    reservaId: f["reserva_id"] === null ? null : Number(f["reserva_id"]),
  }));
}

/* ------------------------------------------------------- sincronización auto --- */

/**
 * Sincroniza los canales de un alojamiento si han caducado (45 min). Se llama al abrir
 * el calendario, así no depende de que el anfitrión pulse «Actualizar» ni de un cron.
 * Un fallo NO bloquea el alojamiento: solo se anota en `ical_feed`.
 */
export async function sincronizarSiCaduca(usuarioId: number, alojamientoId: number) {
  if (!(await puedeGestionar(usuarioId, alojamientoId))) return { sincronizados: 0 };
  await asegurarEsquemaCanales();
  const feeds = await query<{ canal: string; url: string; ultima_sync: string | null }>(
    `SELECT canal, url, ultima_sync FROM ical_feed WHERE alojamiento_id = ? AND activo = 1`,
    [alojamientoId],
  );
  let sincronizados = 0;
  for (const f of feeds) {
    const caducado = !f.ultima_sync || Date.now() - new Date(String(f.ultima_sync).replace(" ", "T")).getTime() > MINUTOS_CADUCIDAD * 60_000;
    if (!caducado) continue;
    try {
      await conectarCanal(usuarioId, alojamientoId, f.canal as Canal, String(f.url));
      sincronizados += 1;
    } catch (error) {
      console.error("[hestiat] sincronizarSiCaduca", f.canal, error);
    }
  }
  return { sincronizados };
}

/** Sincroniza TODOS los canales caducados. Lo usa el endpoint del cron de cPanel. */
export async function sincronizarTodosLosCanales(): Promise<{ feeds: number; ok: number; error: number; fechas: number }> {
  await asegurarEsquemaCanales();
  const feeds = await query<{ alojamiento_id: number; canal: string; url: string }>(
    `SELECT alojamiento_id, canal, url FROM ical_feed
     WHERE activo = 1 AND (ultima_sync IS NULL OR ultima_sync < DATE_SUB(NOW(), INTERVAL ? MINUTE))`,
    [MINUTOS_CADUCIDAD],
  );
  let ok = 0;
  let error = 0;
  let fechas = 0;
  for (const f of feeds) {
    const url = String(f.url);
    const validacion = validarUrlIcs(url);
    if (!validacion.ok) {
      await guardarFeed(Number(f.alojamiento_id), f.canal as Canal, url, "invalid", validacion.motivo, 0);
      error += 1;
      continue;
    }
    const descarga = await descargarIcs(url);
    if (!descarga.ok) {
      await guardarFeed(Number(f.alojamiento_id), f.canal as Canal, url, descarga.tipo, descarga.motivo, 0);
      error += 1;
      continue;
    }
    try {
      const eventos = parsearIcs(descarga.texto);
      const r = await importarEventos(Number(f.alojamiento_id), f.canal as Canal, eventos);
      await guardarFeed(Number(f.alojamiento_id), f.canal as Canal, url, "ok", null, r.eventos);
      fechas += r.fechas;
      ok += 1;
    } catch (err) {
      console.error("[hestiat] sincronizarTodosLosCanales", err);
      await guardarFeed(Number(f.alojamiento_id), f.canal as Canal, url, "error", "Fallo al guardar los eventos.", 0);
      error += 1;
    }
  }
  return { feeds: feeds.length, ok, error, fechas };
}

/** Cuántos bloqueos hay por origen (para el resumen del anfitrión y del backoffice). */
export async function resumenCanales(usuarioId: number) {
  const filas = await query<{ alojamiento_id: number; canal: string; ultimo_estado: string | null; ultima_sync: string | null }>(
    `SELECT f.alojamiento_id, f.canal, f.ultimo_estado, f.ultima_sync
     FROM ical_feed f JOIN alojamiento_anfitrion aa ON aa.alojamiento_id = f.alojamiento_id
     WHERE aa.usuario_id = ?`,
    [usuarioId],
  );
  return filas.map((f) => ({
    alojamientoId: Number(f.alojamiento_id),
    canal: String(f.canal),
    estado: f.ultimo_estado ? String(f.ultimo_estado) : null,
    ultimaSync: f.ultima_sync ? String(f.ultima_sync) : null,
  }));
}
