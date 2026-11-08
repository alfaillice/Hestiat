/**
 * TIPO DE IMAGEN POR BYTES DE CABECERA — módulo PURO, sin base de datos ni almacén.
 *
 * Vive aparte para poder probarlo con pruebas automatizadas y para que lo use el gestor de fotos
 * sin arrastrar dependencias de servidor.
 *
 * Se leen los primeros bytes, no lo que declare el navegador:
 *   · JPEG  → FF D8 FF
 *   · PNG   → 89 50 4E 47
 *   · WebP  → "RIFF" al principio y "WEBP" en los bytes 8-11
 */
export function tipoPorCabecera(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff === "RIFF" && webp === "WEBP") return "webp";
  return null;
}

/** Nombre corto para mostrar. */
export function nombreDeTipoFormato(t: "jpg" | "png" | "webp"): string {
  return t === "jpg" ? "JPEG" : t.toUpperCase();
}
