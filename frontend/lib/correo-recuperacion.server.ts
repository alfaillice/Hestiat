import { enviarCorreo } from "@/lib/correo.server";

/**
 * Correo del enlace de recuperación.
 *
 * Reutiliza `enviarCorreo` (una sola forma de mandar correo en el proyecto) y NO registra el testigo
 * en ningún sitio: si el envío falla, se anota el motivo, nunca el enlace.
 */
function baseDelSitio(): string {
  return (process.env.HESTIAT_BASE_URL ?? "https://hestiat.com").trim().replace(/\/+$/, "");
}

export async function enviarEnlaceRecuperacion(datos: { para: string; nombre?: string | null; token: string }): Promise<{ ok: boolean; motivo?: string }> {
  const enlace = `${baseDelSitio()}/restablecer/${datos.token}`;
  const saludo = datos.nombre ? `Hola ${datos.nombre}:` : "Hola:";
  const texto = [
    saludo,
    "",
    "Has pedido poner una contraseña nueva en Hestiat. Abre este enlace:",
    enlace,
    "",
    "El enlace solo se puede usar una vez y caduca en una hora.",
    "Si no has pedido tú este cambio, ignora este mensaje: tu contraseña no se ha tocado.",
    "",
    "Hestiat",
  ].join("\n");
  const html = `<p>${saludo}</p><p>Has pedido poner una contraseña nueva en Hestiat. Pulsa aquí:</p><p><a href="${enlace}">Poner una contraseña nueva</a></p><p>El enlace solo se puede usar una vez y caduca en una hora.</p><p>Si no has pedido tú este cambio, ignora este mensaje: tu contraseña no se ha tocado.</p><p>Hestiat</p>`;
  const r = await enviarCorreo({ para: datos.para, asunto: "Pon una contraseña nueva en Hestiat", texto, html, responderA: "hola@hestiat.com" });
  if (!r.ok) return { ok: false, motivo: r.motivo };
  return { ok: true };
}
