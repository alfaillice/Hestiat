import { urlPropia } from "@/lib/imagen-propia";

/**
 * Utilidad pura (sin acceso a datos) para pedir imágenes a un tamaño razonable.
 *
 * Las fotos del catálogo vienen de fuentes externas con `?width=1600`: unos 800 KB cada una. En una
 * galería de 42 tarjetas eso son más de 30 MB. Aquí se pide la variante pequeña, en lugar de
 * descargar la grande y encogerla.
 *
 * Y desde el 12-10-2026 hay un paso más, que resuelve un problema medido: las fotos de experiencias,
 * servicios y destinos se cargaban DIRECTAMENTE desde Wikimedia, que limita las peticiones (se midió
 * un `429`) y añade latencia ajena. Ahora esas direcciones se pintan pasando por nuestra casa
 * (`/api/imagen-propia`), que sirve la copia desde nuestro almacén y la guarda la primera vez.
 * Las que YA son nuestras (R2, CloudFront) se dejan intactas: aquí no se envuelve lo que ya es propio.
 */
export function miniatura(url: string | null | undefined, ancho: number): string {
  if (!url) return "";
  const conTamano = /[?&]width=\d+/.test(url) ? url.replace(/([?&]width=)\d+/, `$1${ancho}`) : url;
  return urlPropia(conTamano, ancho);
}

/** Una imagen es «propia» solo si vive en nuestro almacenamiento, no en un sitio de terceros. */
export function esExterna(url: string | null | undefined): boolean {
  if (!url) return false;
  return !url.includes(".r2.dev");
}
