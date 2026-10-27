import { pool } from "@/lib/db";

/**
 * PROVINCIAS — páginas reales, sin inventar nada.
 *
 * ── POR QUÉ EXISTEN ─────────────────────────────────────────────────────────────────────────────
 * La página /destinos enlazaba 60 provincias a `/search?provincia=…`, y esa dirección está bloqueada
 * por robots.txt (`Disallow: /*?`): enlazábamos hacia páginas que no pueden posicionar. El resultado
 * era que la única forma de llegar a una provincia era una búsqueda, y ningún buscador la indexaba.
 *
 * Aquí se construye la página de provincia con los datos que YA existen en el catálogo: cuántos
 * alojamientos, experiencias y servicios hay, qué ciudades la componen y qué fichas se pueden abrir.
 * Ninguna cifra se estima: todas salen de un COUNT real.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────────────────────────
 * No escribe en la base de datos. No crea tablas. Es solo lectura, así que se puede quitar sin
 * dejar rastro.
 *
 * ── UNA PROVINCIA NECESITA CONTENIDO PARA SER INDEXABLE ─────────────────────────────────────────
 * Una página de provincia con tres alojamientos es una página vacía. El umbral está en
 * MINIMO_ALOJAMIENTOS_INDEXABLE y se aplica tanto a la etiqueta robots como al sitemap, desde esta
 * misma constante, para que no puedan divergir.
 */

export const MINIMO_ALOJAMIENTOS_INDEXABLE = 10;

export interface ProvinciaResumen {
  provincia: string;
  slug: string;
  alojamientos: number;
}

/** «Illes Balears» → «illes-balears»; «A Coruña» → «a-coruna». */
export function slugDeProvincia(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Las provincias que hoy tienen alojamientos publicados, con su recuento real. */
export async function listaProvincias(): Promise<ProvinciaResumen[]> {
  const [filas] = await pool.query<any[]>(
    `SELECT province AS provincia, COUNT(*) AS total
       FROM accommodation
      WHERE status = 'published' AND province IS NOT NULL AND province <> ''
      GROUP BY province
      ORDER BY total DESC`,
  );
  return filas.map((f) => ({
    provincia: String(f.provincia),
    slug: slugDeProvincia(String(f.provincia)),
    alojamientos: Number(f.total),
  }));
}

export interface CiudadDeProvincia {
  nombre: string;
  slug: string | null;
  total: number;
}

export interface FichaResumen {
  slug: string;
  nombre: string;
  ciudad: string | null;
}

export interface DatosProvincia {
  provincia: string;
  slug: string;
  alojamientos: number;
  experiencias: number;
  servicios: number;
  ciudades: CiudadDeProvincia[];
  fichas: { slug: string; name: string; city: string | null }[];
  experienciasTop: { slug: string; name: string; municipality: string | null }[];
  serviciosTop: { slug: string; name: string; municipality: string | null }[];
}

/** Normaliza para comparar nombres de ciudad sin depender de la colación de la base. */
function normalizarNombre(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Todo lo que se enseña en la página de una provincia. `null` si la provincia no existe. */
export async function datosProvincia(slug: string): Promise<DatosProvincia | null> {
  const provincias = await listaProvincias();
  const encontrada = provincias.find((p) => p.slug === slug);
  if (!encontrada) return null;

  const provincia = encontrada.provincia;

  const [cuentas] = await pool.query<any[]>(
    `SELECT
       (SELECT COUNT(*) FROM experiencia
         WHERE is_active = 1 AND province = ? AND COALESCE(slug,'') <> '') AS experiencias,
       (SELECT COUNT(*) FROM servicio_turistico
         WHERE is_active = 1 AND province = ? AND COALESCE(slug,'') <> '') AS servicios`,
    [provincia, provincia],
  );

  const [ciudadesBrutas] = await pool.query<any[]>(
    `SELECT city AS nombre, COUNT(*) AS total
       FROM accommodation
      WHERE status = 'published' AND province = ? AND city IS NOT NULL AND city <> ''
      GROUP BY city
      ORDER BY total DESC
      LIMIT 60`,
    [provincia],
  );

  // Mapa nombre normalizado → slug de su página de destino, para no enlazar a fichas que no existen.
  const [localidades] = await pool.query<any[]>(`SELECT slug, nombre FROM localidad_slug`);
  const mapa = new Map<string, string>();
  for (const l of localidades) mapa.set(normalizarNombre(String(l.nombre)), String(l.slug));

  const [fichas] = await pool.query<any[]>(
    `SELECT slug, name, city FROM accommodation
      WHERE status = 'published' AND province = ? AND slug IS NOT NULL
      ORDER BY id ASC LIMIT 24`,
    [provincia],
  );

  const [experienciasTop] = await pool.query<any[]>(
    `SELECT slug, name, municipality FROM experiencia
      WHERE is_active = 1 AND province = ? AND COALESCE(slug,'') <> ''
      ORDER BY id ASC LIMIT 12`,
    [provincia],
  );

  const [serviciosTop] = await pool.query<any[]>(
    `SELECT slug, name, municipality FROM servicio_turistico
      WHERE is_active = 1 AND province = ? AND COALESCE(slug,'') <> ''
      ORDER BY id ASC LIMIT 12`,
    [provincia],
  );

  return {
    provincia,
    slug: encontrada.slug,
    alojamientos: encontrada.alojamientos,
    experiencias: Number(cuentas[0]?.experiencias ?? 0),
    servicios: Number(cuentas[0]?.servicios ?? 0),
    ciudades: ciudadesBrutas.map((c) => ({
      nombre: String(c.nombre),
      slug: mapa.get(normalizarNombre(String(c.nombre))) ?? null,
      total: Number(c.total),
    })),
    fichas: fichas.map((f) => ({ slug: String(f.slug), name: String(f.name), city: f.city ?? null })),
    experienciasTop: experienciasTop.map((e) => ({ slug: String(e.slug), name: String(e.name), municipality: e.municipality ?? null })),
    serviciosTop: serviciosTop.map((s) => ({ slug: String(s.slug), name: String(s.name), municipality: s.municipality ?? null })),
  };
}
