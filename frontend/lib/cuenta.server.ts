/**
 * Cuentas de usuario — SOLO servidor.
 *
 * Registro y perfil. Reglas que no se negocian:
 *
 *  · La contraseña NUNCA se guarda: se guarda `scrypt$sal$hash`. La columna real de la base es
 *    `pass_hash`, no `password_hash` (ese nombre no existe y fue el origen de un fallo de login).
 *
 *  · El ROL se decide en el servidor. Al registrarse, siempre `huesped`. Nadie puede hacerse
 *    administrador enviando un campo desde el navegador.
 *
 *  · La validación se hace aquí, no en el navegador: correo con formato, contraseña de longitud
 *    mínima, y el correo no puede estar ya en uso.
 *
 *  · Todas las escrituras son parametrizadas y todas las lecturas de perfil salen del usuario de la
 *    sesión, nunca de un identificador que venga en la petición.
 */
import { poolLegacy } from "@/lib/db";
import { hashPassword, verificarPassword, createSession, setSessionCookie, type Rol } from "@/lib/auth.server";

export interface Perfil {
  id: number;
  email: string;
  nombre: string | null;
  apellidos: string | null;
  nombre_mostrado: string | null;
  telefono: string | null;
  ciudad: string | null;
  pais: string | null;
  bio: string | null;
  avatar_url: string | null;
  rol: Rol;
  creado_en: string | null;
}

const LARGO_MINIMO_PASSWORD = 8;

function correoValido(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email);
}

/* ------------------------------------------------------------- registro -- */

export type ResultadoCuenta = { ok: true } | { ok: false; error: string };

export async function registrar(entrada: {
  nombre: string;
  email: string;
  password: string;
  password2?: string;
  telefono?: string;
  userAgent?: string | null;
}): Promise<ResultadoCuenta> {
  const nombre = entrada.nombre.trim();
  const email = entrada.email.trim().toLowerCase();
  const telefono = (entrada.telefono ?? "").trim();

  if (nombre.length < 3) return { ok: false, error: "Escribe tu nombre (al menos 3 letras)." };
  if (!correoValido(email)) return { ok: false, error: "Ese correo no tiene un formato válido." };
  if (entrada.password.length < LARGO_MINIMO_PASSWORD) {
    return { ok: false, error: `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.` };
  }
  if (entrada.password2 !== undefined && entrada.password !== entrada.password2) {
    return { ok: false, error: "Las dos contraseñas no coinciden." };
  }

  const [ya] = await poolLegacy.query<any[]>(`SELECT id FROM usuario WHERE email = ? LIMIT 1`, [email]);
  if (ya[0]) return { ok: false, error: "Ya existe una cuenta con ese correo. Prueba a entrar." };

  try {
    const [res] = await poolLegacy.query<any>(
      `INSERT INTO usuario (email, nombre, telefono, pass_hash, rol, activo, creado_en)
       VALUES (?,?,?,?, 'huesped', 1, NOW())`,
      [email, nombre.slice(0, 191), telefono.slice(0, 32) || null, hashPassword(entrada.password)],
    );
    const id = Number(res.insertId);
    const token = await createSession(id, entrada.userAgent);
    await setSessionCookie(token);
    return { ok: true };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "";
    console.error("[hestiat] registrar", mensaje);
    // Si el correo chocó en el índice único de la base, se dice lo mismo que en la comprobación previa.
    if (mensaje.includes("Duplicate")) return { ok: false, error: "Ya existe una cuenta con ese correo." };
    return { ok: false, error: "No se ha podido crear la cuenta. Inténtalo de nuevo." };
  }
}

/* ---------------------------------------------------------------- perfil -- */

export async function datosPerfil(usuarioId: number): Promise<Perfil | null> {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT id, email, nombre, apellidos, nombre_mostrado, telefono, ciudad, pais, bio, avatar_url, rol, creado_en
       FROM usuario WHERE id = ? LIMIT 1`,
    [usuarioId],
  );
  const u = filas[0];
  if (!u) return null;
  return {
    id: Number(u.id),
    email: String(u.email),
    nombre: u.nombre ?? null,
    apellidos: u.apellidos ?? null,
    nombre_mostrado: u.nombre_mostrado ?? null,
    telefono: u.telefono ?? null,
    ciudad: u.ciudad ?? null,
    pais: u.pais ?? null,
    bio: u.bio ?? null,
    avatar_url: u.avatar_url ?? null,
    rol: u.rol as Rol,
    creado_en: u.creado_en ? String(u.creado_en) : null,
  };
}

/** Campos que el usuario puede editar de su propio perfil. Lista blanca, explícita. */
const CAMPOS_PERFIL = ["nombre", "apellidos", "nombre_mostrado", "telefono", "ciudad", "pais", "bio"] as const;

export async function actualizarPerfil(usuarioId: number, formulario: FormData): Promise<ResultadoCuenta> {
  const valores: Record<string, string | null> = {};
  for (const campo of CAMPOS_PERFIL) {
    const bruto = formulario.get(campo);
    if (bruto === null) continue;
    const v = String(bruto).trim();
    valores[campo] = v === "" ? null : v.slice(0, 400);
  }
  if (valores.nombre && valores.nombre.length < 3) return { ok: false, error: "El nombre es demasiado corto." };
  if (Object.keys(valores).length === 0) return { ok: false, error: "No hay nada que guardar." };

  const columnas = Object.keys(valores);
  const sql = `UPDATE usuario SET ${columnas.map((c) => `\`${c}\` = ?`).join(", ")} WHERE id = ?`;
  await poolLegacy.query(sql, [...Object.values(valores), usuarioId]);
  return { ok: true };
}

export async function cambiarPassword(
  usuarioId: number,
  actual: string,
  nueva: string,
  nueva2: string,
): Promise<ResultadoCuenta> {
  if (nueva.length < LARGO_MINIMO_PASSWORD) return { ok: false, error: `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.` };
  if (nueva !== nueva2) return { ok: false, error: "Las dos contraseñas nuevas no coinciden." };

  const [filas] = await poolLegacy.query<any[]>(`SELECT pass_hash FROM usuario WHERE id = ? LIMIT 1`, [usuarioId]);
  const u = filas[0];
  if (!u) return { ok: false, error: "Cuenta no encontrada." };
  if (!verificarPassword(actual, u.pass_hash)) return { ok: false, error: "La contraseña actual no es correcta." };

  await poolLegacy.query(`UPDATE usuario SET pass_hash = ? WHERE id = ?`, [hashPassword(nueva), usuarioId]);
  return { ok: true };
}
