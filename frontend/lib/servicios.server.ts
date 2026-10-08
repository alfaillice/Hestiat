/**
 * Servicios: datos del catálogo público (SOLO servidor).
 *
 * Auditoría previa (35.585 servicios, todos activos):
 *   · Nombre, descripción, categoría, subcategoría, provincia, coordenadas, imagen y slug: 35.585
 *     (el 100%). Municipio: 17.739 · dirección: 12.923 · teléfono: 7.006 · horario: 6.107 · web: 5.624.
 *   · PRECIO: 89 con importe; 142 con algún estado de precio (59 exacto, 53 gratis, 30 desde). El
 *     resto, «Consultar»: no se inventa ninguno.
 *   · VALORACIÓN: 0 servicios tienen nota. Por eso no se enseña ninguna y no hay filtro de valoración.
 *   · NO existe columna de proveedor: `servicio_proveedor` queda creada y VACÍA, sin inventar nadie.
 *
 * La clasificación (13 categorías y 65 subcategorías de Hestiat) vive en `servicio_clasificacion`,
 * hecha con reglas sobre las 35 subcategorías reales del catálogo.
 */
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";
import { precioDe } from "@/lib/experiencias.server";

export interface ServTarjeta {
  id: number;
  slug: string;
  nombre: string;
  categoria: string | null;
  subcategoria: string | null;
  categoriaSlug: string | null;
  subcategoriaSlug: string | null;
  municipio: string | null;
  provincia: string | null;
  imagen: string | null;
  precio: string;
  precioOrientativo: boolean;
  href: string;
}

const CAMPOS = `s.id, s.slug, s.name AS nombre, s.municipality AS municipio, s.province AS provincia,
                s.main_image AS imagen, s.price, s.currency, s.price_type, s.price_unit, s.price_text,
                c.nombre AS categoria, sub.nombre AS subcategoria,
                c.slug AS categoria_slug, sub.slug AS subcategoria_slug`;

const DESDE = `FROM servicio_turistico s
  LEFT JOIN servicio_clasificacion cl ON cl.servicio_id = s.id
  LEFT JOIN serv_categoria c ON c.id = cl.categoria_id
  LEFT JOIN serv_categoria sub ON sub.id = cl.subcategoria_id`;

function aTarjeta(f: mysql.RowDataPacket): ServTarjeta {
  const p = precioDe(f as unknown as Record<string, unknown>);
  return {
    id: Number(f.id),
    slug: String(f.slug ?? ""),
    nombre: String(f.nombre ?? ""),
    categoria: f.categoria ?? null,
    subcategoria: f.subcategoria ?? null,
    categoriaSlug: f.categoria_slug ?? null,
    subcategoriaSlug: f.subcategoria_slug ?? null,
    municipio: f.municipio ?? null,
    provincia: f.provincia ?? null,
    imagen: f.imagen ?? null,
    precio: p.texto,
    precioOrientativo: p.orientativo,
    href: `/servicios/${encodeURIComponent(String(f.slug ?? ""))}`,
  };
}

export interface CategoriaServ {
  slug: string;
  nombre: string;
  icono: string | null;
  total: number;
  hijas: { slug: string; nombre: string; total: number }[];
}

/** Las 13 categorías con sus subcategorías REALES (las que tienen servicios). Las vacías no salen. */
export async function categoriasServicioConDatos(): Promise<CategoriaServ[]> {
  const [cats] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT c.id, c.slug, c.nombre, c.icono, COUNT(*) AS total
       FROM serv_categoria c JOIN servicio_clasificacion cl ON cl.categoria_id = c.id
      GROUP BY c.id, c.slug, c.nombre, c.icono, c.orden ORDER BY c.orden ASC`,
  );
  const [subs] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT s.padre_id, s.slug, s.nombre, COUNT(*) AS total
       FROM serv_categoria s JOIN servicio_clasificacion cl ON cl.subcategoria_id = s.id
      GROUP BY s.id, s.padre_id, s.slug, s.nombre, s.orden ORDER BY s.orden ASC`,
  );
  return cats.map((c) => ({
    slug: String(c.slug),
    nombre: String(c.nombre),
    icono: c.icono ?? null,
    total: Number(c.total),
    hijas: subs
      .filter((s) => Number(s.padre_id) === Number(c.id))
      .map((s) => ({ slug: String(s.slug), nombre: String(s.nombre), total: Number(s.total) })),
  }));
}

export interface FiltrosServ {
  q?: string;
  categoria?: string;
  subcategoria?: string;
  provincia?: string;
  pagina?: number;
  porPagina?: number;
}

export async function buscarServicios(f: FiltrosServ = {}): Promise<{ total: number; items: ServTarjeta[]; porPagina: number }> {
  const porPagina = Math.min(Math.max(f.porPagina ?? 24, 1), 48);
  const pagina = Math.max(f.pagina ?? 1, 1);

  const where: string[] = ["s.is_active = 1", "s.slug IS NOT NULL", "s.slug <> ''"];
  const valores: unknown[] = [];
  // El filtro «categoria» acepta TANTO una categoría como una subcategoría: así los enlaces del tipo
  // /servicios?categoria=masajes (subcategoría) y /servicios?categoria=peluqueria (categoría)
  // funcionan los dos, que es lo que se espera al pulsarlos.
  const elegido = (f.categoria ?? f.subcategoria ?? "").trim();
  if (elegido) {
    where.push("(c.slug = ? OR sub.slug = ?)");
    valores.push(elegido, elegido);
  }
  if (f.provincia) {
    where.push("s.province = ?");
    valores.push(f.provincia);
  }
  const q = (f.q ?? "").trim();
  if (q.length >= 2) {
    where.push("(s.name LIKE ? OR s.municipality LIKE ? OR s.province LIKE ? OR s.subcategory LIKE ? OR s.category LIKE ?)");
    const like = `%${q}%`;
    valores.push(like, like, like, like, like);
  }
  const condicion = where.join(" AND ");

  const [tot] = await pool.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n ${DESDE} WHERE ${condicion}`, valores);
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ${CAMPOS} ${DESDE} WHERE ${condicion} ORDER BY s.id ASC LIMIT ? OFFSET ?`,
    [...valores, porPagina, (pagina - 1) * porPagina],
  );
  return { total: Number(tot[0]?.n ?? 0), items: filas.map(aTarjeta), porPagina };
}

/**
 * «Destacados»: los que tienen MÁS información publicada (web, teléfono, horario, dirección), que es
 * lo único que se puede destacar con verdad. No hay valoraciones en el catálogo, así que no se finge
 * ninguna.
 */
export async function destacadosServicios(limite = 13): Promise<ServTarjeta[]> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ${CAMPOS} ${DESDE}
      WHERE s.is_active = 1 AND s.slug <> '' AND s.website_url IS NOT NULL AND s.website_url <> ''
      ORDER BY (s.phone IS NOT NULL) DESC, (s.opening_hours IS NOT NULL) DESC, COALESCE(s.completeness,0) DESC, s.id ASC
      LIMIT ?`,
    [limite],
  );
  return filas.map(aTarjeta);
}

export async function provinciasConServicios(limite = 14): Promise<{ provincia: string; total: number }[]> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT province AS provincia, COUNT(*) AS total FROM servicio_turistico
      WHERE is_active = 1 AND province IS NOT NULL AND province <> ''
      GROUP BY province ORDER BY total DESC LIMIT ?`,
    [limite],
  );
  return filas.map((f) => ({ provincia: String(f.provincia), total: Number(f.total) }));
}

export interface ServFicha extends ServTarjeta {
  descripcion: string | null;
  resumen: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  web: string | null;
  telefono: string | null;
  email: string | null;
  horario: string | null;
  servicios: string | null;
  verificado: boolean;
  fuente: string | null;
  fuenteUrl: string | null;
  imagenFuente: string | null;
  imagenFuenteUrl: string | null;
}

export async function servicioPorSlug(slug: string): Promise<ServFicha | null> {
  // La descripción que existe en el catálogo es la corta (short_description): se usa como descripción
  // y como resumen. No hay texto largo que copiar, y no se inventa ninguno.
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ${CAMPOS}, s.short_description AS resumen, s.address AS direccion,
            s.latitude AS lat, s.longitude AS lng, s.website_url AS web, s.phone AS telefono, s.email AS email,
            s.opening_hours AS horario, s.services AS servicios, s.is_verified AS verificado,
            s.source_name AS fuente, s.source_url AS fuenteUrl,
            s.image_source AS imagenFuente, s.image_source_url AS imagenFuenteUrl,
            s.short_description AS descripcion
       ${DESDE} WHERE s.slug = ? AND s.is_active = 1 LIMIT 1`,
    [slug],
  );
  const f = filas[0];
  if (!f) return null;
  return {
    ...aTarjeta(f),
    descripcion: f.descripcion ?? null,
    resumen: f.resumen ?? null,
    direccion: f.direccion ?? null,
    lat: f.lat !== null ? Number(f.lat) : null,
    lng: f.lng !== null ? Number(f.lng) : null,
    web: f.web ?? null,
    telefono: f.telefono ?? null,
    email: f.email ?? null,
    horario: f.horario ?? null,
    servicios: f.servicios ?? null,
    verificado: Boolean(Number(f.verificado ?? 0)),
    fuente: f.fuente ?? null,
    fuenteUrl: f.fuenteUrl ?? null,
    imagenFuente: f.imagenFuente ?? null,
    imagenFuenteUrl: f.imagenFuenteUrl ?? null,
  };
}

/** Similares: misma subcategoría, luego misma categoría, luego misma provincia. */
export async function serviciosSimilares(s: { id: number; categoriaSlug: string | null; provincia: string | null }, limite = 8): Promise<ServTarjeta[]> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ${CAMPOS} ${DESDE}
      WHERE s.is_active = 1 AND s.slug <> '' AND s.id <> ?
        AND ((? IS NOT NULL AND c.slug = ?) OR (? IS NOT NULL AND s.province = ?))
      ORDER BY (c.slug = ?) DESC, s.id ASC LIMIT ?`,
    [s.id, s.categoriaSlug, s.categoriaSlug, s.provincia, s.provincia, s.categoriaSlug, limite],
  );
  return filas.map(aTarjeta);
}

/** Cercanos: por distancia real a las coordenadas de este servicio. */
export async function serviciosCercanosA(s: { id: number; lat: number | null; lng: number | null }, limite = 8): Promise<ServTarjeta[]> {
  if (s.lat === null || s.lng === null) return [];
  const D = "(6371000 * ACOS(LEAST(1, COS(RADIANS(?)) * COS(RADIANS(s.latitude)) * COS(RADIANS(s.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(s.latitude)))))";
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ${CAMPOS} ${DESDE}
      WHERE s.is_active = 1 AND s.slug <> '' AND s.id <> ? AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
      ORDER BY ${D} ASC, s.id ASC LIMIT ?`,
    [s.id, s.lat, s.lng, s.lat, limite],
  );
  return filas.map(aTarjeta);
}

/** Servicios alrededor de un punto (para «cerca de ti» y para el buscador por cercanía). */
export async function serviciosCerca(punto: { lat: number; lng: number } | undefined, destino: string | undefined, limite = 13): Promise<{ total: number; items: ServTarjeta[]; cercaniaMetros: number | null }> {
  const D = "(6371000 * ACOS(LEAST(1, COS(RADIANS(?)) * COS(RADIANS(s.latitude)) * COS(RADIANS(s.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(s.latitude)))))";
  const where: string[] = ["s.is_active = 1", "s.slug <> ''"];
  const valores: unknown[] = [];
  let selec = CAMPOS;
  let orden = "ORDER BY s.id ASC";
  if (punto) {
    where.push("s.latitude IS NOT NULL AND s.longitude IS NOT NULL");
    selec += `, ${D} AS distancia_m`;
    orden = `ORDER BY ${D} ASC, s.id ASC`;
    valores.push(punto.lat, punto.lng, punto.lat);
  } else if (destino && destino.trim()) {
    where.push("(s.municipality = ? OR s.province = ?)");
    valores.push(destino.trim(), destino.trim());
  }
  const paramsOrden = punto ? [punto.lat, punto.lng, punto.lat] : [];
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ${selec} ${DESDE} WHERE ${where.join(" AND ")} ${orden} LIMIT ?`,
    [...valores, ...paramsOrden, limite],
  );
  const distancias = filas.map((f) => Number((f as unknown as Record<string, unknown>).distancia_m)).filter((m) => Number.isFinite(m));
  return {
    total: filas.length,
    cercaniaMetros: distancias.length > 0 ? Math.min(...distancias) : null,
    items: filas.map((f) => {
      const t = aTarjeta(f) as ServTarjeta & { nota?: string };
      // La distancia solo se dice cuando hay un punto real desde el que medirla.
      if (punto) {
        const m = Number((f as unknown as Record<string, unknown>).distancia_m);
        if (Number.isFinite(m)) t.nota = distanciaLegible(m);
      }
      return t;
    }),
  };
}

/** «a 3,2 km» o «a 850 m». La misma forma que en alojamientos y experiencias. */
export function distanciaLegible(metros: unknown): string | undefined {
  const m = Number(metros);
  if (!Number.isFinite(m) || m < 0) return undefined;
  if (m < 950) return `a ${Math.round(m / 10) * 10} m`;
  return `a ${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
