import { enviarCorreo } from "@/lib/correo.server";
import { enlaceDeRecuperacion, textoDeRecuperacion, htmlDeRecuperacion } from "@/lib/recuperacion-reglas";

/**
 * Correo del enlace de recuperación.
 *
 * Reutiliza `enviarCorreo` (una sola forma de mandar correo en el proyecto) y NO registra el testigo
 * en ningún sitio: si el envío falla, se anota el motivo, nunca el enlace.
 */
export async function enviarEnlaceRecuperacion(datos: { para: string; nombre?: string | null; token: string }): Promise<{ ok: boolean; motivo?: string }> {
  const enlace = enlaceDeRecuperacion(datos.token);
  const texto = textoDeRecuperacion(enlace, datos.nombre);
  const html = htmlDeRecuperacion(enlace, datos.nombre);
  const r = await enviarCorreo({ para: datos.para, asunto: "Pon una contraseña nueva en Hestiat", texto, html, responderA: "hola@hestiat.com" });
  if (!r.ok) return { ok: false, motivo: r.motivo };
  return { ok: true };
}
