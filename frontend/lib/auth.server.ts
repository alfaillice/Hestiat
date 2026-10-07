/**
 * Hestiat 2.0 — autenticación. Portado FIEL de `src/api/auth.server.ts` de la aplicación antigua.
 *
 * Reglas que se respetan para NO invalidar ninguna sesión existente:
 *  · La cookie se llama igual: `hestiat_sesion`.
 *  · El token es de 32 bytes en hexadecimal (64 caracteres) y vive en `usuario_sesion`.
 *  · El hash es `scrypt$sal$hash` y se verifica con el MISMO algoritmo; la longitud de clave
 *    se deduce del hash guardado, así que los hashes existentes validan sin tocar nada.
 *  · El rol SIEMPRE se lee de la base de datos, nunca del cliente.
 *  · Las sesiones se leen de la base ORIGINAL (poolLegacy), que es donde están las filas vivas.
 *
 * SOLO SERVIDOR: usa `next/headers` y `node:crypto`.
 */
import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { poolLegacy } from "@/lib/db";

if (typeof window !== "undefined") {
  throw new Error("lib/auth.server.ts es solo para servidor");
}

export const SESSION_COOKIE = "hestiat_sesion";
const SESSION_DAYS = 30;
const MAX_UA = 255;

export type Rol = "admin" | "anfitrion" | "huesped";

export interface SesionUsuario {
  id: number;
  email: string;
  nombre: string | null;
  telefono: string | null;
  rol: Rol;
  creadoEn: string;
}

/* ------------------------------------------------------------- contraseñas -- */

/** Formato `scrypt$sal$hash`, idéntico al de la aplicación antigua. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

/**
 * Verifica una contraseña contra un hash guardado.
 * La longitud de clave se DEDUCE del hash almacenado (no se fija a mano), de modo que los
 * hashes ya existentes validan sin necesidad de conocer el parámetro original.
 */
export function verificarPassword(password: string, almacenado: string | null | undefined): boolean {
  if (!almacenado) return false;
  const partes = almacenado.split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;
  const sal = partes[1];
  const esperado = Buffer.from(partes[2], "hex");
  if (esperado.length === 0) return false;
  try {
    const actual = scryptSync(password, sal, esperado.length);
    return actual.length === esperado.length && timingSafeEqual(actual, esperado);
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- sesiones -- */

export async function createSession(usuarioId: number, userAgent?: string | null): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await poolLegacy.query(
    `INSERT INTO usuario_sesion (token, usuario_id, expira_en, user_agent) VALUES (?,?,?,?)`,
    [token, usuarioId, expira, userAgent?.slice(0, MAX_UA) ?? null],
  );
  return token;
}

/** Mismo formato de cookie que la aplicación antigua. */
export async function setSessionCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

/** Usuario de la sesión actual, o null. Nunca lanza. */
export async function getCurrentUser(): Promise<SesionUsuario | null> {
  let token: string | undefined;
  try {
    const c = await cookies();
    token = c.get(SESSION_COOKIE)?.value;
  } catch {
    return null;
  }
  if (!token || token.length !== 64) return null;

  try {
    const [rows] = await poolLegacy.query<any[]>(
      `SELECT u.id, u.email, u.nombre, u.telefono, u.rol, u.creado_en
         FROM usuario_sesion s
         JOIN usuario u ON u.id = s.usuario_id
        WHERE s.token = ? AND s.expira_en > NOW() AND u.activo = 1 AND u.bloqueado_en IS NULL
        LIMIT 1`,
      [token],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      email: String(row.email),
      nombre: row.nombre ?? null,
      telefono: row.telefono ?? null,
      rol: row.rol as Rol,
      creadoEn: String(row.creado_en),
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- entrada -- */

export type AuthResult = { ok: true; usuario: SesionUsuario } | { ok: false; error: string };

/** Login con email y contraseña. El rol se lee de la base. */
export async function login(input: { email: string; password: string; userAgent?: string | null }): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) return { ok: false, error: "Introduce tu correo y tu contraseña." };

  const [rows] = await poolLegacy.query<any[]>(
    `SELECT id, email, nombre, telefono, rol, pass_hash, activo, bloqueado_en FROM usuario WHERE email = ? LIMIT 1`,
    [email],
  );
  const u = rows[0];
  // Mismo mensaje tanto si el usuario no existe como si la contraseña falla: no se filtra
  // qué correos están registrados.
  const generico = { ok: false as const, error: "Correo o contraseña incorrectos." };
  if (!u) return generico;
  if (Number(u.activo) !== 1 || u.bloqueado_en) return { ok: false, error: "Esta cuenta está bloqueada. Contacta con soporte." };
  if (!verificarPassword(input.password, u.pass_hash)) return generico;

  const token = await createSession(Number(u.id), input.userAgent);
  await setSessionCookie(token);
  return {
    ok: true,
    usuario: {
      id: Number(u.id),
      email: String(u.email),
      nombre: u.nombre ?? null,
      telefono: u.telefono ?? null,
      rol: u.rol as Rol,
      creadoEn: "",
    },
  };
}

export async function logout(): Promise<void> {
  try {
    const c = await cookies();
    const token = c.get(SESSION_COOKIE)?.value;
    if (token) await poolLegacy.query(`DELETE FROM usuario_sesion WHERE token = ?`, [token]);
  } catch {
    /* salir nunca debe fallar */
  }
  await clearSessionCookie();
}

/* ------------------------------------------------------------- guardias -- */

/** Guardia de rutas de anfitrión: `anfitrion` o `admin`. */
export async function requireHost(): Promise<SesionUsuario | null> {
  const u = await getCurrentUser();
  if (!u) return null;
  return u.rol === "anfitrion" || u.rol === "admin" ? u : null;
}

/** Guardia de rutas de administración: solo `admin`. */
export async function requireAdmin(): Promise<SesionUsuario | null> {
  const u = await getCurrentUser();
  if (!u) return null;
  return u.rol === "admin" ? u : null;
}

/** Comprueba que el usuario puede gestionar un alojamiento concreto. */
export async function ownsListing(usuarioId: number, alojamientoId: number): Promise<boolean> {
  const [rows] = await poolLegacy.query<any[]>(
    `SELECT COUNT(*) AS c FROM alojamiento_anfitrion WHERE usuario_id = ? AND alojamiento_id = ?`,
    [usuarioId, alojamientoId],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}
