import { createHash } from "node:crypto";

/**
 * REGLAS DE LA RECUPERACIÓN DE ACCESO.
 *
 * Este fichero no depende de nada del proyecto (ni base de datos, ni correo, ni sesiones): solo de
 * `node:crypto`. Está así a propósito, para que las reglas que deciden si un enlace vale y qué
 * contraseña se acepta se puedan probar **sin servidor y sin base de datos**.
 *
 * Todo lo demás —la tabla, el envío del correo, el cambio en la base— vive en `recuperacion.server`.
 */

/** Minutos de validez del enlace. */
export const MINUTOS_VALIDEZ = 60;
/** Longitud mínima de la contraseña nueva. */
export const LARGO_MINIMO_PASSWORD = 8;
/** Enlaces que se pueden pedir para un mismo correo por hora. */
export const MAX_SOLICITUDES_POR_HORA = 3;

/**
 * Huella del testigo. En la base se guarda esto, nunca el testigo en claro: si alguien leyera la
 * tabla no podría usarlo para entrar. El testigo en claro solo existe en el correo.
 */
export function huellaDelToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** ¿Tiene la forma de un testigo nuestro? Se comprueba antes de tocar la base. */
export function tokenPlausible(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token);
}

/** Reglas de la contraseña nueva, en un solo sitio. Devuelve el motivo o null si está bien. */
export function revisarPasswordNueva(a: string, b: string): string | null {
  if (!a || a.length < LARGO_MINIMO_PASSWORD) {
    return `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`;
  }
  if (a !== b) return "Las dos contraseñas no coinciden.";
  return null;
}

/** Dirección pública del sitio, configurable por entorno. */
export function baseDelSitio(): string {
  return (process.env.HESTIAT_BASE_URL ?? "https://hestiat.com").trim().replace(/\/+$/, "");
}

/** Enlace que recibe la persona. Puro: no envía nada. */
export function enlaceDeRecuperacion(token: string): string {
  return `${baseDelSitio()}/restablecer/${token}`;
}

/** Texto del correo. Puro: se puede probar sin mandar ningún mensaje. */
export function textoDeRecuperacion(enlace: string, nombre?: string | null): string {
  const saludo = nombre ? `Hola ${nombre}:` : "Hola:";
  return [
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
}

/** Versión con formato del correo. Pura, igual que el texto. */
export function htmlDeRecuperacion(enlace: string, nombre?: string | null): string {
  const saludo = nombre ? `Hola ${nombre}:` : "Hola:";
  return `<p>${saludo}</p><p>Has pedido poner una contraseña nueva en Hestiat. Pulsa aquí:</p><p><a href="${enlace}">Poner una contraseña nueva</a></p><p>El enlace solo se puede usar una vez y caduca en una hora.</p><p>Si no has pedido tú este cambio, ignora este mensaje: tu contraseña no se ha tocado.</p><p>Hestiat</p>`;
}
