/**
 * Utilidad pura (sin acceso a datos) para pedir imágenes a un tamaño razonable.
 *
 * Las fotos del catálogo vienen de fuentes externas con `?width=1600`: unos 800 KB cada una. En una
 * galería de 42 tarjetas eso son más de 30 MB. Aquí se pide la variante pequeña a la propia fuente,
 * que es justo lo que ese parámetro permite, en lugar de descargar la grande y encogerla.
 */
export function miniatura(url: string | null | undefined, ancho: number): string {
  if (!url) return "";
  if (/[?&]width=\d+/.test(url)) return url.replace(/([?&]width=)\d+/, `$1${ancho}`);
  return url;
}

/** Una imagen es «propia» solo si vive en nuestro almacenamiento, no en un sitio de terceros. */
export function esExterna(url: string | null | undefined): boolean {
  if (!url) return false;
  return !url.includes(".r2.dev");
}
