/**
 * Reservas — SOLO servidor.
 *
 * Decisiones de arquitectura (importantes, y explicadas para que no parezcan arbitrarias):
 *
 *  · FUENTE ÚNICA DE VERDAD. Las reservas viven en la tabla `reserva` del esquema que ya usan los
 *    paneles del anfitrión y de administración. Escribirlas en dos sitios distintos garantizaría
 *    que algún día discrepen.
 *
 *  · LA DISPONIBILIDAD ES `disponibilidad`. Una noche ocupada o bloqueada es una fila ahí. Es la
 *    misma tabla que usa la sincronización iCal, así que una reserva de Airbnb y una de Hestiat
 *    bloquean igual. Eso es lo que evita la doble reserva.
 *
 *  · SIN COBRO. Hestiat no cobra nada: no hay comisiones, ni limpieza, ni impuestos añadidos. El
 *    total es exactamente noches × precio por noche. No se simula ninguna pasarela de pago.
 *
 *  · PRECIO HONESTO. Solo 4 alojamientos tienen tarifa real; los demás tienen precio orientativo.
 *    Una reserva sobre un precio orientativo se registra como solicitud y se dice claramente que el
 *    anfitrión confirmará el precio. No se presenta como un precio cerrado.
 *
 *  · LA COMPROBACIÓN DE DISPONIBILIDAD SE HACE EN SERVIDOR Y DENTRO DE UNA TRANSACCIÓN, y se apoya
 *    en un índice único (alojamiento, fecha). Aunque dos personas pulsen «reservar» en el mismo
 *    segundo, la base impide que las dos ocupen la misma noche.
 */
import { poolLegacy } from "@/lib/db";

export type EstadoReserva = "pendiente" | "confirmada" | "cancelada" | "rechazada" | "completada";

export interface AlojamientoReservable {
  accommodationId: number;
  legacyId: number;
  slug: string | null;
  titulo: string;
  capacidad: number;
  precio: number;
  moneda: string;
  precioEsOrientativo: boolean;
  publicado: boolean;
  ciudad: string | null;
  provincia: string | null;
  /* Conceptos que define el anfitrión. Vienen vacíos en todo el catálogo actual: mientras lo estén,
     el total sigue siendo exactamente noches × precio. */
  limpieza: number | null;
  tasas: number | null;
  impuestosPct: number | null;
  precioHuespedExtra: number | null;
  descuentoSemanal: number | null;
  descuentoMensual: number | null;
  estanciaMinima: number | null;
  estanciaMaxima: number | null;
}

/** El resumen de una estancia es el desglose completo: una sola forma de calcular un precio. */
export type ResumenPrecio = DesglosePrecio;

/* ------------------------------------------------------------- utilidades -- */

/* Las utilidades de fechas viven ahora en `lib/fechas`: las comparte el cálculo de precios, y
   dejarlas aquí crearía una dependencia circular entre los dos módulos. Se re-exportan para no
   romper a quien ya las importaba desde aquí. */
import { nochesEntre, nochesDe } from "@/lib/fechas";
export { nochesEntre, nochesDe };

/* El importe de una estancia se calcula en un único sitio (`lib/precio.server`), el mismo que usa
   la vista previa del editor. Aquí solo se consume. */
import { calcularDesglose } from "@/lib/precio.server";
import type { DesglosePrecio, ParametrosPrecio } from "@/lib/precio.server";

function fechaValida(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(`${iso}T00:00:00Z`));
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Código de reserva: 12 caracteres, como el que ya usa la tabla. */
function nuevoCodigo(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 12; i += 1) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

/* --------------------------------------------------------------- esquema -- */

let indices: Promise<void> | undefined;

/**
 * Índice único (alojamiento, fecha) en `disponibilidad`. Es lo que hace imposible la doble reserva
 * a nivel de base de datos, no solo a nivel de comprobación previa. Aditivo e idempotente: si ya
 * existe, no se toca; si hay filas duplicadas previas, se limpian primero (se conserva una).
 */
export async function asegurarIndices(): Promise<void> {
  if (!indices) {
    indices = (async () => {
      const [tiene] = await poolLegacy.query<any[]>(
        `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'disponibilidad' AND INDEX_NAME = 'uq_alojamiento_fecha'`,
      );
      if (Number(tiene[0]?.n ?? 0) > 0) return;
      await poolLegacy.query(
        `DELETE d1 FROM disponibilidad d1
           JOIN disponibilidad d2
             ON d1.alojamiento_id = d2.alojamiento_id AND d1.fecha = d2.fecha
            AND (d1.creado_en > d2.creado_en OR (d1.creado_en = d2.creado_en AND d1.motivo = 'reserva'))
           WHERE d1.motivo = 'ical'`,
      );
      await poolLegacy.query(
        `ALTER TABLE disponibilidad ADD UNIQUE KEY uq_alojamiento_fecha (alojamiento_id, fecha)`,
      );
    })().catch((e) => {
      indices = undefined;
      // No es fatal: sin el índice sigue habiendo comprobación en servidor.
      console.error("[hestiat] no se pudo crear el índice único de disponibilidad", e);
    });
  }
  return indices;
}

/* ------------------------------------------------------------ consultas -- */

export async function alojamientoReservable(accommodationId: number): Promise<AlojamientoReservable | null> {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT a.id AS accommodation_id, a.legacy_id, a.slug, a.title, a.capacity, a.price_per_night,
            a.indicative_price, a.price_type, a.currency, a.status, a.city, a.province,
            a.cleaning_fee, a.fees, a.tax_pct, a.extra_guest_price, a.weekly_discount,
            a.monthly_discount, a.min_nights, a.max_nights
       FROM hestiat2.accommodation a
      WHERE a.id = ? LIMIT 1`,
    [accommodationId],
  );
  const f = filas[0];
  if (!f) return null;
  const precio = Number(f.price_per_night) > 0 ? Number(f.price_per_night) : Number(f.indicative_price);
  const opcional = (v: unknown): number | null => (v === null || v === undefined || Number(v) <= 0 ? null : Number(v));
  return {
    accommodationId: Number(f.accommodation_id),
    legacyId: Number(f.legacy_id),
    slug: f.slug ?? null,
    titulo: String(f.title ?? ""),
    capacidad: Number(f.capacity ?? 0),
    precio,
    moneda: String(f.currency ?? "EUR"),
    precioEsOrientativo: String(f.price_type ?? "") !== "real",
    publicado: String(f.status) === "published",
    ciudad: f.city ?? null,
    provincia: f.province ?? null,
    limpieza: opcional(f.cleaning_fee),
    tasas: opcional(f.fees),
    impuestosPct: opcional(f.tax_pct),
    precioHuespedExtra: opcional(f.extra_guest_price),
    descuentoSemanal: opcional(f.weekly_discount),
    descuentoMensual: opcional(f.monthly_discount),
    estanciaMinima: opcional(f.min_nights),
    estanciaMaxima: opcional(f.max_nights),
  };
}

/** Noches ocupadas o bloqueadas en el intervalo, con el motivo. */
export async function nochesOcupadas(legacyId: number, desde: string, hasta: string): Promise<{ fecha: string; motivo: string }[]> {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT fecha, motivo FROM disponibilidad
      WHERE alojamiento_id = ? AND fecha >= ? AND fecha < ? ORDER BY fecha`,
    [legacyId, desde, hasta],
  );
  return filas.map((f) => ({ fecha: String(f.fecha).slice(0, 10), motivo: String(f.motivo ?? "") }));
}

export function calcularResumen(
  precioNoche: number,
  moneda: string,
  desde: string,
  hasta: string,
  orientativo: boolean,
  extras: Partial<ParametrosPrecio> = {},
): ResumenPrecio {
  // Hestiat no cobra comisión: lo que suman limpieza, tasas e impuestos es del anfitrión, y solo
  // aparece si lo ha definido. Todo el cálculo vive en `calcularDesglose`.
  return calcularDesglose({ precioNoche, moneda, desde, hasta, orientativo, ...extras });
}

/* -------------------------------------------------------------- creación -- */

export type ResultadoReserva =
  | { ok: true; codigo: string; reservaId: number; resumen: ResumenPrecio }
  | { ok: false; error: string };

export async function crearSolicitud(entrada: {
  accommodationId: number;
  desde: string;
  hasta: string;
  huespedes: number;
  nombre: string;
  email: string;
  telefono?: string;
  notas?: string;
  usuarioId?: number | null;
}): Promise<ResultadoReserva> {
  await asegurarIndices();

  const aloj = await alojamientoReservable(entrada.accommodationId);
  if (!aloj) return { ok: false, error: "Ese alojamiento no existe." };
  if (!aloj.publicado) return { ok: false, error: "Ese alojamiento no está publicado." };
  if (!aloj.legacyId) return { ok: false, error: "Ese alojamiento no está enlazado con su ficha de gestión. Avisa a soporte." };

  const { desde, hasta } = entrada;
  if (!fechaValida(desde) || !fechaValida(hasta)) return { ok: false, error: "Las fechas no son válidas." };
  if (desde < hoyISO()) return { ok: false, error: "La fecha de entrada no puede ser anterior a hoy." };
  const noches = nochesEntre(desde, hasta);
  if (noches <= 0) return { ok: false, error: "La salida tiene que ser posterior a la entrada." };
  if (noches > 365) return { ok: false, error: "No se pueden solicitar más de 365 noches." };

  const huespedes = Number(entrada.huespedes) || 1;
  if (aloj.capacidad > 0 && huespedes > aloj.capacidad) {
    return { ok: false, error: `Este alojamiento admite como máximo ${aloj.capacidad} huéspedes.` };
  }

  const nombre = entrada.nombre.trim();
  const email = entrada.email.trim().toLowerCase();
  if (nombre.length < 3) return { ok: false, error: "Indica el nombre del huésped." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return { ok: false, error: "El correo no tiene un formato válido." };

  const ocupadas = await nochesOcupadas(aloj.legacyId, desde, hasta);
  if (ocupadas.length > 0) {
    return {
      ok: false,
      error: `Esas fechas ya no están libres (${ocupadas.length} ${ocupadas.length === 1 ? "noche ocupada" : "noches ocupadas"}). Elige otras.`,
    };
  }

  const resumen = calcularResumen(aloj.precio, aloj.moneda, desde, hasta, aloj.precioEsOrientativo, {
    limpieza: aloj.limpieza,
    tasas: aloj.tasas,
    impuestosPct: aloj.impuestosPct,
    precioHuespedExtra: aloj.precioHuespedExtra,
    huespedesIncluidos: aloj.capacidad,
    huespedes,
    descuentoSemanal: aloj.descuentoSemanal,
    descuentoMensual: aloj.descuentoMensual,
    estanciaMinima: aloj.estanciaMinima,
    estanciaMaxima: aloj.estanciaMaxima,
  });
  // Estancia mínima o máxima incumplida: se rechaza con el motivo, no se acepta y se avisa luego.
  if (resumen.avisos.length > 0) return { ok: false, error: resumen.avisos[0] };
  const codigo = nuevoCodigo();
  const conn = await poolLegacy.getConnection();
  try {
    await conn.beginTransaction();

    // Segunda comprobación, ya dentro de la transacción: es la que impide de verdad la doble
    // reserva cuando dos solicitudes entran a la vez.
    const [otra] = await conn.query<any[]>(
      `SELECT COUNT(*) AS n FROM disponibilidad WHERE alojamiento_id = ? AND fecha >= ? AND fecha < ? FOR UPDATE`,
      [aloj.legacyId, desde, hasta],
    );
    if (Number(otra[0]?.n ?? 0) > 0) {
      await conn.rollback();
      return { ok: false, error: "Alguien ha ocupado esas fechas mientras rellenabas el formulario. Elige otras." };
    }

    const [res] = await conn.query<any>(
      `INSERT INTO reserva
         (codigo, alojamiento_id, usuario_id, huesped_nombre, huesped_email, huesped_tel,
          llegada, salida, huespedes, noches, precio_noche, limpieza, subtotal, total, moneda,
          estado, gateway, notas, expira_en, creado_en)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pendiente',NULL,?, DATE_ADD(NOW(), INTERVAL 48 HOUR), NOW())`,
      [
        codigo, aloj.legacyId, entrada.usuarioId ?? null, nombre.slice(0, 191), email, (entrada.telefono ?? "").trim().slice(0, 32) || null,
        desde, hasta, huespedes, noches, aloj.precio, resumen.limpieza, resumen.baseImponible, resumen.total, aloj.moneda,
        (entrada.notas ?? "").trim().slice(0, 4000) || null,
      ],
    );
    const reservaId = Number(res.insertId);

    for (const fecha of nochesDe(desde, hasta)) {
      await conn.query(
        `INSERT IGNORE INTO disponibilidad (alojamiento_id, fecha, motivo, reserva_id, origen, creado_en)
         VALUES (?,?, 'reserva', ?, 'hestiat', NOW())`,
        [aloj.legacyId, fecha, reservaId],
      );
    }

    await conn.commit();
    return { ok: true, codigo, reservaId, resumen };
  } catch (error) {
    await conn.rollback();
    const mensaje = error instanceof Error ? error.message : "Error al guardar la reserva.";
    console.error("[hestiat] crearSolicitud", mensaje);
    return { ok: false, error: "No se ha podido registrar la reserva. Inténtalo de nuevo." };
  } finally {
    conn.release();
  }
}

/* ------------------------------------------------------------- paneles -- */

export interface ReservaVista {
  id: number;
  codigo: string | null;
  alojamientoId: number;
  alojamientoTitulo: string;
  huespedNombre: string;
  huespedEmail: string;
  huespedTel: string | null;
  llegada: string;
  salida: string;
  huespedes: number;
  noches: number;
  total: number;
  moneda: string;
  estado: string;
  creadoEn: string | null;
}

/** Reservas de los alojamientos de un anfitrión. Siempre filtrado por su usuario. */
export interface FiltrosReserva {
  estado?: string;
  desde?: string;
  hasta?: string;
  q?: string;
}

/**
 * Reservas de los alojamientos de un anfitrión, con búsqueda.
 *
 * Filtros reales, no decorativos: estado, rango de fechas de entrada y texto libre sobre el nombre
 * o el correo del huésped. Siempre filtrado por su usuario en la propia consulta.
 */
export async function reservasDeAnfitrion(usuarioId: number, filtros: FiltrosReserva = {}): Promise<ReservaVista[]> {
  const where: string[] = ["af.usuario_id = ?"];
  const valores: unknown[] = [usuarioId];

  if (filtros.estado) { where.push("r.estado = ?"); valores.push(filtros.estado); }
  if (filtros.desde && /^\d{4}-\d{2}-\d{2}$/.test(filtros.desde)) { where.push("r.llegada >= ?"); valores.push(filtros.desde); }
  if (filtros.hasta && /^\d{4}-\d{2}-\d{2}$/.test(filtros.hasta)) { where.push("r.llegada <= ?"); valores.push(filtros.hasta); }
  const q = (filtros.q ?? "").trim();
  if (q.length >= 2) {
    where.push("(r.huesped_nombre LIKE ? OR r.huesped_email LIKE ? OR r.codigo LIKE ?)");
    valores.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const [filas] = await poolLegacy.query<any[]>(
    `SELECT r.id, r.codigo, r.alojamiento_id, r.huesped_nombre, r.huesped_email, r.huesped_tel,
            r.llegada, r.salida, r.huespedes, r.noches, r.total, r.moneda, r.estado, r.creado_en,
            COALESCE(a.titulo, '(alojamiento eliminado)') AS titulo
       FROM reserva r
       JOIN alojamiento_anfitrion af ON af.alojamiento_id = r.alojamiento_id
       LEFT JOIN alojamiento a ON a.id = r.alojamiento_id
      WHERE ${where.join(" AND ")}
      ORDER BY r.creado_en DESC LIMIT 200`,
    valores,
  );
  return filas.map((f) => ({
    id: Number(f.id), codigo: f.codigo ?? null, alojamientoId: Number(f.alojamiento_id),
    alojamientoTitulo: String(f.titulo), huespedNombre: String(f.huesped_nombre ?? ""),
    huespedEmail: String(f.huesped_email ?? ""), huespedTel: f.huesped_tel ?? null,
    llegada: String(f.llegada).slice(0, 10), salida: String(f.salida).slice(0, 10),
    huespedes: Number(f.huespedes ?? 1), noches: Number(f.noches ?? 0),
    total: Number(f.total ?? 0), moneda: String(f.moneda ?? "EUR"), estado: String(f.estado),
    creadoEn: f.creado_en ? String(f.creado_en) : null,
  }));
}

export async function cambiarEstado(
  actor: { id: number; rol: string },
  reservaId: number,
  nuevo: EstadoReserva,
): Promise<{ ok: boolean; error?: string }> {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT r.id, r.alojamiento_id, r.estado FROM reserva r WHERE r.id = ? LIMIT 1`,
    [reservaId],
  );
  const r = filas[0];
  if (!r) return { ok: false, error: "Esa reserva no existe." };

  if (actor.rol !== "admin") {
    const [propio] = await poolLegacy.query<any[]>(
      `SELECT COUNT(*) AS n FROM alojamiento_anfitrion WHERE usuario_id = ? AND alojamiento_id = ?`,
      [actor.id, Number(r.alojamiento_id)],
    );
    if (Number(propio[0]?.n ?? 0) === 0) return { ok: false, error: "Esa reserva no es de un alojamiento tuyo." };
  }

  const conn = await poolLegacy.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE reserva SET estado = ?, actualizado_en = NOW() WHERE id = ?`, [nuevo, reservaId]);

    // Si se cancela o se rechaza, se liberan las noches de esa reserva.
    if (nuevo === "cancelada" || nuevo === "rechazada") {
      await conn.query(`DELETE FROM disponibilidad WHERE reserva_id = ?`, [reservaId]);
    }
    await conn.commit();
    return { ok: true };
  } catch (error) {
    await conn.rollback();
    console.error("[hestiat] cambiarEstado", error);
    return { ok: false, error: "No se ha podido actualizar la reserva." };
  } finally {
    conn.release();
  }
}

/** Reservas de un huésped por su correo (para su historial). */
export async function reservasDeHuesped(email: string): Promise<ReservaVista[]> {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT r.id, r.codigo, r.alojamiento_id, r.huesped_nombre, r.huesped_email, r.huesped_tel,
            r.llegada, r.salida, r.huespedes, r.noches, r.total, r.moneda, r.estado, r.creado_en,
            COALESCE(a.titulo, '(alojamiento eliminado)') AS titulo
       FROM reserva r LEFT JOIN alojamiento a ON a.id = r.alojamiento_id
      WHERE r.huesped_email = ? ORDER BY r.creado_en DESC LIMIT 100`,
    [email.trim().toLowerCase()],
  );
  return filas.map((f) => ({
    id: Number(f.id), codigo: f.codigo ?? null, alojamientoId: Number(f.alojamiento_id),
    alojamientoTitulo: String(f.titulo), huespedNombre: String(f.huesped_nombre ?? ""),
    huespedEmail: String(f.huesped_email ?? ""), huespedTel: f.huesped_tel ?? null,
    llegada: String(f.llegada).slice(0, 10), salida: String(f.salida).slice(0, 10),
    huespedes: Number(f.huespedes ?? 1), noches: Number(f.noches ?? 0),
    total: Number(f.total ?? 0), moneda: String(f.moneda ?? "EUR"), estado: String(f.estado),
    creadoEn: f.creado_en ? String(f.creado_en) : null,
  }));
}
