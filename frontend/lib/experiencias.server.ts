/**
 * Experiencias: datos del catálogo público (SOLO servidor).
 *
 * Qué hay de verdad en la base (auditado antes de escribir nada):
 *   · 58.539 experiencias activas, todas con nombre, categoría, subcategoría, provincia,
 *     coordenadas, imagen y slug.
 *   · Descripción en 58.529 · municipio en 27.521 · web en 4.135 · horario en 1.952 · teléfono 2.454.
 *   · PRECIO en 48. El 97% está marcado como «unavailable», así que casi todas dirán «Consultar».
 *     Eso es un dato, no un fallo: no se inventa ningún precio.
 *   · Duración: vacía en TODAS. No se muestra, porque no hay.
 *   · No hay columna de proveedor ni de propietario: el modelo nuevo
 *     (`experiencia_organizador`) queda preparado y VACÍO, sin inventar ninguno.
 *
 * La clasificación (categoría y subcategoría de Hestiat) vive en `experiencia_clasificacion`,
 * rellenada por reglas automáticas auditables sobre los datos reales, con su nivel de confianza.
 */
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";
import { faltaClasificacion, faltaEnriquecimiento } from "@/lib/catalogo-resiliente";
import { datosEnriquecidos, datoDe, resolver, resolverImagen, resolverPrecio } from "@/lib/catalogo-datos.server";

export interface ExpTarjeta {
  id: number;
  slug: string;
  nombre: string;
  categoria: string | null;
  subcategoria: string | null;
  /** Los identificadores, para poder filtrar por ellos (los nombres pueden cambiar). */
  categoriaSlug: string | null;
  subcategoriaSlug: string | null;
  municipio: string | null;
  provincia: string | null;
  imagen: string | null;
  /** De dónde viene la imagen original (para saber si es propia o de referencia). */
  imagenOrigen: string | null;
  /** true cuando la imagen que se enseña es la oficial del sitio, no una de referencia. */
  imagenOficial: boolean;
  /** De dónde salió la imagen oficial, para poder citarla. */
  imagenOficialFuente: string | null;
  /** Qué es la imagen que se enseña: oficial, proveedor, turismo_oficial, wikipedia, directorio,
      representativa o sin_imagen_verificada. Nunca se presenta una de Wikipedia como oficial. */
  imagenEtiqueta: string;
  /** Texto de precio ya resuelto: «Gratis», «Desde 12 €», «Precio variable» o «Consultar». */
  precio: string;
  /** true cuando el precio es orientativo (no garantizado). */
  precioOrientativo: boolean;
  rating: number | null;
  ratingCount: number;
  href: string;
  /** Lo que traía la base, antes de resolver con lo enriquecido. */
  precioOriginal: { texto: string; orientativo: boolean; hayValor: boolean };
}

/** La regla de precio, en un solo sitio: nunca se inventa y nunca se calla que es orientativo. */
export function precioDe(f: Record<string, unknown>): { texto: string; orientativo: boolean } {
  const tipo = String(f.price_type ?? "");
  const valor = Number(f.price ?? 0);
  const moneda = String(f.currency ?? "EUR");
  const unidad = String(f.price_unit ?? "");
  const conUnidad = (t: string) => `${t}${unidad === "person" ? " / persona" : unidad === "ticket" ? " / entrada" : ""}`;
  const numero = Number.isFinite(valor) && valor > 0 ? valor.toLocaleString("es-ES", { maximumFractionDigits: 2 }) : null;

  if (tipo === "free") return { texto: "Gratis", orientativo: false };
  if (tipo === "exact" && numero) return { texto: conUnidad(`${numero} ${moneda === "EUR" ? "€" : moneda}`), orientativo: false };
  if (tipo === "from" && numero) return { texto: conUnidad(`Desde ${numero} ${moneda === "EUR" ? "€" : moneda}`), orientativo: true };
  if (tipo === "variable") return { texto: "Precio variable · consultar", orientativo: true };
  const texto = String(f.price_text ?? "").trim();
  if (texto && numero) return { texto: conUnidad(texto), orientativo: true };
  return { texto: "Consultar", orientativo: false };
}

const CAMPOS = `e.id, e.slug, e.name AS nombre, e.municipality AS municipio, e.province AS provincia,
                e.main_image AS imagen, e.price, e.currency, e.price_type, e.price_unit, e.price_text,
                e.image_source AS imagen_origen,
                e.rating, e.rating_count,
                c.nombre AS categoria, s.nombre AS subcategoria,
                c.slug AS categoria_slug, s.slug AS subcategoria_slug`;

const DESDE = `FROM experiencia e
  LEFT JOIN experiencia_clasificacion cl ON cl.experiencia_id = e.id
  LEFT JOIN exp_categoria c ON c.id = cl.categoria_id
  LEFT JOIN exp_categoria s ON s.id = cl.subcategoria_id`;

/** Consulta de recuperación: utiliza solamente las columnas del catálogo principal.
 * No se aplica cuando el usuario pide una categoría, porque ignorar ese filtro sería engañoso. */
const CAMPOS_BASICO = `e.id, e.slug, e.name AS nombre, e.municipality AS municipio, e.province AS provincia,
  e.main_image AS imagen, e.price, e.currency, e.price_type, e.price_unit, e.price_text,
  e.image_source AS imagen_origen, e.rating, e.rating_count,
  NULL AS categoria, NULL AS subcategoria, NULL AS categoria_slug, NULL AS subcategoria_slug`;

function aTarjeta(f: mysql.RowDataPacket): ExpTarjeta {
  const p = precioDe(f as unknown as Record<string, unknown>);
  const hayValor = p.texto !== "Consultar";
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
    imagenOrigen: f.imagen_origen ?? null,
    imagenOficial: false,
    imagenOficialFuente: null,
    imagenEtiqueta: "sin_imagen_verificada",
    precio: p.texto,
    precioOrientativo: p.orientativo,
    rating: f.rating !== null && Number(f.rating) > 0 ? Number(f.rating) : null,
    ratingCount: Number(f.rating_count ?? 0),
    href: `/experiencias/${encodeURIComponent(String(f.slug ?? ""))}`,
    precioOriginal: { texto: p.texto, orientativo: p.orientativo, hayValor },
  };
}

/**
 * Aplica la resolución de datos a un conjunto de tarjetas: UNA consulta para todas y las mismas
 * reglas que en la ficha. Se llama desde todas las funciones que devuelven tarjetas, así que la
 * imagen y el precio son los mismos se mire donde se mire.
 */
async function aplicarEnriquecido(items: ExpTarjeta[]): Promise<ExpTarjeta[]> {
  if (items.length === 0) return items;
  const mapa = await datosEnriquecidos("experience", items.map((i) => i.id), ["imagen_oficial", "precio_orientativo"]).catch((error: unknown) => {
    if (!faltaEnriquecimiento(error)) throw error;
    console.warn("[experiencias] falta catalogo_dato: se muestran las imágenes y los precios originales");
    return new Map();
  });
  return items.map((i) => {
    const img = resolverImagen(i.imagen, i.imagenOrigen, datoDe(mapa, i.id, "imagen_oficial"));
    const pr = resolverPrecio(i.precioOriginal, datoDe(mapa, i.id, "precio_orientativo"));
    return {
      ...i,
      imagen: img.url,
      imagenOficial: img.origen === "oficial",
      imagenOficialFuente: img.origen === "oficial" ? img.fuente?.sourceName ?? img.fuente?.source ?? null : null,
      imagenEtiqueta: img.etiqueta,
      precio: pr.texto,
      precioOrientativo: pr.orientativo,
    };
  });
}

/* ------------------------------------------------------------ categorías -- */

export interface CategoriaExp {
  slug: string;
  nombre: string;
  icono: string | null;
  total: number;
}

/** Las categorías de Hestiat que TIENEN experiencias. Las vacías no se enseñan: no hay nada. */
export async function categoriasConDatos(): Promise<CategoriaExp[]> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT c.slug, c.nombre, c.icono, COUNT(*) AS total
       FROM exp_categoria c
       JOIN experiencia_clasificacion cl ON cl.categoria_id = c.id
      GROUP BY c.id, c.slug, c.nombre, c.icono, c.orden
      ORDER BY c.orden ASC`,
  );
  return filas.map((f) => ({ slug: String(f.slug), nombre: String(f.nombre), icono: f.icono ?? null, total: Number(f.total) }));
}

export async function subcategoriasDe(slugCategoria: string): Promise<CategoriaExp[]> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT s.slug, s.nombre, s.icono, COUNT(*) AS total
       FROM exp_categoria p
       JOIN exp_categoria s ON s.padre_id = p.id
       JOIN experiencia_clasificacion cl ON cl.subcategoria_id = s.id
      WHERE p.slug = ?
      GROUP BY s.id, s.slug, s.nombre, s.icono, s.orden
      ORDER BY total DESC`,
    [slugCategoria],
  );
  return filas.map((f) => ({ slug: String(f.slug), nombre: String(f.nombre), icono: f.icono ?? null, total: Number(f.total) }));
}

/* -------------------------------------------------------------- listado -- */

export interface FiltrosExp {
  q?: string;
  categoria?: string;
  subcategoria?: string;
  provincia?: string;
  familia?: boolean;
  accesible?: boolean;
  /** Cursor: solo las fichas con id mayor que este. Sustituye a la paginación por saltos. */
  desde?: number;
  pagina?: number;
  porPagina?: number;
}

export async function buscarExperiencias(f: FiltrosExp = {}): Promise<{ total: number; items: ExpTarjeta[]; porPagina: number }> {
  const porPagina = Math.min(Math.max(f.porPagina ?? 24, 1), 48);
  const pagina = Math.max(f.pagina ?? 1, 1);

  const where: string[] = ["e.is_active = 1", "e.slug IS NOT NULL", "e.slug <> ''"];
  const valores: unknown[] = [];
  /* Compatibilidad de enlaces: se acepta el identificador nuevo (`museos-exposiciones`), el NOMBRE
     que usaban los enlaces antiguos (`Museos y exposiciones`) y el id numérico. Así un enlace
     indexado hace meses sigue llevando a su categoría en vez de a una página vacía. */
  const porCategoria = (valor: string) => {
    const n = Number(valor);
    return { sql: "(c.slug = ? OR c.nombre = ? OR c.id = ?)", valores: [valor, valor, Number.isFinite(n) ? n : 0] };
  };
  const porSubcategoria = (valor: string) => {
    const n = Number(valor);
    return { sql: "(s.slug = ? OR s.nombre = ? OR s.id = ?)", valores: [valor, valor, Number.isFinite(n) ? n : 0] };
  };
  if (f.categoria) { const c = porCategoria(f.categoria); where.push(c.sql); valores.push(...c.valores); }
  if (f.subcategoria) { const s = porSubcategoria(f.subcategoria); where.push(s.sql); valores.push(...s.valores); }
  if (f.provincia) { where.push("e.province = ?"); valores.push(f.provincia); }
  if (f.familia) where.push("e.family_friendly = 1");
  if (f.accesible) where.push("e.accessible = 1");
  if (f.desde) { where.push("e.id > ?"); valores.push(f.desde); }
  const q = (f.q ?? "").trim();
  if (q.length >= 2) {
    where.push("(e.name LIKE ? OR e.municipality LIKE ? OR e.province LIKE ? OR e.subcategory LIKE ?)");
    const like = `%${q}%`;
    valores.push(like, like, like, like);
  }
  const condicion = where.join(" AND ");

  let tot: mysql.RowDataPacket[];
  let filas: mysql.RowDataPacket[];
  try {
    [tot] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS n ${DESDE} WHERE ${condicion}`, valores,
    );
    [filas] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT ${CAMPOS} ${DESDE} WHERE ${condicion} ORDER BY e.id ASC LIMIT ? OFFSET ?`,
      [...valores, porPagina, (pagina - 1) * porPagina],
    );
  } catch (error) {
    if (!faltaClasificacion(error, "experiencia") || f.categoria || f.subcategoria) throw error;
    console.warn("[experiencias] no hay tablas auxiliares de clasificación; consulta sin categoría");
    [tot] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM experiencia e WHERE ${condicion}`, valores,
    );
    [filas] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT ${CAMPOS_BASICO} FROM experiencia e WHERE ${condicion} ORDER BY e.id ASC LIMIT ? OFFSET ?`,
      [...valores, porPagina, (pagina - 1) * porPagina],
    );
  }
  return { total: Number(tot[0]?.n ?? 0), items: await aplicarEnriquecido(filas.map(aTarjeta)), porPagina };
}

/** Destacadas: las que tienen mejor valoración real y foto. Nunca se inventa una valoración. */
export async function destacadasExperiencias(limite = 13): Promise<ExpTarjeta[]> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ${CAMPOS} ${DESDE}
      WHERE e.is_active = 1 AND e.slug <> '' AND e.rating_count > 0 AND e.rating IS NOT NULL
      ORDER BY e.rating DESC, e.rating_count DESC, e.id ASC LIMIT ?`,
    [limite],
  );
  return aplicarEnriquecido(filas.map(aTarjeta));
}

/** Provincias con experiencias, con su recuento real (para «por destino»). */
export async function provinciasConExperiencias(limite = 12): Promise<{ provincia: string; total: number }[]> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT province AS provincia, COUNT(*) AS total FROM experiencia
      WHERE is_active = 1 AND province IS NOT NULL AND province <> ''
      GROUP BY province ORDER BY total DESC LIMIT ?`,
    [limite],
  );
  return filas.map((f) => ({ provincia: String(f.provincia), total: Number(f.total) }));
}

/* --------------------------------------------------------------- ficha -- */

export interface ExpFicha extends ExpTarjeta {
  descripcion: string | null;
  resumen: string | null;
  direccion: string | null;
  /** true cuando algún dato de la ficha se ha completado desde la web oficial del sitio. */
  completadoDesdeWeb: boolean;
  /** Qué se completó y de dónde, para poder decirlo en la ficha sin adornos. */
  procedenciaWeb: { campo: string; valor: string; fuente: string | null; url: string | null }[];
  lat: number | null;
  lng: number | null;
  web: string | null;
  telefono: string | null;
  horario: string | null;
  duracionMin: number | null;
  duracionMax: number | null;
  edadMin: number | null;
  familia: boolean;
  accesible: boolean;
  parking: boolean;
  transporte: boolean;
  servicios: string | null;
  fuente: string | null;
  fuenteUrl: string | null;
  imagenFuente: string | null;
  imagenFuenteUrl: string | null;
}

export async function experienciaPorSlug(slug: string): Promise<ExpFicha | null> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ${CAMPOS}, e.description AS descripcion, e.short_description AS resumen, e.address AS direccion,
            e.latitude AS lat, e.longitude AS lng, e.website_url AS web, e.phone AS telefono,
            e.opening_hours AS horario, e.duration_min AS duracionMin, e.duration_max AS duracionMax,
            e.age_min AS edadMin, e.family_friendly AS familia, e.accessible AS accesible,
            e.parking AS parking, e.public_transport AS transporte, e.services AS servicios,
            e.source_name AS fuente, e.source_url AS fuenteUrl,
            e.image_source AS imagenFuente, e.image_source_url AS imagenFuenteUrl
       ${DESDE} WHERE e.slug = ? AND e.is_active = 1 LIMIT 1`,
    [slug],
  );
  const f = filas[0];
  if (!f) return null;
  const id = Number(f.id);
  const tarjeta = (await aplicarEnriquecido([aTarjeta(f)]))[0];
  const mapa = await datosEnriquecidos("experience", [id], ["descripcion", "telefono", "direccion"]);
  const resolverDato = (original: unknown, campo: string) => {
    const dato = datoDe(mapa, id, campo);
    const r = resolver(original === null || original === undefined ? null : String(original), dato?.valor ?? null);
    return { valor: r.valor, deLaWeb: r.origen === "enriquecido", dato };
  };
  const descripcion = resolverDato(f.descripcion, "descripcion");
  const telefono = resolverDato(f.telefono, "telefono");
  const direccion = resolverDato(f.direccion, "direccion");
  return {
    ...tarjeta,
    descripcion: descripcion.valor,
    resumen: f.resumen ?? null,
    direccion: direccion.valor,
    completadoDesdeWeb: descripcion.deLaWeb || telefono.deLaWeb || direccion.deLaWeb,
    procedenciaWeb: [
      { campo: "Descripción", ...descripcion },
      { campo: "Teléfono", ...telefono },
      { campo: "Dirección", ...direccion },
    ].filter((x) => x.deLaWeb).map((x) => ({ campo: x.campo, valor: String(x.valor ?? ""), fuente: x.dato?.sourceName ?? x.dato?.source ?? null, url: x.dato?.sourceUrl ?? null })),
    lat: f.lat !== null ? Number(f.lat) : null,
    lng: f.lng !== null ? Number(f.lng) : null,
    web: f.web ?? null,
    telefono: telefono.valor,
    horario: f.horario ?? null,
    duracionMin: f.duracionMin !== null ? Number(f.duracionMin) : null,
    duracionMax: f.duracionMax !== null ? Number(f.duracionMax) : null,
    edadMin: f.edadMin !== null ? Number(f.edadMin) : null,
    familia: Boolean(Number(f.familia ?? 0)),
    accesible: Boolean(Number(f.accesible ?? 0)),
    parking: Boolean(Number(f.parking ?? 0)),
    transporte: Boolean(Number(f.transporte ?? 0)),
    servicios: f.servicios ?? null,
    fuente: f.fuente ?? null,
    fuenteUrl: f.fuenteUrl ?? null,
    imagenFuente: f.imagenFuente ?? null,
    imagenFuenteUrl: f.imagenFuenteUrl ?? null,
  };
}

/** Similares: misma subcategoría, luego misma categoría, luego misma provincia. */
export async function experienciasSimilares(exp: { id: number; categoria: string | null; provincia: string | null }, limite = 8): Promise<ExpTarjeta[]> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ${CAMPOS} ${DESDE}
      WHERE e.is_active = 1 AND e.slug <> '' AND e.id <> ?
        AND ((? IS NOT NULL AND c.nombre = ?) OR (? IS NOT NULL AND e.province = ?))
      ORDER BY (c.nombre = ?) DESC, e.id ASC LIMIT ?`,
    [exp.id, exp.categoria, exp.categoria, exp.provincia, exp.provincia, exp.categoria, limite],
  );
  return aplicarEnriquecido(filas.map(aTarjeta));
}

/** Cercanas: por distancia real a las coordenadas de esta experiencia. */
export async function experienciasCercanasA(exp: { id: number; lat: number | null; lng: number | null }, limite = 8): Promise<ExpTarjeta[]> {
  if (exp.lat === null || exp.lng === null) return [];
  const D = "(6371000 * ACOS(LEAST(1, COS(RADIANS(?)) * COS(RADIANS(e.latitude)) * COS(RADIANS(e.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(e.latitude)))))";
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT ${CAMPOS} ${DESDE}
      WHERE e.is_active = 1 AND e.slug <> '' AND e.id <> ? AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL
      ORDER BY ${D} ASC, e.id ASC LIMIT ?`,
    [exp.id, exp.lat, exp.lng, exp.lat, limite],
  );
  return aplicarEnriquecido(filas.map(aTarjeta));
}
