/**
 * RESOLUCIÓN DE DATOS DEL CATÁLOGO — SOLO SERVIDOR.
 *
 * Una sola capa decide qué valor ve el usuario cuando existen DOS: el original de nuestra base y el
 * enriquecido desde la fuente oficial. Se usa desde tarjetas, fichas, buscador, filtros, mapa y SEO,
 * así que no puede haber dos reglas distintas según la pantalla.
 *
 * LA REGLA, en una frase: manda el original; sólo se usa el enriquecido cuando el original no existe
 * o cuando hay una razón explícita para preferirlo (imagen de referencia frente a imagen oficial).
 *
 * Y nunca se pierde la procedencia: cada valor resuelto puede decir de dónde viene.
 */
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";

export type TipoCatalogoPublico = "experience" | "service" | "accommodation";

export interface DatoEnriquecido {
  valor: string;
  source: string;
  sourceName: string | null;
  sourceUrl: string | null;
  confidence: string;
}

export type OrigenValor = "original" | "enriquecido" | "oficial" | "ninguno";

export interface ValorResuelto<T> {
  valor: T | null;
  origen: OrigenValor;
  /** De dónde salió, cuando es enriquecido. */
  fuente?: DatoEnriquecido | null;
}

/**
 * Trae TODOS los datos enriquecidos de un conjunto de fichas en UNA consulta.
 * Devuelve un mapa con clave `item_id:campo` para resolver sin volver a tocar la base.
 */
export async function datosEnriquecidos(
  tipo: TipoCatalogoPublico,
  ids: number[],
  campos?: string[],
): Promise<Map<string, DatoEnriquecido>> {
  const mapa = new Map<string, DatoEnriquecido>();
  if (ids.length === 0) return mapa;
  const marcas = ids.map(() => "?").join(",");
  const filtroCampos = campos && campos.length > 0 ? ` AND campo IN (${campos.map(() => "?").join(",")})` : "";
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT item_id, campo, enriched_value, source, source_name, source_url, confidence
       FROM catalogo_dato
      WHERE catalog_type = ? AND item_id IN (${marcas})${filtroCampos}
        AND enriched_value IS NOT NULL AND enriched_value <> ''`,
    [tipo, ...ids, ...(campos ?? [])],
  );
  for (const f of filas) {
    mapa.set(`${Number(f.item_id)}:${String(f.campo)}`, {
      valor: String(f.enriched_value),
      source: String(f.source ?? ""),
      sourceName: f.source_name ?? null,
      sourceUrl: f.source_url ?? null,
      confidence: String(f.confidence ?? "medium"),
    });
  }
  return mapa;
}

/**
 * LA RESOLUCIÓN. El original si existe; si no, el enriquecido.
 * `preferirEnriquecido` existe para los casos en los que hay una razón explícita (ver imágenes).
 */
export function resolver<T>(original: T | null | undefined, enriquecido: T | null | undefined, preferirEnriquecido = false): { valor: T | null; origen: OrigenValor } {
  const hayOriginal = original !== null && original !== undefined && String(original).trim() !== "";
  const hayEnriquecido = enriquecido !== null && enriquecido !== undefined && String(enriquecido).trim() !== "";
  if (preferirEnriquecido && hayEnriquecido) return { valor: enriquecido as T, origen: "enriquecido" };
  if (hayOriginal) return { valor: original as T, origen: "original" };
  if (hayEnriquecido) return { valor: enriquecido as T, origen: "enriquecido" };
  return { valor: null, origen: "ninguno" };
}

/** ¿Esta imagen es una imagen de REFERENCIA de fuente pública, o una foto del propio sitio? */
export function esImagenDeReferencia(origen: string | null | undefined): boolean {
  const t = (origen ?? "").toLowerCase();
  if (!t) return false;
  return t.includes("wikimedia") || t.includes("commons") || t.includes("openstreetmap") || t.includes("mapillary");
}

export interface ImagenResuelta {
  url: string | null;
  origen: "original" | "oficial" | "ninguno";
  /** Si la que se muestra es una imagen de referencia, la ficha lo dice. */
  esReferencia: boolean;
  fuente?: DatoEnriquecido | null;
}

/**
 * IMÁGENES. La misma idea, con una excepción razonada:
 *
 *  · Si la imagen original es una foto REAL del sitio → manda ella.
 *  · Si la original es una imagen de REFERENCIA (Wikimedia/OpenStreetMap, que es lo que trae el
 *    catálogo) y tenemos una imagen OFICIAL verificada de la fuente del propio negocio o lugar, se
 *    usa la oficial: es más correcta y no induce a error, que es justo lo que se pidió evitar.
 *  · Si no hay ninguna → sin imagen, y la tarjeta pone «Sin fotografía». Nunca una imagen rota.
 */
export function resolverImagen(
  original: string | null | undefined,
  origenDeLaOriginal: string | null | undefined,
  enriquecida: DatoEnriquecido | null | undefined,
): ImagenResuelta {
  const hayOriginal = Boolean(original && original.trim());
  const hayOficial = Boolean(enriquecida && enriquecida.valor.trim());
  if (hayOriginal && hayOficial && esImagenDeReferencia(origenDeLaOriginal)) {
    return { url: enriquecida!.valor, origen: "oficial", esReferencia: false, fuente: enriquecida };
  }
  if (hayOriginal) return { url: original!, origen: "original", esReferencia: esImagenDeReferencia(origenDeLaOriginal) };
  if (hayOficial) return { url: enriquecida!.valor, origen: "oficial", esReferencia: false, fuente: enriquecida };
  return { url: null, origen: "ninguno", esReferencia: false };
}

/**
 * PRECIOS. No es una segunda lógica de precios: usa el mismo texto de `precioDe` para el precio
 * original y, solo si no hay ninguno, admite el orientativo enriquecido (que NUNCA es un precio
 * confirmado: sale marcado como orientativo).
 */
export function resolverPrecio(
  original: { texto: string; orientativo: boolean; hayValor: boolean },
  enriquecido: DatoEnriquecido | null | undefined,
): { texto: string; orientativo: boolean; origen: OrigenValor; fuente?: DatoEnriquecido | null } {
  if (original.hayValor) return { texto: original.texto, orientativo: original.orientativo, origen: "original" };
  const num = Number(enriquecido?.valor ?? NaN);
  if (Number.isFinite(num) && num > 0) {
    const n = num.toLocaleString("es-ES", { maximumFractionDigits: 2 });
    return { texto: `Desde ${n} €`, orientativo: true, origen: "enriquecido", fuente: enriquecido };
  }
  return { texto: "Consultar", orientativo: false, origen: original.texto === "Gratis" ? "original" : "ninguno" };
}

/** Atajo para pedir un dato enriquecido concreto del mapa. */
export function datoDe(mapa: Map<string, DatoEnriquecido>, id: number, campo: string): DatoEnriquecido | null {
  return mapa.get(`${id}:${campo}`) ?? null;
}
