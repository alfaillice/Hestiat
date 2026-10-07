/**
 * Reclamación de propiedad — SOLO servidor.
 *
 * Plan A: los alojamientos sin anfitrión quedan MARCADOS (tabla `hestiat_incidencia`) y se abre un
 * flujo para que cada propietario real reclame el suyo. La titularidad no se inventa nunca: se
 * concede cuando una persona la reclama y administración lo aprueba.
 *
 * Todo es aditivo: la tabla `reclama_propiedad` se crea si falta y no se modifica ninguna fila
 * existente. Aprobar una reclamación añade un vínculo en `alojamiento_anfitrion` (que es lo que ya
 * usa el panel del anfitrión) y retira el marcado de ese alojamiento en concreto.
 */
import { poolLegacy } from "@/lib/db";

let esquema: Promise<void> | undefined;

export async function asegurarEsquemaReclama(): Promise<void> {
  if (!esquema) {
    esquema = (async () => {
      await poolLegacy.query(
        `CREATE TABLE IF NOT EXISTS reclama_propiedad (
           id INT UNSIGNED NOT NULL AUTO_INCREMENT,
           alojamiento_id INT NOT NULL,
           email VARCHAR(254) NOT NULL,
           nombre VARCHAR(160) NOT NULL,
           telefono VARCHAR(40) NULL,
           mensaje TEXT NULL,
           estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
           resuelto_por INT NULL,
           creado_en DATETIME NOT NULL,
           resuelto_en DATETIME NULL,
           PRIMARY KEY (id),
           KEY idx_estado (estado),
           KEY idx_alojamiento (alojamiento_id),
           KEY idx_email (email)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );
    })().catch((e) => {
      esquema = undefined;
      throw e;
    });
  }
  return esquema;
}

export interface Reclama {
  id: number;
  alojamiento_id: number;
  email: string;
  nombre: string;
  telefono: string | null;
  mensaje: string | null;
  estado: string;
  creado_en: string;
}

export async function crearReclama(entrada: {
  alojamientoId: number;
  email: string;
  nombre: string;
  telefono?: string;
  mensaje?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await asegurarEsquemaReclama();

  const email = entrada.email.trim().toLowerCase();
  const nombre = entrada.nombre.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return { ok: false, error: "El correo no tiene un formato válido." };
  if (nombre.length < 3) return { ok: false, error: "Indica tu nombre." };

  const [aloj] = await poolLegacy.query<any[]>(`SELECT id FROM alojamiento WHERE id = ? LIMIT 1`, [entrada.alojamientoId]);
  if (!aloj[0]) return { ok: false, error: "Ese alojamiento no existe." };

  // Límite sencillo contra abuso: no se aceptan más de 5 reclamaciones pendientes por correo.
  const [previas] = await poolLegacy.query<any[]>(
    `SELECT COUNT(*) AS n FROM reclama_propiedad WHERE email = ? AND estado = 'pendiente'`,
    [email],
  );
  if (Number(previas[0]?.n ?? 0) >= 5) {
    return { ok: false, error: "Ya tienes varias solicitudes pendientes. Espera a que las revisemos." };
  }

  // Si ya la tiene asignada, no tiene sentido reclamarla.
  const [ya] = await poolLegacy.query<any[]>(
    `SELECT COUNT(*) AS n FROM alojamiento_anfitrion WHERE alojamiento_id = ?`,
    [entrada.alojamientoId],
  );
  if (Number(ya[0]?.n ?? 0) > 0) return { ok: false, error: "Ese alojamiento ya tiene propietario asignado." };

  await poolLegacy.query(
    `INSERT INTO reclama_propiedad (alojamiento_id, email, nombre, telefono, mensaje, estado, creado_en)
     VALUES (?,?,?,?,?, 'pendiente', NOW())`,
    [
      entrada.alojamientoId,
      email,
      nombre.slice(0, 160),
      (entrada.telefono ?? "").trim().slice(0, 40) || null,
      (entrada.mensaje ?? "").trim().slice(0, 4000) || null,
    ],
  );
  return { ok: true };
}

export async function listarReclamas(estado = "pendiente", limite = 200): Promise<Reclama[]> {
  await asegurarEsquemaReclama();
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT r.id, r.alojamiento_id, r.email, r.nombre, r.telefono, r.mensaje, r.estado, r.creado_en,
            a.titulo, a.ciudad, a.provincia
       FROM reclama_propiedad r
       LEFT JOIN alojamiento a ON a.id = r.alojamiento_id
      WHERE r.estado = ? ORDER BY r.id DESC LIMIT ?`,
    [estado, limite],
  );
  return filas as Reclama[];
}

export async function contarReclamas(): Promise<number> {
  await asegurarEsquemaReclama();
  const [f] = await poolLegacy.query<any[]>(
    `SELECT COUNT(*) AS n FROM reclama_propiedad WHERE estado = 'pendiente'`,
  );
  return Number(f[0]?.n ?? 0);
}

/**
 * Aprueba una reclamación: vincula el alojamiento al usuario de esa cuenta (por correo) y retira
 * su marca de huérfano. Si no existe cuenta con ese correo, no se inventa: se avisa.
 */
export async function aprobarReclama(reclamaId: number, adminId: number): Promise<{ ok: boolean; mensaje: string }> {
  await asegurarEsquemaReclama();
  const [r] = await poolLegacy.query<any[]>(
    `SELECT id, alojamiento_id, email FROM reclama_propiedad WHERE id = ? AND estado = 'pendiente' LIMIT 1`,
    [reclamaId],
  );
  const rec = r[0];
  if (!rec) return { ok: false, mensaje: "Esa reclamación ya no está pendiente." };

  const [u] = await poolLegacy.query<any[]>(`SELECT id FROM usuario WHERE email = ? LIMIT 1`, [String(rec.email)]);
  if (!u[0]) {
    return {
      ok: false,
      mensaje: `No hay ninguna cuenta con el correo ${rec.email}. Pídele que se registre primero y vuelve a aprobarla.`,
    };
  }

  await poolLegacy.query(
    `INSERT IGNORE INTO alojamiento_anfitrion (alojamiento_id, usuario_id) VALUES (?,?)`,
    [Number(rec.alojamiento_id), Number(u[0].id)],
  );
  await poolLegacy.query(
    `UPDATE reclama_propiedad SET estado = 'aprobada', resuelto_por = ?, resuelto_en = NOW() WHERE id = ?`,
    [adminId, reclamaId],
  );
  // Retira el marcado de huérfano SOLO de este alojamiento.
  await poolLegacy.query(
    `DELETE FROM hestiat_incidencia WHERE clase = 'sin_anfitrion' AND referencia = ?`,
    [String(rec.alojamiento_id)],
  );
  return { ok: true, mensaje: `Vinculado a la cuenta ${rec.email}.` };
}

export async function rechazarReclama(reclamaId: number, adminId: number): Promise<void> {
  await asegurarEsquemaReclama();
  await poolLegacy.query(
    `UPDATE reclama_propiedad SET estado = 'rechazada', resuelto_por = ?, resuelto_en = NOW()
      WHERE id = ? AND estado = 'pendiente'`,
    [adminId, reclamaId],
  );
}
