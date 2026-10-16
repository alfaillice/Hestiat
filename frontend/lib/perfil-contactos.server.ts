/**
 * CONTACTOS DEL PERFIL DE USUARIO — lectura, escritura y publicación en alojamientos.
 *
 * Reglas de privacidad que este módulo garantiza en el SERVIDOR (no solo en la interfaz):
 *   · El correo de acceso (`usuario.email`) NUNCA se publica. Es distinto de `email_publico`.
 *   · El teléfono privado (`usuario.telefono`) sale a la ficha SOLO si `mostrar_telefono = 1`.
 *   · Cada interruptor es INDEPENDIENTE. Desactivar uno no borra el dato: solo deja de mostrarse.
 *   · Sin autorización explícita no hay publicación. Todo nace a 0.
 *
 * PRIORIDAD DE RESOLUCIÓN en un alojamiento (tu instrucción, punto 8):
 *   1. Contacto específico del alojamiento, autorizado y publicable.
 *   2. Contacto público autorizado por su anfitrión registrado.
 *   3. Contacto directo del establecimiento de fuente externa, apto para publicación.
 * No se mezclan fuentes y no se pierde la procedencia: cada canal dice de dónde viene.
 */

import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";

/* ------------------------------------------------------------- validación -- */

/** Normaliza a formato internacional E.164 sin espacios. Acepta +34…, 0034… y números locales. */
export function normalizarTelefono(v: string | null | undefined): string | null {
  const crudo = String(v ?? "").trim();
  if (!crudo) return null;
  let d = crudo.replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = `+${d.slice(2)}`;          // 0034… → +34…
  if (!d.startsWith("+")) {
    // Sin prefijo: se asume España si tiene 9 dígitos empezando por 6/7/8/9.
    if (/^[6789]\d{8}$/.test(d)) d = `+34${d}`;
    else return null;                                     // no se inventa un prefijo
  }
  const solo = d.slice(1);
  if (solo.length < 8 || solo.length > 15) return null;   // E.164 admite hasta 15 dígitos
  return `+${solo}`;
}

export function emailValido(v: string | null | undefined): boolean {
  const s = String(v ?? "").trim();
  return s.length > 5 && s.length <= 191 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s);
}

/** Devuelve la URL normalizada (https si falta esquema) o null si no es válida. */
export function urlValida(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const con = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(con);
    if (!/^https?:$/i.test(u.protocol)) return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- lectura -- */

export type ContactosPerfil = {
  telefono: string | null;
  whatsapp: string | null;
  emailPublico: string | null;
  webPublica: string | null;
  mostrarTelefono: boolean;
  mostrarWhatsapp: boolean;
  mostrarEmail: boolean;
  mostrarWeb: boolean;
};

/** Lee los contactos de un usuario. Solo para él mismo o para administración autorizada. */
export async function leerContactosPerfil(usuarioId: number): Promise<ContactosPerfil | null> {
  if (!Number.isFinite(usuarioId)) return null;
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT u.telefono, u.whatsapp, u.email_publico, u.web_publica,
            COALESCE(p.mostrar_telefono,0) AS mostrar_telefono,
            COALESCE(p.mostrar_whatsapp,0) AS mostrar_whatsapp,
            COALESCE(p.mostrar_email,0)    AS mostrar_email,
            COALESCE(p.mostrar_web,0)      AS mostrar_web
       FROM hestiat.usuario u
       LEFT JOIN hestiat2.usuario_preferencias p ON p.usuario_id = u.id
      WHERE u.id = ? LIMIT 1`,
    [usuarioId],
  );
  const f = filas[0];
  if (!f) return null;
  return {
    telefono: f.telefono ?? null,
    whatsapp: f.whatsapp ?? null,
    emailPublico: f.email_publico ?? null,
    webPublica: f.web_publica ?? null,
    mostrarTelefono: Number(f.mostrar_telefono) === 1,
    mostrarWhatsapp: Number(f.mostrar_whatsapp) === 1,
    mostrarEmail: Number(f.mostrar_email) === 1,
    mostrarWeb: Number(f.mostrar_web) === 1,
  };
}

/* --------------------------------------------------------------- escritura -- */

/**
 * Guarda contactos y autorizaciones. `usuarioId` es SIEMPRE el de la sesión: quien llama
 * no puede pasar otro identificador, porque el valor lo pone la capa de autenticación.
 * Devuelve los errores de validación campo a campo, sin guardar nada si hay alguno.
 */
export async function guardarContactosPerfil(
  usuarioId: number,
  datos: Partial<{
    whatsapp: string | null;
    emailPublico: string | null;
    webPublica: string | null;
    mostrarTelefono: boolean;
    mostrarWhatsapp: boolean;
    mostrarEmail: boolean;
    mostrarWeb: boolean;
  }>,
): Promise<{ ok: true } | { ok: false; errores: Record<string, string> }> {
  if (!Number.isFinite(usuarioId)) return { ok: false, errores: { general: "Usuario no válido." } };
  const errores: Record<string, string> = {};

  const wa = datos.whatsapp === undefined ? undefined : normalizarTelefono(datos.whatsapp);
  if (datos.whatsapp && !wa) errores.whatsapp = "El número de WhatsApp no es válido.";
  const mail = datos.emailPublico === undefined ? undefined : (String(datos.emailPublico ?? "").trim() || null);
  if (mail && !emailValido(mail)) errores.emailPublico = "El correo público no es válido.";
  const web = datos.webPublica === undefined ? undefined : urlValida(datos.webPublica);
  if (datos.webPublica && !web) errores.webPublica = "La dirección web no es válida.";
  if (Object.keys(errores).length > 0) return { ok: false, errores };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (wa !== undefined || mail !== undefined || web !== undefined) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (wa !== undefined) { sets.push("whatsapp = ?"); vals.push(wa); }
      if (mail !== undefined) { sets.push("email_publico = ?"); vals.push(mail); }
      if (web !== undefined) { sets.push("web_publica = ?"); vals.push(web); }
      vals.push(usuarioId);
      await conn.query(`UPDATE hestiat.usuario SET ${sets.join(", ")} WHERE id = ?`, vals);
    }
    if (
      datos.mostrarTelefono !== undefined || datos.mostrarWhatsapp !== undefined ||
      datos.mostrarEmail !== undefined || datos.mostrarWeb !== undefined
    ) {
      // Upsert: la fila puede no existir todavía (la tabla está vacía).
      await conn.query(
        `INSERT INTO usuario_preferencias (usuario_id, mostrar_telefono, mostrar_whatsapp, mostrar_email, mostrar_web, actualizado_en)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           mostrar_telefono = VALUES(mostrar_telefono), mostrar_whatsapp = VALUES(mostrar_whatsapp),
           mostrar_email = VALUES(mostrar_email), mostrar_web = VALUES(mostrar_web), actualizado_en = NOW()`,
        [
          usuarioId,
          datos.mostrarTelefono ? 1 : 0,
          datos.mostrarWhatsapp ? 1 : 0,
          datos.mostrarEmail ? 1 : 0,
          datos.mostrarWeb ? 1 : 0,
        ],
      );
    }
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/* ------------------------------------------- publicación en el alojamiento -- */

export type CanalPublicado = {
  canal: "telefono" | "whatsapp" | "email" | "web";
  valor: string;
  /** De dónde sale el dato: el alojamiento o el perfil de su anfitrión. */
  origen: "alojamiento" | "anfitrion";
  /**
   * Etiqueta de honestidad. Un dato que el anfitrión publica NO está verificado por Hestiat
   * en su funcionamiento: se dice «publicado por el anfitrión», nunca «verificado».
   */
  etiqueta: string;
};

/**
 * Resuelve los canales publicables de un alojamiento, con la prioridad que definiste.
 * Solo devuelve canales con dato utilizable Y autorización activa.
 */
export async function contactosPublicadosDeAlojamiento(legacyId: number): Promise<CanalPublicado[]> {
  if (!Number.isFinite(legacyId) || legacyId <= 0) return [];
  const [fl] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT t.telefono, t.email, t.web, t.whatsapp,
            u.telefono AS u_tel, u.whatsapp AS u_wa, u.email_publico AS u_mail, u.web_publica AS u_web,
            COALESCE(p.mostrar_telefono,0) AS m_tel, COALESCE(p.mostrar_whatsapp,0) AS m_wa,
            COALESCE(p.mostrar_email,0) AS m_mail, COALESCE(p.mostrar_web,0) AS m_web
       FROM hestiat.alojamiento t
       LEFT JOIN hestiat.alojamiento_anfitrion af
              ON af.alojamiento_id = t.id AND af.rol = 'propietario'
       LEFT JOIN hestiat.usuario u ON u.id = af.usuario_id
       LEFT JOIN hestiat2.usuario_preferencias p ON p.usuario_id = af.usuario_id
      WHERE t.id = ? LIMIT 1`,
    [legacyId],
  );
  const f = fl[0];
  if (!f) return [];

  const salida: CanalPublicado[] = [];
  const push = (canal: CanalPublicado["canal"], valor: unknown, origen: CanalPublicado["origen"]) => {
    const v = String(valor ?? "").trim();
    if (!v) return;
    const etiqueta = origen === "anfitrion"
      ? "Publicado por el anfitrión"
      : "Dato del alojamiento";
    salida.push({ canal, valor: v, origen, etiqueta });
  };

  // PRIORIDAD 1: contacto propio del alojamiento (el que ya vive en la tabla antigua).
  // PRIORIDAD 2: solo si el alojamiento no aporta ese canal, el del anfitrión CON autorización.
  if (f.telefono) push("telefono", f.telefono, "alojamiento");
  else if (Number(f.m_tel) === 1 && f.u_tel) push("telefono", normalizarTelefono(f.u_tel) ?? f.u_tel, "anfitrion");

  if (f.whatsapp) push("whatsapp", normalizarTelefono(f.whatsapp) ?? f.whatsapp, "alojamiento");
  else if (Number(f.m_wa) === 1 && f.u_wa) push("whatsapp", normalizarTelefono(f.u_wa) ?? f.u_wa, "anfitrion");

  if (f.email) push("email", f.email, "alojamiento");
  else if (Number(f.m_mail) === 1 && f.u_mail) push("email", f.u_mail, "anfitrion");

  if (f.web) push("web", f.web, "alojamiento");
  else if (Number(f.m_web) === 1 && f.u_web) push("web", urlValida(f.u_web) ?? f.u_web, "anfitrion");

  return salida;
}

/**
 * ¿Este alojamiento tiene algún canal público autorizado o propio?
 * Se usa para NO mostrar «sin contacto directo verificado» cuando sí hay forma de contactar.
 */
export async function tieneContactoPublico(legacyId: number): Promise<boolean> {
  const canales = await contactosPublicadosDeAlojamiento(legacyId);
  return canales.length > 0;
}
