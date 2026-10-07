/**
 * Envío de correo — SOLO servidor.
 *
 * Las credenciales SMTP llegan SIEMPRE del entorno, nunca del código. Si no están configuradas,
 * esto NO falla en silencio devolviendo un éxito falso: devuelve `sin_smtp` y quien lo llame decide
 * qué hacer (en el autoalta de anfitrión, activar sin verificación y decirlo claramente).
 *
 * Variables que se leen (ninguna tiene valor por defecto inventado):
 *   SMTP_HOST      servidor de correo saliente
 *   SMTP_PORT      465 (TLS directo) o 587 (STARTTLS)
 *   SMTP_USER      usuario
 *   SMTP_PASSWORD  contraseña. También se acepta el nombre antiguo SMTP_PASS.
 *   SMTP_FROM      remitente visible (por ejemplo "Hestiat <hola@hestiat.com>")
 *   SMTP_SECURE    "true"/"1"/"yes" para TLS directo; si el puerto es 465 se deduce solo
 *   SMTP_REPLY_TO  respuesta por defecto, opcional (si no se indica, no se pone ninguna)
 *
 * SEGURIDAD: la contraseña no se escribe nunca en un registro ni en una respuesta. Los mensajes de
 * error del servidor de correo se censuran antes de registrarse, por si el servidor los reflejara.
 */
import type { Transporter } from "nodemailer";

export interface ConfigSmtp {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
  replyTo: string | null;
}

/** "true", "1", "yes", "sí" cuentan como verdadero. Cualquier otra cosa, falso. */
function aBooleano(valor: string | undefined): boolean {
  return ["1", "true", "yes", "si", "sí", "on"].includes((valor ?? "").trim().toLowerCase());
}

export function configSmtp(): ConfigSmtp | null {
  const host = (process.env.SMTP_HOST ?? "").trim();
  const user = (process.env.SMTP_USER ?? "").trim();
  // Se admiten los dos nombres: SMTP_PASSWORD (el que se documenta) y SMTP_PASS (el que se usó
  // antes). Nunca se inventa un valor: si no hay ninguno de los dos, no hay configuración.
  const pass = ((process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS) ?? "").trim();
  const from = (process.env.SMTP_FROM ?? "").trim();
  const port = Number((process.env.SMTP_PORT ?? "").trim());
  if (!host || !user || !pass || !from) return null;
  const puerto = Number.isFinite(port) && port > 0 ? port : 587;
  return {
    host,
    port: puerto,
    user,
    pass,
    from,
    secure: aBooleano(process.env.SMTP_SECURE) || puerto === 465,
    replyTo: (process.env.SMTP_REPLY_TO ?? "").trim() || null,
  };
}

export function smtpConfigurado(): boolean {
  return configSmtp() !== null;
}

/** Qué falta exactamente, para poder decirlo en un informe sin revelar valores. */
export function clavesSmtpQueFaltan(): string[] {
  const faltan: string[] = [];
  if (!(process.env.SMTP_HOST ?? "").trim()) faltan.push("SMTP_HOST");
  if (!(process.env.SMTP_USER ?? "").trim()) faltan.push("SMTP_USER");
  // Una sola pregunta para las dos formas del nombre: basta con que exista una.
  if (!((process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS) ?? "").trim()) faltan.push("SMTP_PASSWORD");
  if (!(process.env.SMTP_FROM ?? "").trim()) faltan.push("SMTP_FROM");
  return faltan;
}

/**
 * Censura cualquier rastro de la contraseña en un texto antes de registrarlo.
 *
 * No es paranoia: un cliente SMTP puede incluir en su error la línea que envió o recibió, y en el
 * peor caso esa línea podría contener la contraseña o su forma en base64 (AUTH PLAIN la manda así).
 * Sustituimos las dos formas, que están en memoria en ese momento, por "[oculto]".
 */
function censurar(texto: string, cfg: ConfigSmtp): string {
  let t = texto;
  const formas = new Set<string>();
  formas.add(cfg.pass);
  formas.add(cfg.user);
  for (const forma of [cfg.pass, `${cfg.user}:${cfg.pass}`]) {
    try {
      const b64 = Buffer.from(forma, "utf8").toString("base64");
      if (b64.length >= 8) formas.add(b64);
    } catch {
      /* si no se puede codificar, no hay nada que sustituir */
    }
  }
  for (const forma of formas) {
    if (!forma || forma.length < 4) continue;
    t = t.split(forma).join("[oculto]");
  }
  return t.slice(0, 300);
}

export type ResultadoCorreo = { ok: true } | { ok: false; motivo: "sin_smtp" | "error"; detalle?: string };

export async function enviarCorreo(entrada: {
  /** Uno o varios destinatarios visibles. */
  para: string | string[];
  asunto: string;
  texto: string;
  html?: string;
  /** A quién responde el destinatario si pulsa «Responder». */
  responderA?: string | null;
  /** Copias ocultas (se usan, por ejemplo, para la copia interna de Hestiat). */
  copiaOculta?: string | null;
}): Promise<ResultadoCorreo> {
  const cfg = configSmtp();
  if (!cfg) return { ok: false, motivo: "sin_smtp" };

  let transporte: Transporter | null = null;
  try {
    const { createTransport } = await import("nodemailer");
    transporte = createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    await transporte.sendMail({
      from: cfg.from,
      to: Array.isArray(entrada.para) ? entrada.para.join(", ") : entrada.para,
      replyTo: entrada.responderA || cfg.replyTo || undefined,
      bcc: entrada.copiaOculta || undefined,
      subject: entrada.asunto,
      text: entrada.texto,
      html: entrada.html ?? entrada.texto.replace(/\n/g, "<br>"),
    });
    return { ok: true };
  } catch (error) {
    // Nunca se registra la contraseña ni el cuerpo del mensaje: solo el motivo, censurado.
    const bruto = error instanceof Error ? error.message : "error desconocido";
    const detalle = censurar(bruto, cfg);
    console.error("[hestiat] correo:", detalle);
    return { ok: false, motivo: "error", detalle };
  } finally {
    transporte?.close?.();
  }
}
