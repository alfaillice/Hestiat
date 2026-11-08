/**
 * Acceso con Google — SOLO SERVIDOR.
 *
 * No crea infraestructura nueva: la base ya tenía `auth_identities` (con `provider` google/apple y
 * dos cuentas vinculadas de antes) y `auth_nonce` para el `state`. Esto las usa tal cual, y la
 * sesión la sigue creando `lib/auth.server`, que es la única que sabe emitir cookies aquí.
 *
 * Lo que NO hace: tocar el rol. Google autentica; los permisos los sigue decidiendo la cuenta
 * Hestiat. Un anfitrión sigue siendo anfitrión y nadie se vuelve administrador por entrar con
 * Google.
 *
 * Vinculación: se busca por `provider_user_id`, que es el `sub` de Google, un identificador estable
 * que no cambia aunque la persona cambie de nombre o de correo. Si no hay vínculo pero el correo ya
 * existe en Hestiat, se vincula a ESA cuenta (no se crea otra), y solo si Google garantiza que el
 * correo está verificado.
 */
import crypto from "node:crypto";
import { pool as poolNuevo, poolLegacy } from "@/lib/db";

const AUTORIZACION = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const JWKS = "https://www.googleapis.com/oauth2/v3/certs";
const EMISORES = new Set(["accounts.google.com", "https://accounts.google.com"]);

export function googleConfigurado(): boolean {
  return Boolean((process.env.GOOGLE_CLIENT_ID ?? "").trim() && (process.env.GOOGLE_CLIENT_SECRET ?? "").trim());
}

function urlBase(): string {
  return (process.env.APP_URL ?? "").trim().replace(/\/$/, "") || "https://hestiat.com";
}

/**
 * La dirección de vuelta tiene que ser la del dominio real Y la que el cliente de OAuth ya tiene
 * registrada. La aplicación antigua usaba `/auth/google/callback` (está en su propio código), así
 * que esta es la que hay que enviar: con `/api/auth/google/callback` Google responde
 * `redirect_uri_mismatch` y no deja entrar a nadie. No es una suposición: se comprobó contra Google.
 */
export function urlCallback(): string {
  return `${urlBase()}/auth/google/callback`;
}

/** Retorno seguro: solo rutas internas, nunca una URL completa (evita redirecciones abiertas). */
export function retornoValido(v: string | null | undefined): string {
  const s = String(v ?? "");
  return /^\/[A-Za-z0-9\-._~/?=&%]*$/.test(s) && !s.startsWith("//") ? s : "/perfil";
}

export function azar(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function hashDe(valor: string): string {
  return crypto.createHash("sha256").update(valor).digest("hex");
}

export function urlAutorizacion(state: string, nonce: string): string {
  const p = new URLSearchParams({
    client_id: (process.env.GOOGLE_CLIENT_ID ?? "").trim(),
    redirect_uri: urlCallback(),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    prompt: "select_account",
    access_type: "online",
  });
  return `${AUTORIZACION}?${p.toString()}`;
}

/* ------------------------------------------------------------- state y nonce -- */

export async function guardarState(hash: string): Promise<void> {
  await poolLegacy.query(
    `INSERT INTO auth_nonce (hash, expira_en, creado_en) VALUES (?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW())`,
    [hash],
  );
}

/** Un `state` vale una vez y solo diez minutos. Devuelve si es válido (y lo marca usado). */
export async function consumirState(hash: string): Promise<boolean> {
  const [res] = await poolLegacy.query<any>(
    `UPDATE auth_nonce SET usado_en = NOW()
      WHERE hash = ? AND usado_en IS NULL AND expira_en > NOW()`,
    [hash],
  );
  return Number((res as { affectedRows?: number })?.affectedRows ?? 0) > 0;
}

/* ------------------------------------------------------------------ tokens -- */

interface CargaIdToken {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
  nonce?: string;
  aud?: string;
  iss?: string;
  exp?: number;
}

let clavesGoogle: { claves: any[]; caduca: number } | null = null;

async function jwks(): Promise<any[]> {
  if (clavesGoogle && clavesGoogle.caduca > Date.now()) return clavesGoogle.claves;
  const r = await fetch(JWKS, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`No se han podido leer las claves de Google (HTTP ${r.status}).`);
  const datos = (await r.json()) as { keys?: any[] };
  clavesGoogle = { claves: datos.keys ?? [], caduca: Date.now() + 60 * 60 * 1000 };
  return clavesGoogle.claves;
}

/**
 * Verifica el `id_token` de Google: firma RS256 contra sus claves públicas, emisor, destinatario,
 * caducidad y nonce. No se acepta nada que no pase TODAS las comprobaciones.
 */
export async function verificarIdToken(idToken: string, nonceEsperado: string): Promise<CargaIdToken> {
  const partes = idToken.split(".");
  if (partes.length !== 3) throw new Error("El token de Google no tiene el formato esperado.");
  const [cabeceraB64, cargaB64, firmaB64] = partes;

  const cabecera = JSON.parse(Buffer.from(cabeceraB64, "base64url").toString("utf8"));
  if (cabecera.alg !== "RS256") throw new Error("Algoritmo de firma no admitido.");

  const claves = await jwks();
  const jwk = claves.find((k) => k.kid === cabecera.kid);
  if (!jwk) throw new Error("La clave con la que se firmó el token no está entre las de Google.");

  const clave = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const firmaOk = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${cabeceraB64}.${cargaB64}`),
    clave,
    Buffer.from(firmaB64, "base64url"),
  );
  if (!firmaOk) throw new Error("La firma del token de Google no es válida.");

  const carga = JSON.parse(Buffer.from(cargaB64, "base64url").toString("utf8")) as CargaIdToken;
  if (!EMISORES.has(String(carga.iss))) throw new Error("El token no lo ha emitido Google.");
  if (String(carga.aud) !== (process.env.GOOGLE_CLIENT_ID ?? "").trim()) {
    throw new Error("El token no está destinado a esta aplicación.");
  }
  if (!carga.exp || carga.exp * 1000 < Date.now()) throw new Error("El token de Google ha caducado.");
  if (carga.nonce !== nonceEsperado) throw new Error("El token no corresponde a este intento de acceso.");
  if (!carga.sub) throw new Error("El token no identifica al usuario de Google.");

  return carga;
}

export async function intercambiarCodigo(code: string): Promise<{ id_token?: string }> {
  const cuerpo = new URLSearchParams({
    code,
    client_id: (process.env.GOOGLE_CLIENT_ID ?? "").trim(),
    client_secret: (process.env.GOOGLE_CLIENT_SECRET ?? "").trim(),
    redirect_uri: urlCallback(),
    grant_type: "authorization_code",
  });
  const r = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: cuerpo.toString(),
  });
  const datos = (await r.json()) as { id_token?: string; error?: string; error_description?: string };
  if (!r.ok || !datos.id_token) {
    throw new Error(datos.error_description ?? datos.error ?? "Google no ha devuelto un token válido.");
  }
  return datos;
}

/* -------------------------------------------------------------- vinculación -- */

export type ResultadoGoogle =
  | { ok: true; usuarioId: number; nuevo: boolean; vinculado: boolean; rol: string }
  | { ok: false; error: string };

/**
 * Une la identidad de Google con la cuenta de Hestiat: la existente si la hay, o una nueva.
 *
 * Orden: primero por `sub` (lo estable), después por correo verificado, y solo si no hay nada, se
 * crea la cuenta. Nunca se crea un segundo usuario para el mismo correo.
 */
export async function autenticarConGoogle(carga: CargaIdToken): Promise<ResultadoGoogle> {
  const email = String(carga.email ?? "").trim().toLowerCase();
  const verificado = carga.email_verified === true || String(carga.email_verified) === "true";

  const [porSub] = await poolLegacy.query<any[]>(
    `SELECT ai.user_id, u.rol, u.activo, u.bloqueado_en
       FROM auth_identities ai JOIN usuario u ON u.id = ai.user_id
      WHERE ai.provider = 'google' AND ai.provider_user_id = ? LIMIT 1`,
    [carga.sub],
  );
  if (porSub[0]) {
    const u = porSub[0];
    if (Number(u.activo) !== 1 || u.bloqueado_en) return { ok: false, error: "Esta cuenta está desactivada." };
    await poolLegacy.query(`UPDATE auth_identities SET last_login_at = NOW() WHERE provider='google' AND provider_user_id = ?`, [carga.sub]);
    await poolNuevo.query(
      `INSERT INTO auth_metricas (clave, valor, actualizado) VALUES ('google_login', 1, NOW())
       ON DUPLICATE KEY UPDATE valor = valor + 1, actualizado = NOW()`,
    ).catch(() => undefined);
    return { ok: true, usuarioId: Number(u.user_id), nuevo: false, vinculado: false, rol: String(u.rol) };
  }

  if (!email) return { ok: false, error: "Google no ha facilitado un correo para esta cuenta." };

  const [porEmail] = await poolLegacy.query<any[]>(
    `SELECT id, rol, activo, bloqueado_en, COALESCE(nombre_mostrado, nombre, apellidos) AS nombre, avatar_url
       FROM usuario WHERE LOWER(email) = ? LIMIT 1`,
    [email],
  );

  if (porEmail[0]) {
    const u = porEmail[0];
    if (Number(u.activo) !== 1 || u.bloqueado_en) return { ok: false, error: "Esta cuenta está desactivada." };
    // Vincular con la cuenta que ya existe. Solo con correo verificado por Google: si no lo está,
    // cualquiera podría reclamar la cuenta de otra persona creando un Google con ese correo.
    if (!verificado) {
      return { ok: false, error: "Tu correo de Google no está verificado, así que no se puede vincular con una cuenta existente." };
    }
    await poolLegacy.query(
      `INSERT INTO auth_identities (user_id, provider, provider_user_id, provider_email, created_at, last_login_at)
       VALUES (?, 'google', ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE provider_email = VALUES(provider_email), last_login_at = NOW()`,
      [Number(u.id), carga.sub, email],
    );
    // El avatar de Google solo se guarda si la cuenta aún no tiene uno: no se pisa lo que puso la persona.
    if (!u.avatar_url && carga.picture) {
      await poolLegacy.query(`UPDATE usuario SET avatar_url = ? WHERE id = ?`, [String(carga.picture).slice(0, 512), Number(u.id)]);
    }
    return { ok: true, usuarioId: Number(u.id), nuevo: false, vinculado: true, rol: String(u.rol) };
  }

  // Cuenta nueva: rol de huésped, sin contraseña (Google es quien autentica), correo verificado.
  const nombre = String(carga.name ?? carga.given_name ?? email.split("@")[0]).slice(0, 191);
  const [res] = await poolLegacy.query<any>(
    `INSERT INTO usuario (email, nombre, nombre_mostrado, pass_hash, rol, avatar_url, verificado_en, activo, creado_en)
     VALUES (?, ?, ?, NULL, 'huesped', ?, NOW(), 1, NOW())`,
    [email, nombre, nombre, carga.picture ? String(carga.picture).slice(0, 512) : null],
  );
  const nuevoId = Number(res.insertId);
  await poolLegacy.query(
    `INSERT INTO auth_identities (user_id, provider, provider_user_id, provider_email, created_at, last_login_at)
     VALUES (?, 'google', ?, ?, NOW(), NOW())`,
    [nuevoId, carga.sub, email],
  );
  return { ok: true, usuarioId: nuevoId, nuevo: true, vinculado: false, rol: "huesped" };
}
