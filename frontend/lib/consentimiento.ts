/**
 * CONSENTIMIENTO DE COOKIES — decisión del visitante, en un solo sitio.
 *
 * ── QUÉ GUARDA Y DÓNDE ──────────────────────────────────────────────────────────────────────────
 * Guarda UNA palabra: «aceptado» o «rechazado». Se guarda en `localStorage`, NO en una cookie, para
 * no crear una cookie nueva mientras se pide permiso sobre las cookies. No se guarda fecha, ni IP,
 * ni identificador: solo la elección, para no volver a preguntar en cada página.
 *
 * ── POR QUÉ HACE FALTA ──────────────────────────────────────────────────────────────────────────
 * La política de cookies publicada dice que las cookies publicitarias de Google solo se cargan si el
 * visitante las acepta. Esto es lo que hace que esa frase sea verdad: mientras no haya aceptación,
 * los bloques de anuncio no piden nada a Google ni se pintan.
 *
 * ── CÓMO SE COMUNICA ────────────────────────────────────────────────────────────────────────────
 * Con dos eventos del navegador, para que no haya que recargar la página:
 *   · `hestiat:consentimiento` → ha cambiado la elección (los anuncios escuchan esto).
 *   · `hestiat:abrir-aviso`    → se pide volver a mostrar el aviso (lo usa el enlace del pie).
 */

export type Eleccion = "aceptado" | "rechazado";

const CLAVE = "hestiat_cookies";
export const EVENTO_CAMBIO = "hestiat:consentimiento";
export const EVENTO_ABRIR = "hestiat:abrir-aviso";

/** La elección guardada, o `null` si todavía no ha decidido. */
export function leerConsentimiento(): Eleccion | null {
  try {
    const v = window.localStorage.getItem(CLAVE);
    return v === "aceptado" || v === "rechazado" ? v : null;
  } catch {
    return null;
  }
}

/** Guarda la elección y avisa a quien esté escuchando. */
export function guardarConsentimiento(eleccion: Eleccion): void {
  try {
    window.localStorage.setItem(CLAVE, eleccion);
    window.dispatchEvent(new Event(EVENTO_CAMBIO));
  } catch {
    /* Si el navegador no deja guardar, la elección vale para esta página y ya está. */
  }
}

/** Avisa de que el visitante quiere volver a ver el aviso (para cambiar de opinión). */
export function pedirAbrirAviso(): void {
  try {
    window.dispatchEvent(new Event(EVENTO_ABRIR));
  } catch {
    /* nada */
  }
}
