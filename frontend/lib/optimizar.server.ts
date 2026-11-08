/**
 * Optimización de las imágenes que suben los usuarios — SOLO servidor.
 *
 * Qué hace y por qué así:
 *  - **Redimensiona** a un ancho máximo (`ANCHO_MAX`) y genera **miniaturas** de 400 y 800 px.
 *  - **Recomprime**: el formato de salida es WebP cuando hay códec disponible (mejor relación
 *    tamaño/calidad y soporte universal en navegadores) y JPEG/PNG si no.
 *  - El **original nunca se pierde**: se sube tal cual y queda como respaldo.
 *
 * El códec WebP es `@silvia-odwyer/photon-node` (wasm), que **no se puede empaquetar** en el
 * bundle del servidor: es CommonJS y carga su wasm con `readFileSync(__dirname + …)`. Por eso se
 * carga en tiempo de ejecución con `createRequire` desde una carpeta propia (`vendor/photon`), y si
 * no está, el módulo sigue funcionando con el camino puro-JS (`jpeg-js` + `pngjs`).
 *
 * No se lanzan procesos externos: en este alojamiento `spawn` falla con `EAGAIN`.
 */
import { createRequire } from "node:module";

import * as moduloJpeg from "jpeg-js";
import * as moduloPng from "pngjs";

/**
 * Los dos paquetes son CommonJS y su interoperabilidad con el empaquetador no es la misma en
 * todos los entornos: según cómo se resuelva, lo que exportan llega en `default` o directamente.
 * Se accede siempre por estas funciones, que toleran las dos formas, y así un problema de
 * interoperabilidad solo puede afectar a la optimización, nunca al arranque de la aplicación.
 */
type CodecJpeg = {
  decode: (b: Buffer, o?: unknown) => { data: Uint8Array; width: number; height: number };
  encode: (d: { data: Buffer; width: number; height: number }, q: number) => { data: Buffer };
};
type CodecPng = {
  PNG: { sync: { read: (b: Buffer) => { data: Uint8Array; width: number; height: number }; write: (d: unknown, o?: unknown) => Buffer } };
};
function jpeg(): CodecJpeg {
  const m = moduloJpeg as unknown as { default?: CodecJpeg } & CodecJpeg;
  return m.default ?? m;
}
function png(): CodecPng {
  const m = moduloPng as unknown as { default?: CodecPng } & CodecPng;
  return m.default ?? m;
}

/** ¿Los bytes empiezan por «WEBP»? (sin depender de iterar el Uint8Array). */
function esWebp(buf: Uint8Array): boolean {
  return buf.length > 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
}

/** Ancho máximo de la versión «completa». */
export const ANCHO_MAX = 1600;
/** Anchos de las miniaturas, de mayor a menor. */
export const ANCHOS_MINIATURA = [800, 400];

export type Variante = {
  etiqueta: "completa" | "w800" | "w400";
  datos: Uint8Array;
  tipo: string;
  ext: string;
  ancho: number;
  alto: number;
};

export type Optimizacion = {
  ancho: number;
  alto: number;
  variantes: Variante[];
  codec: "photon" | "js";
  aviso?: string;
};

/* --------------------------------------------------------------- códec WebP --- */

type Photon = {
  PhotonImage: { new_from_byteslice: (b: Uint8Array) => unknown };
  resize: (img: unknown, w: number, h: number, filtro: unknown) => unknown;
  SamplingFilter: { Lanczos3: unknown };
};

let photonCache: Photon | null | undefined;
let photonDiagnostico: { cargado: boolean; ruta: string | null; errores: string[] } = {
  cargado: false,
  ruta: null,
  errores: [],
};

/**
 * Carga el códec WebP desde `vendor/photon` (ruta configurable con `HESTIAT_PHOTON_DIR`).
 *
 * Se hace con `createRequire` sobre una ruta calculada en ejecución, de forma que el empaquetador
 * no intenta incluirlo y el fallo (si no está) no rompe nada. Se prueban varias ubicaciones y se
 * guarda el error real de cada una para poder diagnosticarlo desde el endpoint de mantenimiento.
 */
export function cargarPhoton(): Photon | null {
  if (photonCache !== undefined) return photonCache;
  const candidatos = [
    process.env["HESTIAT_PHOTON_DIR"],
    `${process.cwd()}/vendor/photon`,
    `${process.cwd()}/../vendor/photon`,
  ].filter((d): d is string => Boolean(d));
  const errores: string[] = [];
  const requerir = createRequire(import.meta.url);
  for (const dir of candidatos) {
    try {
      const bruto = requerir(`${dir}/photon_rs.js`) as { default?: Photon } & Photon;
      const modulo = (bruto.default ?? bruto) as Photon;
      // Ojo: las clases que genera wasm-bindgen son `function`, no `object`; comprobar
      // solo "object" descartaba un módulo perfectamente válido.
      const tipoPhoton = typeof (modulo as { PhotonImage?: unknown }).PhotonImage;
      if (tipoPhoton !== "object" && tipoPhoton !== "function") {
        errores.push(`${dir}: el módulo no expone PhotonImage`);
        continue;
      }
      photonCache = modulo;
      photonDiagnostico = { cargado: true, ruta: `${dir}/photon_rs.js`, errores: [] };
      return photonCache;
    } catch (e) {
      errores.push(`${dir}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  photonCache = null;
  photonDiagnostico = { cargado: false, ruta: null, errores };
  return null;
}

/** Estado del códec WebP, para el diagnóstico (sin exponer nada sensible). */
export function estadoPhoton(): { cargado: boolean; ruta: string | null; errores: string[] } {
  cargarPhoton();
  return photonDiagnostico;
}

/* ------------------------------------------------------------------ redimension --- */

type Bitmap = { data: Uint8Array; width: number; height: number };

/**
 * Reduce por media de bloques (filtro de caja). Para reducir es el método correcto: promedia los
 * píxeles de origen que caen en cada destino, así que no pierde detalle por muestreo.
 */
export function reducir(origen: Bitmap, anchoDestino: number): Bitmap {
  const altoDestino = Math.max(1, Math.round((origen.height * anchoDestino) / origen.width));
  if (anchoDestino >= origen.width) return { ...origen, width: origen.width, height: origen.height };
  const salida = new Uint8Array(anchoDestino * altoDestino * 4);
  const escalaX = origen.width / anchoDestino;
  const escalaY = origen.height / altoDestino;
  for (let y = 0; y < altoDestino; y++) {
    const y0 = Math.floor(y * escalaY);
    const y1 = Math.min(origen.height, Math.max(y0 + 1, Math.floor((y + 1) * escalaY)));
    for (let x = 0; x < anchoDestino; x++) {
      const x0 = Math.floor(x * escalaX);
      const x1 = Math.min(origen.width, Math.max(x0 + 1, Math.floor((x + 1) * escalaX)));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (origen.width * sy + sx) * 4;
          r += origen.data[i]!; g += origen.data[i + 1]!; b += origen.data[i + 2]!; a += origen.data[i + 3]!;
          n++;
        }
      }
      const j = (anchoDestino * y + x) * 4;
      salida[j] = Math.round(r / n); salida[j + 1] = Math.round(g / n);
      salida[j + 2] = Math.round(b / n); salida[j + 3] = Math.round(a / n);
    }
  }
  return { data: salida, width: anchoDestino, height: altoDestino };
}

/** ¿Tiene transparencia real? Decide entre WebP/PNG (con alfa) y WebP/JPEG (sin alfa). */
function tieneAlfa(bitmap: Bitmap): boolean {
  for (let i = 3; i < bitmap.data.length; i += 4) if (bitmap.data[i]! < 250) return true;
  return false;
}

/* --------------------------------------------------------------------- codificar --- */

function codificar(bitmap: Bitmap, conAlfa: boolean): { datos: Uint8Array; tipo: string; ext: string } {
  const photon = cargarPhoton();
  if (photon) {
    try {
      const img = photon.PhotonImage.new_from_byteslice(bitmap.data);
      const bytes = (conAlfa ? (img as { get_bytes: () => Uint8Array }).get_bytes() : (img as { get_bytes_webp: () => Uint8Array }).get_bytes_webp());
      const buf = new Uint8Array(bytes);
      if (esWebp(buf)) return { datos: buf, tipo: "image/webp", ext: "webp" };
      if (conAlfa) return { datos: buf, tipo: "image/png", ext: "png" };
    } catch {
      /* cae al camino puro-JS */
    }
  }
  if (conAlfa) {
    const NuevaPNG = png().PNG as unknown as new (o: { width: number; height: number }) => { data: Buffer };
    const imagen = new NuevaPNG({ width: bitmap.width, height: bitmap.height });
    imagen.data = Buffer.from(bitmap.data);
    return { datos: new Uint8Array(png().PNG.sync.write(imagen, { colorType: 6 })), tipo: "image/png", ext: "png" };
  }
  const jpg = jpeg().encode({ data: Buffer.from(bitmap.data), width: bitmap.width, height: bitmap.height }, 80);
  return { datos: new Uint8Array(jpg.data), tipo: "image/jpeg", ext: "jpg" };
}

/* ------------------------------------------------------------------ decodificar --- */

function decodificar(datos: Uint8Array, ext: string): Bitmap | null {
  try {
    if (ext === "png") {
      const leida = png().PNG.sync.read(Buffer.from(datos));
      return { data: new Uint8Array(leida.data), width: leida.width, height: leida.height };
    }
    if (ext === "jpg" || ext === "jpeg") {
      const img = jpeg().decode(Buffer.from(datos), { useTArray: true });
      return { data: new Uint8Array(img.data), width: img.width, height: img.height };
    }
    // webp: solo el códec wasm sabe decodificarlo
    const photon = cargarPhoton();
    if (!photon) return null;
    const img = photon.PhotonImage.new_from_byteslice(datos) as { get_width: () => number; get_height: () => number; get_bytes: () => Uint8Array };
    const ancho = img.get_width();
    const alto = img.get_height();
    // Para leer píxeles se decodifica a PNG y se vuelve a abrir con pngjs.
    const leida = png().PNG.sync.read(Buffer.from(img.get_bytes()));
    return { data: new Uint8Array(leida.data), width: ancho, height: alto };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------- interfaz --- */

/**
 * Devuelve las variantes optimizadas (completa + miniaturas) o `null` si la imagen no se puede
 * decodificar: en ese caso quien llama guarda solo el original, que es exactamente el
 * comportamiento anterior.
 */
export function optimizarImagen(datos: Uint8Array, ext: string): Optimizacion | null {
  const bitmap = decodificar(datos, ext);
  if (!bitmap) return null;
  const conAlfa = tieneAlfa(bitmap);
  const codec: "photon" | "js" = cargarPhoton() ? "photon" : "js";
  const variantes: Variante[] = [];

  const anchoCompleto = Math.min(bitmap.width, ANCHO_MAX);
  const completo = reducir(bitmap, anchoCompleto);
  const c = codificar(completo, conAlfa);
  variantes.push({ etiqueta: "completa", datos: c.datos, tipo: c.tipo, ext: c.ext, ancho: completo.width, alto: completo.height });

  for (const ancho of ANCHOS_MINIATURA) {
    if (ancho >= bitmap.width) continue; // no se amplía nunca
    const mini = reducir(bitmap, ancho);
    const m = codificar(mini, conAlfa);
    variantes.push({
      etiqueta: `w${ancho}` as Variante["etiqueta"],
      datos: m.datos, tipo: m.tipo, ext: m.ext, ancho: mini.width, alto: mini.height,
    });
  }

  const aviso = codec === "js"
    ? "Sin códec WebP (falta vendor/photon): se ha recomprimido en JPEG/PNG."
    : undefined;
  return { ancho: bitmap.width, alto: bitmap.height, variantes, codec, aviso };
}

/** Ahorro conseguido, para poder informarlo. */
export function ahorro(entrada: number, salida: number): string {
  if (entrada <= 0) return "0%";
  const pct = Math.round((1 - salida / entrada) * 100);
  return `${pct}%`;
}
