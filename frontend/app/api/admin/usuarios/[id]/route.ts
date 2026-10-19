/**
 * API ADMINISTRATIVA DE USUARIOS — persiste los cambios del formulario de edición.
 *
 * PROTECCIÓN: `requireAdmin()` en el servidor. Sin rol admin, 401. Ninguna comprobación depende
 * de que la interfaz oculte campos: la ruta vuelve a verificar el rol en cada petición.
 *
 * ALCANCE DELIBERADO:
 *   · Datos de perfil: nombre, apellidos, teléfono, nombre público, ciudad, país, bio.
 *   · Contacto público: whatsapp, correo público, web (los datos; las AUTORIZACIONES de
 *     publicación son del usuario y no se tocan aquí).
 *   · Correo de acceso: SÍ se puede cambiar, con validación de formato y comprobación de que no
 *     lo tenga ya otra cuenta (el correo es único: `uq_usuario_email`).
 *   · Rol: se puede cambiar entre los valores admitidos.
 *   · CONTRASEÑA: NO se cambia desde aquí. La columna es `pass_hash` y el formato de Hestiat es
 *     `scrypt$sal$hash`, producido por un ayudante propio. Escribir un hash distinto o inventar
 *     el formato dejaría cuentas que no pueden entrar. Se deja fuera a propósito hasta reutilizar
 *     ESE ayudante; el restablecimiento necesita su propia ruta y su propia validación.
 *
 * No se acepta `usuarioId` del cuerpo: el objetivo sale de la URL validada, y quien puede llegar
 * aquí ya ha pasado por requireAdmin.
 */

import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { requireAdmin, hashPassword } from "@/lib/auth.server";
import { poolLegacy } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Roles admitidos. Se validan contra esta lista: no se escribe lo que llegue sin comprobar. */
/**
 * Roles REALES del sistema. El tipo `Rol` de lib/auth.server.ts es
 * `"admin" | "anfitrion" | "huesped"` — no existe «usuario». Poner aquí un valor inventado
 * habría dejado el rol en un estado que ninguna consulta reconoce.
 */
const ROLES = new Set(["admin", "anfitrion", "huesped"]);

/** Longitud mínima de contraseña, alineada con la que usa el registro de cuentas. */
const MIN_PASS = 8;

const limpiar = (v: FormDataEntryValue | null, max = 191): string | null => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s.slice(0, max);
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const { id } = await params;
  const uid = Number(id);
  if (!Number.isFinite(uid) || uid <= 0) {
    return NextResponse.json({ ok: false, error: "Identificador no válido." }, { status: 400 });
  }

  const form = await request.formData();
  const errores: Record<string, string> = {};

  const nombre = limpiar(form.get("nombre"), 120);
  const apellidos = limpiar(form.get("apellidos"), 120);
  const telefono = limpiar(form.get("telefono"), 40);
  const nombreMostrado = limpiar(form.get("nombre_mostrado"), 120);
  const ciudad = limpiar(form.get("ciudad"), 120);
  const pais = limpiar(form.get("pais"), 60);
  const bio = limpiar(form.get("bio"), 2000);
  const whatsapp = limpiar(form.get("whatsapp"), 40);
  const emailPublico = limpiar(form.get("email_publico"), 191);
  const webPublica = limpiar(form.get("web_publica"), 512);
  const email = limpiar(form.get("email"), 191);
  const rol = limpiar(form.get("rol"), 20);
  const password = String(form.get("password") ?? "");
  const password2 = String(form.get("password2") ?? "");

  if (email !== null && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
    errores.email = "El correo de acceso no tiene un formato válido.";
  }
  if (emailPublico !== null && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(emailPublico)) {
    errores.email_publico = "El correo público no tiene un formato válido.";
  }
  if (rol !== null && !ROLES.has(rol)) {
    errores.rol = "Rol no admitido. Valores válidos: administrador, anfitrión o huésped.";
  }
  /* RESTABLECIMIENTO DE CONTRASEÑA.
     Solo se toca si se envía algo. Se exige longitud mínima y doble escritura, y se guarda con
     `hashPassword()`, el MISMO ayudante que usan el registro, el cambio de contraseña propio y la
     recuperación por correo. Reutilizarlo es lo que garantiza que el usuario pueda seguir entrando:
     el formato `scrypt$sal$hash` es idéntico al de la aplicación antigua. */
  if (password !== "" || password2 !== "") {
    if (password.length < MIN_PASS) {
      errores.password = `La contraseña debe tener al menos ${MIN_PASS} caracteres.`;
    }
    if (password !== password2) {
      errores.password2 = "Las dos contraseñas no coinciden.";
    }
  }
  // Salvaguarda: un administrador no se quita a sí mismo el rol admin desde aquí. Si se equivoca,
  // se queda sin acceso al panel y sin forma de volver a entrar por la interfaz.
  if (rol !== null && uid === Number((admin as { id?: number }).id) && rol !== "admin") {
    errores.rol = "No puedes retirarte a ti mismo el rol de administrador.";
  }
  if (Object.keys(errores).length > 0) {
    return NextResponse.json({ ok: false, errores }, { status: 400 });
  }

  try {
    // El correo de acceso es único: se comprueba antes de intentar el UPDATE para dar un error
    // claro en vez de un fallo de índice duplicado.
    if (email !== null) {
      const [choca] = await poolLegacy.query<(RowDataPacket & { id: number })[]>(
        `SELECT id FROM usuario WHERE email = ? AND id <> ? LIMIT 1`,
        [email, uid],
      );
      if (choca.length > 0) {
        return NextResponse.json(
          { ok: false, errores: { email: "Ese correo ya pertenece a otra cuenta." } },
          { status: 400 },
        );
      }
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    const pon = (campo: string, valor: unknown) => { sets.push(`${campo} = ?`); vals.push(valor); };
    if (nombre !== undefined) pon("nombre", nombre);
    if (apellidos !== undefined) pon("apellidos", apellidos);
    if (telefono !== undefined) pon("telefono", telefono);
    if (nombreMostrado !== undefined) pon("nombre_mostrado", nombreMostrado);
    if (ciudad !== undefined) pon("ciudad", ciudad);
    if (pais !== undefined) pon("pais", pais);
    if (bio !== undefined) pon("bio", bio);
    if (whatsapp !== undefined) pon("whatsapp", whatsapp);
    if (emailPublico !== undefined) pon("email_publico", emailPublico);
    if (webPublica !== undefined) pon("web_publica", webPublica);
    if (email !== undefined) pon("email", email);
    if (rol !== undefined) pon("rol", rol);
    // La contraseña se hashea AQUÍ, nunca llega a la base en claro ni se devuelve en la respuesta.
    if (password !== "" && password === password2 && password.length >= MIN_PASS) {
      pon("pass_hash", hashPassword(password));
    }

    if (sets.length === 0) {
      return NextResponse.json({ ok: false, error: "No hay nada que guardar." }, { status: 400 });
    }
    vals.push(uid);
    await poolLegacy.query(`UPDATE usuario SET ${sets.join(", ")} WHERE id = ?`, vals);

    // Comprobación real de que el cambio se ha escrito, no solo de que la consulta no falló.
    const [vuelta] = await poolLegacy.query<(RowDataPacket & { email: string; rol: string })[]>(
      `SELECT email, rol FROM usuario WHERE id = ? LIMIT 1`,
      [uid],
    );
    const guardado = vuelta[0];
    if (!guardado || (email !== null && guardado.email !== email) || (rol !== null && guardado.rol !== rol)) {
      return NextResponse.json(
        { ok: false, error: "El cambio no se ha podido confirmar en la base de datos." },
        { status: 500 },
      );
    }

    // Vuelta al listado con confirmación visible. Se usa una URL relativa: es la convención del
    // proyecto y evita depender del host de la petición.
    return NextResponse.redirect(new URL(`/admin/usuarios?guardado=${uid}`, request.url), 303);
  } catch (error) {
    console.error(
      "[admin/usuarios] fallo al guardar la edición",
      uid,
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: false, error: "No se han podido guardar los cambios." }, { status: 500 });
  }
}
