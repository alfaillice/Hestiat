/**
 * Almacenamiento de las imágenes que suben los usuarios — SOLO servidor.
 *
 * Sustituye la carpeta local `uploads/` (dentro del docroot, sin CDN ni caché
 * inmutable) por Cloudflare R2 mediante su API S3 (`./r2.server`).
 *
 * Reglas que no se negocian:
 *  - La clave del objeto es el hash de su contenido: la misma imagen no se sube
 *    dos veces y su URL es inmutable (se puede cachear para siempre).
 *  - Si R2 no está configurado se lanza un error legible: nunca se guarda a medias
 *    ni se devuelve un éxito falso.
 *  - Antes de borrar un objeto se comprueba que no lo use nadie más.
 */
import { borrarObjeto, clavePorContenido, configR2, subirObjeto } from "./r2.server";
import { optimizarImagen } from "./optimizar.server";
import { query } from "./db-legacy.server";

export { estadoAlmacenamiento } from "./r2.server";

/** Carpetas lógicas dentro del bucket. */
export const CARPETA_ALOJAMIENTOS = "alojamientos";
export const CARPETA_AVATARES = "avatares";

/** Extensiones admitidas y el tipo MIME con el que se firma y se sirve el objeto. */
export const TIPOS_IMAGEN: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export type ImagenGuardada = { url: string; clave: string; bytes: number };

/** Normaliza a extensión de fichero el tipo declarado en el data URL. */
export function extensionDeMime(mime: string): string | null {
  const m = mime.toLowerCase();
  if (m === "jpeg" || m === "jpg") return "jpg";
  if (m === "png") return "png";
  if (m === "webp") return "webp";
  return null;
}

/** Guarda una imagen en R2 y devuelve su URL pública y su clave. */
export async function guardarImagen(
  datos: Uint8Array,
  extension: string,
  carpeta: string,
): Promise<ImagenGuardada> {
  const tipo = TIPOS_IMAGEN[extension];
  if (!tipo) throw new Error(`Extensión de imagen no admitida: ${extension}.`);
  const clave = `${carpeta}/${clavePorContenido(datos, extension)}`;
  const r = await subirObjeto(clave, datos, tipo);
  return { url: r.url, clave: r.clave, bytes: r.bytes };
}

/** Base pública sin barra final, o `null` si R2 no está configurado. */
function basePublica(): string | null {
  const cfg = configR2();
  return cfg ? cfg.basePublica.replace(/\/+$/, "") : null;
}

/** ¿Esta URL la sirve nuestro bucket? (solo esas las podemos borrar nosotros). */
export function esUrlNuestra(url: string | null | undefined): boolean {
  const base = basePublica();
  return Boolean(base && url && url.startsWith(`${base}/`));
}

/** Clave del objeto a partir de su URL pública (`null` si no es nuestra). */
export function claveDeUrl(url: string | null | undefined): string | null {
  const base = basePublica();
  if (!base || !url || !url.startsWith(`${base}/`)) return null;
  return url.slice(base.length + 1);
}

/**
 * Borra un objeto nuestro. Nunca lanza: el borrado de un objeto no debe romper
 * la operación que el usuario sí ha pedido (cambiar la foto, por ejemplo).
 */
export async function borrarImagen(url: string | null | undefined): Promise<boolean> {
  const clave = claveDeUrl(url);
  if (!clave) return false;
  try {
    return await borrarObjeto(clave);
  } catch {
    return false;
  }
}

/**
 * Saca las URLs guardadas en el JSON de `alojamiento_foto.variantes`.
 *
 * Es imprescindible para no borrar imágenes vivas: si el barrido de huérfanos o la sustitución de
 * fotos no contaran las variantes, borrarían la versión optimizada que el sitio está sirviendo.
 */
export function urlsDeVariantes(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const datos = JSON.parse(json) as unknown;
    if (Array.isArray(datos)) return datos.filter((v): v is string => typeof v === "string");
    if (datos && typeof datos === "object") {
      return Object.values(datos as Record<string, unknown>).filter((v): v is string => typeof v === "string");
    }
  } catch {
    /* JSON ilegible: se ignora */
  }
  return [];
}

/* ----------------------------------------------------- versión optimizada --- */

export type VarianteGuardada = ImagenGuardada & {
  etiqueta: "original" | "completa" | "w800" | "w400";
  ancho: number;
  alto: number;
};

export type ImagenOptimizadaGuardada = {
  /** La que debe usarse como principal: la optimizada si se pudo, si no el original. */
  principal: VarianteGuardada;
  /** El original tal cual: el respaldo que nunca se pierde. */
  original: VarianteGuardada;
  /** Todo lo guardado, con su etiqueta, para poder borrarlo después sin dejar huérfanos. */
  variantes: VarianteGuardada[];
  aviso?: string;
};

/**
 * Sube el original y, además, una versión optimizada (redimensionada y recomprimida) más las
 * miniaturas. La principal pasa a ser la optimizada y el original queda como respaldo.
 *
 * Si no se puede decodificar la imagen, o falla la subida de una variante, se conserva el
 * original: la subida del usuario nunca falla por culpa de la optimización.
 */
export async function guardarImagenOptimizada(
  datos: Uint8Array,
  extension: string,
  carpeta: string,
): Promise<ImagenOptimizadaGuardada> {
  const original = await guardarImagen(datos, extension, carpeta);
  const optimizacion = optimizarImagen(datos, extension);
  const originalV: VarianteGuardada = { ...original, etiqueta: "original", ancho: 0, alto: 0 };
  if (!optimizacion) {
    return {
      principal: originalV,
      original: originalV,
      variantes: [originalV],
      aviso: "No se ha podido decodificar la imagen: se guarda solo el original.",
    };
  }

  const hash = original.clave.split("/").pop()?.split(".")[0] ?? "";
  const guardadas: VarianteGuardada[] = [originalV];
  for (const variante of optimizacion.variantes) {
    try {
      const clave = `${carpeta}/${hash}-${variante.etiqueta}.${variante.ext}`;
      const subida = await subirObjeto(clave, variante.datos, variante.tipo);
      guardadas.push({
        url: subida.url, clave: subida.clave, bytes: subida.bytes,
        etiqueta: variante.etiqueta, ancho: variante.ancho, alto: variante.alto,
      });
    } catch {
      /* una variante que falla no debe tumbar la subida del usuario */
    }
  }

  const principal = guardadas.find((g) => g.etiqueta === "completa") ?? originalV;
  if (principal.ancho === 0) {
    const conMedidas = guardadas.find((g) => g.etiqueta === "completa");
    if (conMedidas) return { principal: conMedidas, original: originalV, variantes: guardadas, aviso: optimizacion.aviso };
  }
  return { principal, original: originalV, variantes: guardadas, aviso: optimizacion.aviso };
}

/* ------------------------------------------------------- esquema (aditivo) --- */

let esquemaMedios: Promise<void> | undefined;

/**
 * Añade, si faltan, las columnas que necesita la optimización:
 *  - `alojamiento_foto.variantes`: JSON con las URLs de cada tamaño y del original.
 *  - `usuario.avatar_original`: el respaldo del avatar.
 *
 * Aditivo, idempotente y silencioso: se comprueba en `information_schema` antes de tocar nada y
 * un fallo aquí no debe impedir que alguien suba una foto.
 */
export async function asegurarColumnasMedios(): Promise<void> {
  if (!esquemaMedios) {
    esquemaMedios = (async () => {
      const existe = async (tabla: string, columna: string) => {
        const filas = await query<{ c: number }>(
          `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [tabla, columna],
        );
        return Number(filas[0]?.c ?? 0) > 0;
      };
      if (!(await existe("alojamiento_foto", "variantes"))) {
        await query("ALTER TABLE alojamiento_foto ADD COLUMN variantes TEXT NULL");
      }
      if (!(await existe("usuario", "avatar_original"))) {
        await query("ALTER TABLE usuario ADD COLUMN avatar_original VARCHAR(512) NULL");
      }
    })().catch(() => undefined);
  }
  await esquemaMedios;
}
