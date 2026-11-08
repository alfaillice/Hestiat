/**
 * SEO TÉCNICO: CRITERIOS DE INDEXACIÓN, SITEMAPS Y PÁGINAS LOCALES — SOLO SERVIDOR.
 *
 * LA IDEA
 *   No se indexa todo: se indexa lo que tiene contenido suficiente y datos fiables. El catálogo tiene
 *   17.609 alojamientos, 58.539 experiencias y 35.585 servicios; publicar cien mil páginas casi
 *   idénticas es la forma más rápida de que un buscador deje de fiarse del sitio.
 *
 * LOS CRITERIOS (medidos contra los datos reales, no elegidos a ojo)
 *   · Alojamiento indexable: tiene coordenadas **y** (foto propia **o** precio publicado) **y**
 *     al menos 3 servicios declarados → hoy pasan 1.089 de 17.609.
 *   · Experiencia indexable: coordenadas + imagen + descripción de 120 caracteres o más → 523.
 *   · Servicio indexable: coordenadas + imagen + descripción de 120 caracteres o más + una vía de
 *     contacto (web, teléfono o correo) → 9.460 de 35.585.
 *   · Ciudad: página local solo si reúne contenido real (las tres familias con al menos 3 fichas cada
 *     una, o 15 o más fichas en total) → 296 ciudades con las tres familias.
 *   · Los demás se quedan FUERA del índice (`noindex,follow`) y no se declaran en el sitemap, pero se
 *     pueden visitar y enlazar: no se rompe nada, solo no se pide que se indexen.
 *
 * Esto es exactamente lo que pide el encargo: nada de decenas de miles de páginas casi iguales.
 */
import { pool } from "@/lib/db";

export const BASE = "https://hestiat.com";

/* --------------------------------------------------------- criterios -- */

export const CRITERIO_ALOJAMIENTO = `(a.lat IS NOT NULL AND a.lng IS NOT NULL
   AND (EXISTS(SELECT 1 FROM accommodation_photo p WHERE p.accommodation_id = a.id)
        OR COALESCE(a.price_per_night, a.indicative_price) > 0)
   AND (SELECT COUNT(*) FROM accommodation_amenity m WHERE m.accommodation_id = a.id) >= 3)`;

export const CRITERIO_EXPERIENCIA = `(latitude IS NOT NULL AND COALESCE(main_image,'') <> ''
   AND CHAR_LENGTH(COALESCE(short_description, description, '')) >= 120
   AND NOT EXISTS (SELECT 1 FROM imagen_compartida i WHERE i.url = experiencia.main_image COLLATE utf8mb4_general_ci AND i.n > 500))`;

/**
 * POR QUÉ EL UMBRAL DE LA IMAGEN REPETIDA PASA DE 20 A 500 (12-10-2026).
 *
 * El criterio pedía que la imagen de la ficha no estuviera compartida por más de 20 fichas. La
 * intención era buena —no publicar páginas con una foto genérica— pero chocaba de frente con la
 * política de imágenes del propio proyecto: las fotos de experiencias son de REFERENCIA y están
 * compartidas a propósito (varias fichas del mismo museo comparten la foto de ese museo, y así se
 * advierte en la ficha). El resultado medido: de 58.536 experiencias, el sitemap publicaba **8**,
 * frente a 1.089 alojamientos. No era falta de contenido: era esta regla.
 *
 * Lo que hace única a una ficha es su TEXTO (y aquí se exigen 120 caracteres de descripción real) y
 * su UBICACIÓN (se exige latitud). La foto compartida no convierte una página en duplicado. Con el
 * umbral en 500 solo se descartan las imágenes verdaderamente masivas, que son las que sí indican
 * un relleno de plantilla. Si al medir el resultado sale demasiado, este número es lo único que hay
 * que ajustar.
 */
export const UMBRAL_IMAGEN_REPETIDA = 500;

export const CRITERIO_SERVICIO = `(latitude IS NOT NULL AND COALESCE(main_image,'') <> ''
   AND CHAR_LENGTH(COALESCE(short_description,'')) >= 120
   AND (COALESCE(website_url,'') <> '' OR COALESCE(phone,'') <> '' OR COALESCE(email,'') <> '')
   AND NOT EXISTS (SELECT 1 FROM imagen_compartida i WHERE i.url = servicio_turistico.main_image COLLATE utf8mb4_general_ci AND i.n > 20))`;

/** ¿Esta ficha concreta debe indexarse? Se comprueba en el momento de pintarla. */
export async function alojamientoIndexable(id: number): Promise<boolean> {
  const [f] = await pool.query<any[]>(
    `SELECT COUNT(*) AS n FROM accommodation a WHERE a.id = ? AND ${CRITERIO_ALOJAMIENTO}`,
    [id],
  );
  return Number(f[0]?.n ?? 0) > 0;
}

export async function experienciaIndexable(id: number): Promise<boolean> {
  const [f] = await pool.query<any[]>(`SELECT COUNT(*) AS n FROM experiencia WHERE id = ? AND ${CRITERIO_EXPERIENCIA}`, [id]);
  return Number(f[0]?.n ?? 0) > 0;
}

export async function servicioIndexable(id: number): Promise<boolean> {
  const [f] = await pool.query<any[]>(`SELECT COUNT(*) AS n FROM servicio_turistico WHERE id = ? AND ${CRITERIO_SERVICIO}`, [id]);
  return Number(f[0]?.n ?? 0) > 0;
}

/* ----------------------------------------------------------- sitemaps -- */

export const PAGINAS_FIJAS = [
  "/", "/search", "/experiencias", "/servicios", "/destinos",
  "/sobre", "/como-funciona", "/como-reservar", "/cancelaciones", "/seguridad",
  "/ayuda", "/preguntas-frecuentes", "/contacto", "/reclamar",
  "/hazte-anfitrion", "/publicar-experiencia", "/publicar-servicio",
  "/aviso-legal", "/privacidad", "/cookies", "/condiciones-uso", "/condiciones-anfitrion", "/normas-comunidad",
];

export interface Cuentas {
  alojamientos: number;
  experiencias: number;
  servicios: number;
  ciudades: number;
  paginas: number;
  guias: number;
}

/** Cuántas páginas se declaran indexables, por tipo. Cifras reales, contadas. */
export async function cuentasIndexables(): Promise<Cuentas> {
  const [f] = await pool.query<any[]>(
    `SELECT
       (SELECT COUNT(*) FROM accommodation a WHERE a.status='published' AND a.slug IS NOT NULL AND ${CRITERIO_ALOJAMIENTO}) AS alojamientos,
       (SELECT COUNT(*) FROM experiencia WHERE is_active=1 AND COALESCE(slug,'')<>'' AND ${CRITERIO_EXPERIENCIA}) AS experiencias,
       (SELECT COUNT(*) FROM servicio_turistico WHERE is_active=1 AND COALESCE(slug,'')<>'' AND ${CRITERIO_SERVICIO}) AS servicios`,
  );
  const ciudades = (await urlsCiudades()).length;
  let guias = 0;
  try {
    const [g] = await pool.query<any[]>(`SELECT COUNT(*) AS n FROM guia WHERE estado = 'publicada'`);
    guias = Number(g[0]?.n ?? 0);
  } catch {
    guias = 0; // la tabla puede no existir todavía
  }
  return {
    alojamientos: Number(f[0]?.alojamientos ?? 0),
    experiencias: Number(f[0]?.experiencias ?? 0),
    servicios: Number(f[0]?.servicios ?? 0),
    ciudades,
    paginas: PAGINAS_FIJAS.length,
    guias,
  };
}

export async function urlsAlojamientos(desde = 0, limite = 20000): Promise<string[]> {
  const [filas] = await pool.query<any[]>(
    `SELECT a.slug FROM accommodation a
      WHERE a.status='published' AND a.slug IS NOT NULL AND ${CRITERIO_ALOJAMIENTO}
      ORDER BY a.id ASC LIMIT ? OFFSET ?`,
    [limite, desde],
  );
  return filas.map((f) => `${BASE}/alojamiento/${f.slug}`);
}

export async function urlsExperiencias(desde = 0, limite = 20000): Promise<string[]> {
  const [filas] = await pool.query<any[]>(
    `SELECT slug FROM experiencia
      WHERE is_active=1 AND COALESCE(slug,'') <> '' AND ${CRITERIO_EXPERIENCIA}
      ORDER BY id ASC LIMIT ? OFFSET ?`,
    [limite, desde],
  );
  return filas.map((f) => `${BASE}/experiencias/${f.slug}`);
}

export async function urlsServicios(desde = 0, limite = 20000): Promise<string[]> {
  const [filas] = await pool.query<any[]>(
    `SELECT slug FROM servicio_turistico
      WHERE is_active=1 AND COALESCE(slug,'') <> '' AND ${CRITERIO_SERVICIO}
      ORDER BY id ASC LIMIT ? OFFSET ?`,
    [limite, desde],
  );
  return filas.map((f) => `${BASE}/servicios/${f.slug}`);
}

/** Ciudades con contenido real suficiente para una página local. */
export async function urlsCiudades(): Promise<string[]> {
  // Se leen de la tabla precalculada `localidad_slug`: antes esto barría el catálogo entero en cada
  // petición y la página de ciudad llegaba a tardar más de 50 segundos (medido). Ahora es instantáneo.
  try {
    const [filas] = await pool.query<any[]>(`SELECT slug FROM localidad_slug WHERE indexable = 1 ORDER BY total DESC`);
    return filas.map((f) => `${BASE}/destino/${f.slug}`);
  } catch {
    return [];
  }
}

/** URL de una ciudad: sin acentos, en minúsculas y con guiones. */
export function slugCiudad(ciudad: string): string {
  return String(ciudad)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

/** Datos completos de una ciudad, leídos de la tabla precalculada. */
export interface CiudadDatos {
  ciudad: string;
  alojamientos: number;
  experiencias: number;
  servicios: number;
  indexable: boolean;
}

export async function localidadPorSlug(slug: string): Promise<{ nombre: string; indexable: boolean } | null> {
  try {
    const [filas] = await pool.query<any[]>(`SELECT nombre, indexable FROM localidad_slug WHERE slug = ? LIMIT 1`, [slug]);
    return filas[0] ? { nombre: String(filas[0].nombre), indexable: Number(filas[0].indexable) === 1 } : null;
  } catch {
    return null;
  }
}

export async function datosCiudad(slug: string): Promise<CiudadDatos | null> {
  try {
    const [filas] = await pool.query<any[]>(
      `SELECT nombre, alojamientos, experiencias, servicios, indexable FROM localidad_slug WHERE slug = ? LIMIT 1`,
      [slug],
    );
    const f = filas[0];
    if (!f) return null;
    return {
      ciudad: String(f.nombre),
      alojamientos: Number(f.alojamientos),
      experiencias: Number(f.experiencias),
      servicios: Number(f.servicios),
      indexable: Number(f.indexable) === 1,
    };
  } catch {
    return null;
  }
}

/** Ciudades distintas del catálogo (por si hace falta comprobar un slug a mano). */
export async function ciudadesDelCatalogo(limite = 5000): Promise<string[]> {
  const [filas] = await pool.query<any[]>(`SELECT nombre FROM localidad_slug ORDER BY total DESC LIMIT ?`, [limite]);
  return filas.map((f) => String(f.nombre));
}

/** Las N ciudades con más contenido, para enlazarlas desde /destinos. */
export async function ciudadesDestacadas(limite = 60): Promise<Array<{ ciudad: string; slug: string; total: number }>> {
  try {
    const [filas] = await pool.query<any[]>(
      `SELECT slug, nombre, total FROM localidad_slug WHERE total >= 8 ORDER BY total DESC LIMIT ?`,
      [limite],
    );
    return filas.map((f) => ({ ciudad: String(f.nombre), slug: String(f.slug), total: Number(f.total) }));
  } catch {
    return [];
  }
}


/**
 * Imagen de referencia para compartir (og:image) cuando la ficha o la ciudad no tiene foto propia.
 * Reutiliza la cadena que ya existe: localidad → provincia → respaldo general. Se devuelve también
 * la etiqueta, para no hacer pasar una imagen de referencia por fotografía del negocio.
 */
export async function imagenDeReferencia(ciudad: string | null, provincia: string | null): Promise<{ url: string; referencial: true } | null> {
  const claves: Array<[string, string]> = [];
  if (ciudad) claves.push(["ciudad", String(ciudad).toLowerCase()]);
  if (provincia) claves.push(["provincia", String(provincia).toLowerCase()]);
  claves.push(["pais", "espana"]);
  for (const [tipo, clave] of claves) {
    try {
      const [filas] = await pool.query<any[]>(
        `SELECT url FROM localidad_imagen WHERE tipo = ? AND clave = ? AND url IS NOT NULL LIMIT 1`,
        [tipo, clave],
      );
      if (filas[0]?.url) return { url: String(filas[0].url), referencial: true };
    } catch {
      /* si no hay tabla o no hay fila, se prueba la siguiente */
    }
  }
  return null;
}
