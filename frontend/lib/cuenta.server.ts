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
import { CARPETA_AVATARES, borrarImagen, esUrlNuestra, guardarImagenOptimizada, urlsDeVariantes } from "@/lib/almacen.server";
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


/* -------------------------------------------------------------------- foto de perfil -- */

/**
 * FOTO DE PERFIL.
 *
 * Reutiliza el almacenamiento que ya usa el resto de la web (misma carpeta `avatares`, mismo
 * optimizador, mismo criterio de nombres por contenido) y el mismo borrado que comprueba si la
 * imagen la usa alguien más. No se crea ningún sistema aparte y no tiene nada que ver con las fotos
 * de los alojamientos: son campos y carpetas distintas.
 *
 * Reglas:
 *  · El formato se comprueba por los BYTES del archivo, no por lo que diga el navegador.
 *  · La imagen anterior se conserva si la subida falla: primero se sube, después se apunta.
 *  · Solo se borra la anterior si es nuestra y no la usa otro registro.
 */
const MAX_AVATAR = 8 * 1024 * 1024; // 8 MB, el mismo tope que en el resto de subidas

const FORMATOS: Array<{ ext: string; comprueba: (b: Uint8Array) => boolean }> = [
  { ext: "jpg", comprueba: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", comprueba: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    ext: "webp",
    comprueba: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/** Guarda la foto del usuario. Devuelve error legible sin tocar lo que ya tenía si algo falla. */
export async function guardarAvatar(usuarioId: number, formulario: FormData): Promise<ResultadoCuenta> {
  const fichero = formulario.get("foto");
  if (!(fichero instanceof File) || fichero.size === 0) {
    return { ok: false, error: "No has elegido ninguna imagen." };
  }
  if (fichero.size > MAX_AVATAR) {
    return { ok: false, error: `La imagen ocupa más de ${Math.round(MAX_AVATAR / 1024 / 1024)} MB. Elige una más ligera.` };
  }
  let datos: Uint8Array;
  try {
    datos = new Uint8Array(await fichero.arrayBuffer());
  } catch {
    return { ok: false, error: "No se ha podido leer el archivo." };
  }
  const formato = FORMATOS.find((f) => datos.length > 12 && f.comprueba(datos));
  if (!formato) {
    return { ok: false, error: "El archivo no es una imagen JPG, PNG o WebP de verdad." };
  }

  // Se sube primero: si esto falla, la foto que ya tenía sigue intacta.
  let guardada;
  try {
    guardada = await guardarImagenOptimizada(datos, formato.ext, CARPETA_AVATARES);
  } catch {
    return { ok: false, error: "No se ha podido guardar la imagen. Inténtalo de nuevo en un momento." };
  }

  const [filas] = await poolLegacy.query<any[]>(`SELECT avatar_url FROM usuario WHERE id = ? LIMIT 1`, [usuarioId]);
  const anterior = (filas[0]?.avatar_url as string | null) ?? null;

  await poolLegacy.query(
    `UPDATE usuario SET avatar_url = ?, avatar_original = ? WHERE id = ?`,
    [guardada.principal.url, JSON.stringify(guardada.variantes.map((v) => v.url)), usuarioId],
  );

  // La anterior solo se borra si es nuestra y no la usa nadie más: lo comprueba `borrarImagen`.
  if (anterior && anterior !== guardada.principal.url && esUrlNuestra(anterior)) {
    try {
      await borrarImagen(anterior);
    } catch {
      /* si no se puede borrar, se queda: nunca se rompe la foto nueva por esto */
    }
  }
  return { ok: true };
}

/** Quita la foto y vuelve al avatar predeterminado. Primero la base, después los archivos. */
export async function quitarAvatar(usuarioId: number): Promise<ResultadoCuenta> {
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT avatar_url, avatar_original FROM usuario WHERE id = ? LIMIT 1`,
    [usuarioId],
  );
  if (!filas[0]) return { ok: false, error: "No se ha encontrado tu cuenta." };
  const url = (filas[0].avatar_url as string | null) ?? null;
  const originales = urlsDeVariantes(filas[0].avatar_original as string | null);

  await poolLegacy.query(`UPDATE usuario SET avatar_url = NULL, avatar_original = NULL WHERE id = ?`, [usuarioId]);

  for (const u of [url, ...originales]) {
    if (u && esUrlNuestra(u)) {
      try {
        await borrarImagen(u);
      } catch {
        /* compartida por otro registro: se conserva */
      }
    }
  }
  return { ok: true };
}
