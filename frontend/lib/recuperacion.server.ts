import { randomBytes } from "node:crypto";
import { poolLegacy } from "@/lib/db";
import { hashPassword } from "@/lib/auth.server";

/**
 * RECUPERACIÓN DE ACCESO.
 *
 * Cómo funciona, en corto:
 *  1. Se pide un enlace con el correo. Se apunta un testigo **de un solo uso** y se envía por correo.
 *  2. Al abrir el enlace, se comprueba el testigo y se deja poner una contraseña nueva.
 *  3. Al guardarla, el testigo queda gastado y se cierran las sesiones abiertas de esa cuenta.
 *
 * Decisiones que importan:
 *  · **En la base no se guarda el testigo, sino su huella** (SHA-256). Si alguien leyera la tabla no
 *    podría usarlo para entrar. El testigo en claro solo existe en el correo.
 *  · **La respuesta es siempre la misma**, exista o no la cuenta: así no se puede averiguar qué
 *    correos están registrados probando el formulario.
 *  · **Caduca en una hora** y se invalida al usarlo, para que un enlace viejo no sirva.
 *  · La contraseña se guarda con el **mismo** algoritmo que el resto (`hashPassword`): no hay una
 *    segunda forma de guardar contraseñas en el proyecto.
 */

export {
  MINUTOS_VALIDEZ,
  LARGO_MINIMO_PASSWORD,
  MAX_SOLICITUDES_POR_HORA,
  huellaDelToken,
  tokenPlausible,
  revisarPasswordNueva,
} from "@/lib/recuperacion-reglas";
import { huellaDelToken, MINUTOS_VALIDEZ, tokenPlausible } from "@/lib/recuperacion-reglas";

let tablaLista: Promise<void> | null = null;

async function crearTabla(): Promise<void> {
  await poolLegacy.query(
    `CREATE TABLE IF NOT EXISTS recuperacion_acceso (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       usuario_id BIGINT UNSIGNED NOT NULL,
       token_hash CHAR(64) NOT NULL,
       expira_en DATETIME NOT NULL,
       usado_en DATETIME NULL,
       creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uq_recuperacion_token (token_hash),
       KEY ix_recuperacion_usuario (usuario_id),
       KEY ix_recuperacion_expira (expira_en)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

async function asegurarTabla(): Promise<void> {
  if (!tablaLista) {
    tablaLista = crearTabla().catch((e) => {
      tablaLista = null;
      throw e;
    });
  }
  return tablaLista;
}

/** El testigo que viaja en el correo. 64 caracteres hexadecimales. */
function tokenNuevo(): string {
  return randomBytes(32).toString("hex");
}

export async function buscarUsuarioPorEmail(email: string): Promise<{ id: number; email: string; nombre: string | null } | null> {
  const limpio = email.trim().toLowerCase();
  if (!limpio) return null;
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT id, email, nombre FROM usuario WHERE LOWER(email) = ? LIMIT 1`,
    [limpio],
  );
  if (!filas[0]) return null;
  return { id: Number(filas[0].id), email: String(filas[0].email), nombre: filas[0].nombre ? String(filas[0].nombre) : null };
}

/** Cuántos enlaces se han pedido para esta cuenta en la última hora. */
async function solicitudesRecientes(usuarioId: number): Promise<number> {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT COUNT(*) AS n FROM recuperacion_acceso WHERE usuario_id = ? AND creado_en > (NOW() - INTERVAL 1 HOUR)`,
    [usuarioId],
  );
  return Number(filas[0]?.n ?? 0);
}

/**
 * Crea el enlace de recuperación y devuelve el testigo en claro (solo aquí, para el correo).
 * Devuelve null si se ha pedido demasiadas veces.
 */
export async function crearEnlace(usuarioId: number): Promise<string | null> {
  await asegurarTabla();
  if ((await solicitudesRecientes(usuarioId)) >= MAX_SOLICITUDES_POR_HORA) return null;
  // Los enlaces anteriores dejan de servir: solo el último vale.
  await poolLegacy.query(`UPDATE recuperacion_acceso SET usado_en = NOW() WHERE usuario_id = ? AND usado_en IS NULL`, [usuarioId]);
  const token = tokenNuevo();
  await poolLegacy.query(
    `INSERT INTO recuperacion_acceso (usuario_id, token_hash, expira_en) VALUES (?, ?, (NOW() + INTERVAL ? MINUTE))`,
    [usuarioId, huellaDelToken(token), MINUTOS_VALIDEZ],
  );
  return token;
}

/** ¿Este testigo vale? Devuelve la cuenta o el motivo por el que no vale. */
export async function comprobarToken(token: string): Promise<{ ok: true; usuarioId: number } | { ok: false; motivo: "no-valido" | "caducado" | "usado" }> {
  if (!tokenPlausible(token)) return { ok: false, motivo: "no-valido" };
  try {
    await asegurarTabla();
    const [filas] = await poolLegacy.query<any[]>(
      `SELECT usuario_id, expira_en, usado_en FROM recuperacion_acceso WHERE token_hash = ? LIMIT 1`,
      [huellaDelToken(token)],
    );
    const fila = filas[0];
    if (!fila) return { ok: false, motivo: "no-valido" };
    if (fila.usado_en) return { ok: false, motivo: "usado" };
    if (new Date(fila.expira_en).getTime() < Date.now()) return { ok: false, motivo: "caducado" };
    return { ok: true, usuarioId: Number(fila.usuario_id) };
  } catch {
    return { ok: false, motivo: "no-valido" };
  }
}

/**
 * Cambia la contraseña de la cuenta y gasta el testigo.
 *
 * Se cierran las sesiones abiertas de esa cuenta: si alguien había entrado con la contraseña vieja,
 * deja de estar dentro. Es lo que se espera al cambiar una contraseña.
 */
export async function cambiarPasswordConToken(token: string, passwordNueva: string): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const comprobado = await comprobarToken(token);
  if (!comprobado.ok) return { ok: false, motivo: comprobado.motivo };
  const huella = huellaDelToken(token);
  try {
    await poolLegacy.query(`UPDATE usuario SET pass_hash = ? WHERE id = ?`, [hashPassword(passwordNueva), comprobado.usuarioId]);
    await poolLegacy.query(`UPDATE recuperacion_acceso SET usado_en = NOW() WHERE token_hash = ? AND usado_en IS NULL`, [huella]);
    await poolLegacy.query(`DELETE FROM usuario_sesion WHERE usuario_id = ?`, [comprobado.usuarioId]);
    return { ok: true };
  } catch (error) {
    console.error("[hestiat] recuperación: no se ha podido cambiar la contraseña", error);
    return { ok: false, motivo: "error" };
  }
}
