/**
 * Calendario del anfitrión — SOLO servidor.
 *
 * La disponibilidad es `disponibilidad` (esquema antiguo): una fila es una noche NO disponible.
 * Es la misma tabla que usa la sincronización iCal y la creación de reservas, así que todo habla
 * del mismo sitio. Eso es lo que evita conflictos.
 *
 * Reglas que no se negocian:
 *  · Propiedad: TODO pasa por `alojamiento_anfitrion`. Un anfitrión solo puede tocar SUS noches.
 *  · Una noche con reserva NO se puede liberar desde el calendario. Si se liberara, la reserva
 *    seguiría existiendo y esa noche quedaría vendida dos veces. Para liberarla hay que cancelar
 *    la reserva, que es la acción correcta y además deja rastro.
 *  · Una noche que ya está ocupada no se vuelve a bloquear (ni al contrario): las operaciones son
 *    idempotentes y no duplican filas.
 */
import { poolLegacy } from "@/lib/db";

export type EstadoNoche = "libre" | "reservada" | "bloqueada" | "ical" | "mantenimiento";

export interface Noche {
  fecha: string;
  estado: EstadoNoche;
  reservaId: number | null;
}

/** Comprueba propiedad. Devuelve el id interno del alojamiento o null. */
/**
 * ¿Puede este usuario gestionar la disponibilidad de ese alojamiento?
 *
 * Devuelve el id si es el anfitrión dueño **o un administrador**. El editor de alojamiento es el
 * mismo para los dos roles, así que la guarda tiene que admitir a los dos; si solo admitiera al
 * dueño, un administrador no podría bloquear noches desde el editor compartido.
 */
export async function alojamientoProtegido(usuarioId: number, alojamientoId: number): Promise<number | null> {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT a.id FROM alojamiento a
       JOIN alojamiento_anfitrion af ON af.alojamiento_id = a.id
      WHERE a.id = ? AND af.usuario_id = ? LIMIT 1`,
    [alojamientoId, usuarioId],
  );
  if (filas[0]) return Number(filas[0].id);

  const [admins] = await poolLegacy.query<any[]>(
    `SELECT rol FROM usuario WHERE id = ? AND activo = 1 AND bloqueado_en IS NULL LIMIT 1`,
    [usuarioId],
  );
  if (String(admins[0]?.rol ?? "") === "admin") {
    const [existe] = await poolLegacy.query<any[]>(`SELECT id FROM alojamiento WHERE id = ? LIMIT 1`, [alojamientoId]);
    return existe[0] ? Number(existe[0].id) : null;
  }
  return null;
}

/** Alojamientos del anfitrión, para el selector del calendario. */
export async function misAlojamientos(usuarioId: number) {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT a.id, a.titulo, a.ciudad, a.provincia, a.activo
       FROM alojamiento a
       JOIN alojamiento_anfitrion af ON af.alojamiento_id = a.id
      WHERE af.usuario_id = ? ORDER BY a.titulo`,
    [usuarioId],
  );
  return filas.map((f) => ({ id: Number(f.id), titulo: String(f.titulo), ciudad: f.ciudad ?? null, provincia: f.provincia ?? null, activo: Number(f.activo) }));
}

function primerDia(mes: string): string {
  return `${mes}-01`;
}
function primerDiaSiguiente(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m, 1));
  return d.toISOString().slice(0, 10);
}

/** Noches de un mes con su estado real. */
export async function nochesDelMes(alojamientoId: number, mes: string): Promise<Noche[]> {
  const desde = primerDia(mes);
  const hasta = primerDiaSiguiente(mes);
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT fecha, motivo, reserva_id FROM disponibilidad
      WHERE alojamiento_id = ? AND fecha >= ? AND fecha < ?`,
    [alojamientoId, desde, hasta],
  );
  const porFecha = new Map<string, { motivo: string; reservaId: number | null }>();
  for (const f of filas) {
    porFecha.set(String(f.fecha).slice(0, 10), {
      motivo: String(f.motivo ?? ""),
      reservaId: f.reserva_id === null ? null : Number(f.reserva_id),
    });
  }

  const noches: Noche[] = [];
  const fin = new Date(`${hasta}T00:00:00Z`);
  for (let d = new Date(`${desde}T00:00:00Z`); d < fin; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const info = porFecha.get(iso);
    let estado: EstadoNoche = "libre";
    if (info) {
      if (info.reservaId !== null || info.motivo === "reserva") estado = "reservada";
      else if (info.motivo === "ical") estado = "ical";
      else if (info.motivo === "mantenimiento") estado = "mantenimiento";
      else estado = "bloqueada";
    }
    noches.push({ fecha: iso, estado, reservaId: info?.reservaId ?? null });
  }
  return noches;
}

export function fechasValidas(fechas: unknown): string[] {
  if (!Array.isArray(fechas)) return [];
  return fechas
    .map((f) => String(f))
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
    .slice(0, 366);
}

/* ------------------------------------------------------------- acciones -- */

export type ResultadoCalendario = { ok: boolean; hechas: number; omitidas: number; error?: string };

/** Bloquea noches. No toca las que ya están ocupadas por una reserva ni las de un canal. */
export async function bloquear(usuarioId: number, alojamientoId: number, fechas: string[]): Promise<ResultadoCalendario> {
  const propio = await alojamientoProtegido(usuarioId, alojamientoId);
  if (!propio) return { ok: false, hechas: 0, omitidas: 0, error: "Ese alojamiento no es tuyo." };
  if (fechas.length === 0) return { ok: false, hechas: 0, omitidas: 0, error: "No has seleccionado ninguna noche." };

  let hechas = 0;
  let omitidas = 0;
  for (const fecha of fechas) {
    const [ya] = await poolLegacy.query<any[]>(
      `SELECT motivo, reserva_id FROM disponibilidad WHERE alojamiento_id = ? AND fecha = ? LIMIT 1`,
      [propio, fecha],
    );
    const fila = ya[0];
    if (fila) {
      // Ya está ocupada o bloqueada: no se duplica ni se pisa una reserva.
      omitidas += 1;
      continue;
    }
    await poolLegacy.query(
      `INSERT IGNORE INTO disponibilidad (alojamiento_id, fecha, motivo, reserva_id, origen, creado_en)
       VALUES (?,?, 'bloqueo', NULL, 'anfitrion', NOW())`,
      [propio, fecha],
    );
    hechas += 1;
  }
  return { ok: true, hechas, omitidas };
}

/** Libera noches bloqueadas. NUNCA libera una noche con reserva. */
export async function liberar(usuarioId: number, alojamientoId: number, fechas: string[]): Promise<ResultadoCalendario> {
  const propio = await alojamientoProtegido(usuarioId, alojamientoId);
  if (!propio) return { ok: false, hechas: 0, omitidas: 0, error: "Ese alojamiento no es tuyo." };
  if (fechas.length === 0) return { ok: false, hechas: 0, omitidas: 0, error: "No has seleccionado ninguna noche." };

  let hechas = 0;
  let omitidas = 0;
  for (const fecha of fechas) {
    const [fila] = await poolLegacy.query<any[]>(
      `SELECT motivo, reserva_id FROM disponibilidad WHERE alojamiento_id = ? AND fecha = ? LIMIT 1`,
      [propio, fecha],
    );
    const actual = fila[0];
    if (!actual) { omitidas += 1; continue; }
    if (actual.reserva_id !== null || actual.motivo === "reserva") { omitidas += 1; continue; } // protegida
    // Los bloqueos del canal iCal no se liberan a mano: volverían a entrar en la siguiente
    // sincronización y el anfitrión creería que no funciona.
    if (actual.motivo === "ical") { omitidas += 1; continue; }
    await poolLegacy.query(
      `DELETE FROM disponibilidad WHERE alojamiento_id = ? AND fecha = ? AND reserva_id IS NULL AND motivo IN ('bloqueo','mantenimiento')`,
      [propio, fecha],
    );
    hechas += 1;
  }
  return { ok: true, hechas, omitidas };
}
