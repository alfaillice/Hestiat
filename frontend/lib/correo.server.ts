/**
 * Envío de correo — SOLO servidor.
 *
 * Las credenciales SMTP llegan SIEMPRE del entorno, nunca del código. Si no están configuradas,
 * esto NO falla en silencio devolviendo un éxito falso: devuelve `sin_smtp` y quien lo llame decide
 * qué hacer (en el autoalta de anfitrión, activar sin verificación y decirlo claramente).
 *
 * Variables que se leen:
 *   SMTP_HOST      servidor de correo saliente
 *   SMTP_PORT      587 (STARTTLS) o 465 (TLS directo)
 *   SMTP_USER      usuario
 *   SMTP_PASS      contraseña
 *   SMTP_FROM      remitente visible (por ejemplo "Hestiat <hola@hestiat.com>")
 *   SMTP_SECURE    "1" para TLS directo (puerto 465); por defecto STARTTLS
 */
import type { Transporter } from "nodemailer";

export interface ConfigSmtp {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

export function configSmtp(): ConfigSmtp | null {
  const host = (process.env.SMTP_HOST ?? "").trim();
  const user = (process.env.SMTP_USER ?? "").trim();
  const pass = (process.env.SMTP_PASS ?? "").trim();
  const from = (process.env.SMTP_FROM ?? "").trim();
  const port = Number((process.env.SMTP_PORT ?? "587").trim());
  if (!host || !user || !pass || !from) return null;
  return {
    host, port: Number.isFinite(port) ? port : 587, user, pass, from,
    secure: (process.env.SMTP_SECURE ?? "") === "1" || port === 465,
  };
}

export function smtpConfigurado(): boolean {
  return configSmtp() !== null;
}

/** Qué falta exactamente, para poder decirlo en un informe sin revelar valores. */
export function clavesSmtpQueFaltan(): string[] {
  const faltan: string[] = [];
  for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"]) {
    if (!(process.env[k] ?? "").trim()) faltan.push(k);
  }
  return faltan;
}

export type ResultadoCorreo = { ok: true } | { ok: false; motivo: "sin_smtp" | "error"; detalle?: string };

export async function enviarCorreo(entrada: {
  para: string;
  asunto: string;
  texto: string;
  html?: string;
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
    });
    await transporte.sendMail({
      from: cfg.from,
      to: entrada.para,
      subject: entrada.asunto,
      text: entrada.texto,
      html: entrada.html ?? entrada.texto.replace(/\n/g, "<br>"),
    });
    return { ok: true };
  } catch (error) {
    // Nunca se registra la contraseña ni el cuerpo del mensaje.
    const detalle = error instanceof Error ? error.message : "error desconocido";
    console.error("[hestiat] correo:", detalle.slice(0, 200));
    return { ok: false, motivo: "error", detalle };
  } finally {
    transporte?.close?.();
  }
}
