/**
 * Autoalta de anfitrión — SOLO servidor.
 *
 * Antes, ser anfitrión exigía que un administrador te vinculara a mano. Ahora un usuario registrado
 * puede solicitarlo y activarlo por su cuenta.
 *
 * VERIFICACIÓN POR CORREO:
 *  · Si el servidor tiene SMTP configurado, la cuenta **no se activa al enviar el formulario**: se
 *    crea un token, se manda un enlace al correo y el rol cambia **solo cuando esa persona abre el
 *    enlace**. Así nadie puede darse de alta como anfitrión con el correo de otro.
 *  · Si NO hay SMTP, no se finge: la cuenta se activa igualmente y la interfaz lo dice. Un
 *    formulario que no funciona porque falta una credencial es peor producto que uno que funciona
 *    y lo explica.
 *
 * El rol solo va de `huesped` a `anfitrion`. Nunca se alcanza `admin` por esta vía, y una cuenta
 * que ya es anfitrión o admin no se degrada.
 */
import { randomBytes } from "node:crypto";
import { poolLegacy } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth.server";
import { enviarCorreo, smtpConfigurado } from "@/lib/correo.server";

const BASE = process.env.APP_URL?.trim() || "https://hestiat.com";
const HORAS_VALIDEZ = 48;

let esquema: Promise<void> | undefined;

export async function asegurarEsquemaAnfitrion(): Promise<void> {
  if (!esquema) {
    esquema = (async () => {
      await poolLegacy.query(
        `CREATE TABLE IF NOT EXISTS solicitud_anfitrion (
           id INT UNSIGNED NOT NULL AUTO_INCREMENT,
           usuario_id BIGINT UNSIGNED NOT NULL,
           email VARCHAR(191) NOT NULL,
           telefono VARCHAR(32) NULL,
           localidad VARCHAR(128) NULL,
           motivacion TEXT NULL,
           estado VARCHAR(24) NOT NULL DEFAULT 'activada',
           creado_en DATETIME NOT NULL,
           PRIMARY KEY (id),
           KEY idx_usuario (usuario_id)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );
      await poolLegacy.query(
        `CREATE TABLE IF NOT EXISTS verificacion_correo (
           id INT UNSIGNED NOT NULL AUTO_INCREMENT,
           usuario_id BIGINT UNSIGNED NOT NULL,
           tipo VARCHAR(24) NOT NULL,
           token CHAR(64) NOT NULL,
           expira_en DATETIME NOT NULL,
           usado_en DATETIME NULL,
           creado_en DATETIME NOT NULL,
           PRIMARY KEY (id),
           UNIQUE KEY uq_token (token),
           KEY idx_usuario_tipo (usuario_id, tipo)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );
    })().catch((e) => {
      esquema = undefined;
      throw e;
    });
  }
  return esquema;
}

export type ResultadoAnfitrion =
  | { ok: true; verificacion: boolean }
  | { ok: false; error: string };

function correoVerificacion(enlace: string, nombre: string): string {
  return [
    `Hola ${nombre}:`,
    "",
    "Has pedido publicar tu alojamiento en Hestiat. Para activar tu cuenta de anfitrión, abre este enlace:",
    "",
    enlace,
    "",
    `El enlace caduca en ${HORAS_VALIDEZ} horas. Si no has pedido esto, ignora este mensaje: no se ha activado nada.`,
    "",
    "Un recordatorio: en Hestiat no cobramos comisiones.",
    "",
    "— Hestiat",
  ].join("\n");
}

export async function solicitar(formulario: FormData): Promise<ResultadoAnfitrion> {
  await asegurarEsquemaAnfitrion();

  const sesion = await getCurrentUser();
  if (!sesion) return { ok: false, error: "Necesitas una cuenta para publicar tu alojamiento." };

  const telefono = String(formulario.get("telefono") ?? "").trim();
  const localidad = String(formulario.get("localidad") ?? "").trim();
  const motivacion = String(formulario.get("motivacion") ?? "").trim();

  if (telefono.replace(/\D/g, "").length < 9) return { ok: false, error: "Necesitamos un teléfono para poder contactarte." };
  if (localidad.length < 3) return { ok: false, error: "Indica en qué localidad está tu alojamiento." };
  if (formulario.get("condiciones") !== "1") return { ok: false, error: "Tienes que aceptar las condiciones para publicar." };

  const [filas] = await poolLegacy.query<any[]>(`SELECT rol, nombre FROM usuario WHERE id = ? LIMIT 1`, [sesion.id]);
  const yo = filas[0];
  if (!yo) return { ok: false, error: "Cuenta no encontrada." };
  const rolActual = String(yo.rol ?? "");
  if (rolActual === "admin") return { ok: true, verificacion: false }; // ya puede publicar

  // Si se exige verificación (`ANFITRION_VERIFICACION=obligatoria`) y no hay correo saliente, NO se
  // activa a nadie: se avisa. Es preferible un formulario que dice por qué no funciona que una
  // activación silenciosa saltándose la verificación.
  const exigirVerificacion = (process.env.ANFITRION_VERIFICACION ?? "").trim() === "obligatoria";
  const conVerificacion = smtpConfigurado();
  if (exigirVerificacion && !conVerificacion) {
    return { ok: false, error: "La verificación por correo está activada pero este servidor no tiene correo saliente configurado. Avisa a soporte." };
  }

  // Si hay SMTP, se manda el enlace y NO se activa todavía.
  if (conVerificacion) {
    const token = randomBytes(32).toString("hex");
    await poolLegacy.query(
      `INSERT INTO verificacion_correo (usuario_id, tipo, token, expira_en, creado_en)
       VALUES (?, 'anfitrion', ?, DATE_ADD(NOW(), INTERVAL ? HOUR), NOW())`,
      [sesion.id, token, HORAS_VALIDEZ],
    );
    await poolLegacy.query(
      `INSERT INTO solicitud_anfitrion (usuario_id, email, telefono, localidad, motivacion, estado, creado_en)
       VALUES (?,?,?,?,?, 'pendiente_verificacion', NOW())`,
      [sesion.id, sesion.email, telefono.slice(0, 32), localidad.slice(0, 128), motivacion.slice(0, 4000) || null],
    );

    const enlace = `${BASE}/verificar?token=${token}`;
    const envio = await enviarCorreo({
      para: sesion.email,
      asunto: "Activa tu cuenta de anfitrión en Hestiat",
      texto: correoVerificacion(enlace, String(yo.nombre ?? "")),
    });

    if (!envio.ok) {
      // No se activa nada si el correo no ha salido: si no, la verificación sería un adorno.
      return { ok: false, error: "No hemos podido enviar el correo de confirmación. Inténtalo de nuevo en unos minutos." };
    }
    return { ok: true, verificacion: true };
  }

  // Sin SMTP configurado: se activa directamente y la interfaz lo explica.
  if (rolActual === "huesped") {
    await poolLegacy.query(`UPDATE usuario SET rol = 'anfitrion' WHERE id = ? AND rol = 'huesped'`, [sesion.id]);
  }
  await poolLegacy.query(
    `INSERT INTO solicitud_anfitrion (usuario_id, email, telefono, localidad, motivacion, estado, creado_en)
     VALUES (?,?,?,?,?, 'activada', NOW())`,
    [sesion.id, sesion.email, telefono.slice(0, 32), localidad.slice(0, 128), motivacion.slice(0, 4000) || null],
  );
  return { ok: true, verificacion: false };
}

export type ResultadoVerificacion = { ok: true } | { ok: false; error: string };

export async function verificar(token: string): Promise<ResultadoVerificacion> {
  await asegurarEsquemaAnfitrion();
  if (!/^[a-f0-9]{64}$/.test(token)) return { ok: false, error: "Enlace no válido." };

  const [filas] = await poolLegacy.query<any[]>(
    `SELECT id, usuario_id, expira_en, usado_en FROM verificacion_correo
      WHERE token = ? AND tipo = 'anfitrion' LIMIT 1`,
    [token],
  );
  const v = filas[0];
  if (!v) return { ok: false, error: "Este enlace no existe o ya se ha usado." };
  if (v.usado_en) return { ok: false, error: "Este enlace ya se ha usado. Entra en tu cuenta y comprueba el estado." };
  if (new Date(String(v.expira_en).replace(" ", "T")) < new Date()) {
    return { ok: false, error: "El enlace ha caducado. Vuelve a solicitarlo desde «Publica tu espacio»." };
  }

  const conn = await poolLegacy.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE usuario SET rol = 'anfitrion' WHERE id = ? AND rol = 'huesped'`, [Number(v.usuario_id)]);
    await conn.query(`UPDATE verificacion_correo SET usado_en = NOW() WHERE id = ?`, [Number(v.id)]);
    await conn.query(`UPDATE solicitud_anfitrion SET estado = 'activada' WHERE usuario_id = ? ORDER BY id DESC LIMIT 1`, [Number(v.usuario_id)]);
    await conn.commit();
    return { ok: true };
  } catch (error) {
    await conn.rollback();
    console.error("[hestiat] verificar", error);
    return { ok: false, error: "No se ha podido activar la cuenta. Inténtalo de nuevo." };
  } finally {
    conn.release();
  }
}

export async function datosSolicitud(usuarioId: number) {
  await asegurarEsquemaAnfitrion();
  const [filas] = await poolLegacy.query<any[]>(
    `SELECT id, localidad, telefono, estado, creado_en FROM solicitud_anfitrion WHERE usuario_id = ? ORDER BY id DESC LIMIT 1`,
    [usuarioId],
  );
  return filas[0] ?? null;
}
