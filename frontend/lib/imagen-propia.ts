/**
 * IMÁGENES PROPIAS — módulo PURO (sin acceso a red ni a disco), usable desde servidor y navegador.
 *
 * ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────────────────────────────────
 * Las fotos de las tarjetas de experiencias, servicios y destinos se cargaban DIRECTAMENTE desde
 * Wikimedia. Eso trae dos males medidos:
 *   · Wikimedia limita las peticiones (se ha medido un `429`), y entonces la tarjeta se queda sin foto;
 *   · cada visita depende de un servidor ajeno, con lo que eso cuesta en velocidad.
 *
 * Con esto, la dirección que se pinta ya no apunta a Wikimedia: apunta a nuestra casa
 * (`/api/imagen-propia`), y la copia se guarda en nuestro almacén la primera vez. A partir de ahí se
 * sirve desde lo nuestro, rápida y sin límites.
 *
 * ── LO QUE **NO** HACE ──────────────────────────────────────────────────────────────────────────
 * No modifica la base de datos: el catálogo conserva sus direcciones originales. Solo cambia lo que
 * se pinta. Es reversible borrando una línea.
 */

/** Hosts de los que SÍ aceptamos traernos una copia. Lista blanca: evita que alguien use esto como
 *  puerta abierta a cualquier servidor. */
const HOSTS_PERMITIDOS = [
  "upload.wikimedia.org",
  "thumb.wikimedia.org",
  "commons.wikimedia.org",
  "wikipedia.org",
  "wikimedia.org",
];

/** ¿Es una dirección de la que queremos traernos una copia? */
export function sePuedeCopiar(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!/^https:\/\//i.test(url)) return false;
  const sinProtocolo = url.slice(8);
  const host = sinProtocolo.split("/")[0].split("?")[0].toLowerCase();
  return HOSTS_PERMITIDOS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Devuelve la dirección con la que se debe pintar una imagen.
 *
 * · Si es de un tercero del que podemos copiar → pasa por nuestra casa (`/api/imagen-propia`), que
 *   la sirve desde nuestro almacén y la copia la primera vez.
 * · Si ya es nuestra (nuestro R2, CloudFront) o no se puede copiar → se deja tal cual: aquí nadie
 *   inventa direcciones.
 */
export function urlPropia(url: string | null | undefined, ancho?: number): string {
  if (!url) return "";
  if (!sePuedeCopiar(url)) return url;
  const parametros = new URLSearchParams({ u: url });
  if (ancho && ancho > 0) parametros.set("w", String(Math.round(ancho)));
  return `/api/imagen-propia?${parametros.toString()}`;
}
