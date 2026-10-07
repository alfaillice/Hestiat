/**
 * Hestiat 2.0 — capa de acceso a datos.
 *
 * SOLO SERVIDOR. Lee las credenciales del entorno (nunca del cliente) y consulta el
 * esquema NUEVO de `db/migrations/001_init.sql` en la base migrada.
 *
 * Reglas que se respetan aquí:
 *  · Consultas parametrizadas siempre (nada de concatenar entrada del usuario).
 *  · Solo se exponen los campos que la interfaz necesita.
 *  · Los agregados de reseñas se leen tal cual: no se calculan ni se inventan.
 */
import mysql from "mysql2/promise";

if (typeof window !== "undefined") {
  throw new Error("lib/db.ts es solo para servidor: nunca debe importarse desde el cliente");
}

const cfg = {
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "",
  password: process.env.DB_PASSWORD ?? "",
  dateStrings: true,
  database: process.env.DB_NAME_NEW ?? "ppxgfdyc_hestiat2",
  waitForConnections: true,
  connectionLimit: 8,
  charset: "utf8mb4_unicode_ci",
};

/** Pool reutilizado entre invocaciones (evita abrir una conexión por petición). */
declare global {
  // eslint-disable-next-line no-var
  var __hestiatPool: mysql.Pool | undefined;
}
export const pool: mysql.Pool = global.__hestiatPool ?? mysql.createPool(cfg);
if (process.env.NODE_ENV !== "production") global.__hestiatPool = pool;

/*
 * SEGUNDA CONEXIÓN — a la base ORIGINAL (el esquema antiguo, vivo).
 *
 * Por qué hace falta: las SESIONES y los PANELES viven en el esquema antiguo. La cookie
 * `hestiat_sesion` apunta a `usuario_sesion`, y las filas de sesión existentes están en la base
 * original. Si la autenticación leyera de la base nueva (que es una copia congelada del 11:02) se
 * invalidarían todas las sesiones abiertas y un anfitrión editaría datos de una réplica en vez de
 * los reales.
 *
 * Reparto de responsabilidades:
 *   pool        -> la base NUEVA    (esquema nuevo, páginas públicas)
 *   poolLegacy  -> la base ORIGINAL (esquema antiguo: sesiones, paneles y datos vivos)
 *
 * El nombre va en su propia variable (`DB_NAME_LEGACY`) a propósito: así no depende de qué valor
 * tenga `DB_NAME` en cada despliegue. Si en algún momento `DB_NAME` pasara a apuntar a la base
 * nueva, la autenticación seguiría leyendo la original y no se caería ninguna sesión.
 */
const cfgLegacy = { ...cfg, dateStrings: true,
  database: process.env.DB_NAME_LEGACY ?? "ppxgfdyc_hestiat" };
declare global {
  // eslint-disable-next-line no-var
  var __hestiatPoolLegacy: mysql.Pool | undefined;
}
export const poolLegacy: mysql.Pool = global.__hestiatPoolLegacy ?? mysql.createPool(cfgLegacy);
if (process.env.NODE_ENV !== "production") global.__hestiatPoolLegacy = poolLegacy;

/* ------------------------------------------------------------------ tipos -- */
export interface AlojamientoTarjeta {
  id: number;
  legacy_id: number | null;
  slug: string;
  title: string;
  city: string | null;
  province: string | null;
  price_per_night: string | null;
  price_type: "real" | "indicative" | "estimated";
  capacity: number | null;
  bedrooms: number | null;
  beds: number | null;
  review_score: string | null;
  review_count: number;
  portada: string | null;
}

export interface AlojamientoFicha extends AlojamientoTarjeta {
  description: string | null;
  type: string | null;
  category: string | null;
  address: string | null;
  lat: string | null;
  lng: string | null;
  baths: number | null;
  currency: string;
    cleaning_fee: string | null;
    // Precio orientativo: la mayoría del catálogo no tiene tarifa real del propietario, solo una
    // estimación. La ficha lo distingue para no presentar una estimación como precio cerrado.
    indicative_price: string | null;
    price_source: string | null;
  status: string;
  instant_booking: number;
}

export interface Foto {
  id: number;
  url: string | null;
  storage_key: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
  is_primary: number;
}

export interface Servicio {
  amenity: string;
}

export interface ResultadoBusqueda {
  total: number;
  pagina: number;
  porPagina: number;
  items: AlojamientoTarjeta[];
}

export interface FiltrosBusqueda {
  q?: string;
  provincia?: string;
  precioMin?: number;
  precioMax?: number;
  servicios?: string[];
  orden?: "recomendados" | "precio_asc" | "precio_desc";
  /** Entrada y salida (AAAA-MM-DD). Con las dos, se descartan los alojamientos ocupados. */
  desde?: string;
  hasta?: string;
  /** Viajeros: con dos o más, se descartan los alojamientos de menor capacidad. */
  huespedes?: number;
  pagina?: number;
  porPagina?: number;
}

/** ¿Es una fecha AAAA-MM-DD de verdad? Sin esto, un valor raro en la URL filtraría de más. */
function esFecha(v: string | undefined): boolean {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/* --------------------------------------------------------------- consultas -- */

/**
 * Búsqueda con paginación y filtros por provincia, precio y servicios.
 *
 * Los filtros son los mismos que ya ofrece la aplicación antigua, pero consultando el esquema
 * nuevo. Si no se pasa ningún filtro, se comporta como antes (texto libre sobre título, ciudad
 * y provincia) para no romper las llamadas existentes.
 */
export async function buscar(opciones: FiltrosBusqueda = {}): Promise<ResultadoBusqueda> {
  const q = (opciones.q ?? "").trim();
  const porPagina = Math.min(Math.max(opciones.porPagina ?? 12, 1), 48);
  const pagina = Math.max(opciones.pagina ?? 1, 1);
  const offset = (pagina - 1) * porPagina;

  const filtros = ["a.status = 'published'"];
  const valores: unknown[] = [];
  if (q !== "") {
    filtros.push("(a.title LIKE ? OR a.city LIKE ? OR a.province LIKE ?)");
    const like = `%${q}%`;
    valores.push(like, like, like);
  }
  if (opciones.provincia) {
    filtros.push("a.province = ?");
    valores.push(opciones.provincia);
  }
  if (typeof opciones.precioMin === "number" && Number.isFinite(opciones.precioMin)) {
    filtros.push("a.price_per_night >= ?");
    valores.push(opciones.precioMin);
  }
  if (typeof opciones.precioMax === "number" && Number.isFinite(opciones.precioMax)) {
    filtros.push("a.price_per_night <= ?");
    valores.push(opciones.precioMax);
  }
  /* Servicios: debe tenerlos TODOS los seleccionados (una condición por servicio, para que
     marcar dos servicios no devuelva alojamientos que solo tienen uno). */
  for (const serv of opciones.servicios ?? []) {
    filtros.push("EXISTS (SELECT 1 FROM accommodation_amenity am WHERE am.accommodation_id = a.id AND am.amenity = ?)");
    valores.push(serv);
  }
  /* Capacidad: solo se filtra cuando se piden dos o más viajeros. Con el valor por defecto (1) no
     se toca nada, para no cambiarle el resultado a quien no ha usado ese campo. */
  if (typeof opciones.huespedes === "number" && opciones.huespedes >= 2) {
    filtros.push("a.capacity IS NOT NULL AND a.capacity >= ?");
    valores.push(opciones.huespedes);
  }
  /* Fechas: se descartan los alojamientos con alguna noche ocupada o bloqueada en el rango. La
     disponibilidad vive en el esquema antiguo y se enlaza por `legacy_id`; la convención es la
     misma que usan las reservas: la noche de salida no cuenta como ocupada. */
  if (esFecha(opciones.desde) && esFecha(opciones.hasta) && (opciones.desde as string) < (opciones.hasta as string)) {
    filtros.push(
      `NOT EXISTS (SELECT 1 FROM hestiat.disponibilidad d
                    WHERE d.alojamiento_id = a.legacy_id AND d.fecha >= ? AND d.fecha < ?)`,
    );
    valores.push(opciones.desde, opciones.hasta);
  }
  const where = filtros.join(" AND ");

  const orden =
    opciones.orden === "precio_asc"
      ? "ORDER BY (a.price_per_night IS NULL), a.price_per_night ASC, a.id ASC"
      : opciones.orden === "precio_desc"
        ? "ORDER BY (a.price_per_night IS NULL), a.price_per_night DESC, a.id ASC"
        : "ORDER BY (a.price_per_night IS NULL), a.review_count DESC, a.id ASC";

  const [totalRows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM accommodation a WHERE ${where}`,
    valores,
  );
  const total = Number(totalRows[0]?.n ?? 0);

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT a.id, a.legacy_id, a.slug, a.title, a.city, a.province, a.country,
            a.price_per_night, a.indicative_price, a.price_type,
            a.capacity, a.bedrooms, a.beds, a.review_score, a.review_count,
            (SELECT COALESCE(p.origin_url, p.storage_key)
               FROM accommodation_photo p
              WHERE p.accommodation_id = a.id AND COALESCE(p.origin_url, p.storage_key) IS NOT NULL
              ORDER BY p.is_primary DESC, p.sort_order ASC
              LIMIT 1) AS portada
       FROM accommodation a
      WHERE ${where}
      ${orden}
      LIMIT ? OFFSET ?`,
    [...valores, porPagina, offset],
  );

  return { total, pagina, porPagina, items: rows as unknown as AlojamientoTarjeta[] };
}

/* --------------------------------------------------------------- mapa -- */

export interface PuntoMapa {
  id: number;
  slug: string;
  title: string;
  lat: string | null;
  lng: string | null;
  price_per_night: string | null;
  /** Precio estimado. Va aquí porque el marcador debe enseñar el MISMO precio que la tarjeta. */
  indicative_price: string | null;
  price_type: string;
}

/** Puntos para el mapa, con los mismos filtros que la búsqueda. Acotado para no saturar. */
export async function puntosDelMapa(opciones: FiltrosBusqueda = {}, limite = 300): Promise<PuntoMapa[]> {
  const r = await buscar({ ...opciones, pagina: 1, porPagina: Math.min(limite, 48) });
  const ids = r.items.map((a) => a.id);
  if (ids.length === 0) return [];
  const marcas = ids.map(() => "?").join(",");
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, slug, title, lat, lng, price_per_night, indicative_price, price_type
       FROM accommodation
      WHERE id IN (${marcas}) AND lat IS NOT NULL AND lng IS NOT NULL`,
    ids,
  );
  return rows as unknown as PuntoMapa[];
}

/* ------------------------------------------------------------ sugerencias -- */

export interface Sugerencia {
  /** ciudad | provincia | alojamiento */
  tipo: string;
  texto: string;
  /** Cuántos alojamientos publicados coinciden. Dato real, no estimado. */
  total: number;
}

/**
 * Sugerencias para la barra de búsqueda, sacadas del propio catálogo.
 *
 * Se buscan ciudades, provincias y nombres de alojamiento que empiecen o contengan lo escrito, y se
 * ordenan por cuántos alojamientos hay detrás: así lo primero que se ofrece es lo que de verdad
 * tiene resultados. Nada inventado: todo sale de `accommodation`.
 */
export async function sugerenciasDestino(consulta: string, limite = 8): Promise<Sugerencia[]> {
  const q = (consulta ?? "").trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const empieza = `${q}%`;

  const [ciudades, provincias, titulos] = await Promise.all([
    pool.query<mysql.RowDataPacket[]>(
      `SELECT city AS texto, COUNT(*) AS total FROM accommodation
        WHERE status = 'published' AND city IS NOT NULL AND city <> '' AND city LIKE ?
        GROUP BY city ORDER BY (city LIKE ?) DESC, total DESC LIMIT 5`,
      [like, empieza],
    ),
    pool.query<mysql.RowDataPacket[]>(
      `SELECT province AS texto, COUNT(*) AS total FROM accommodation
        WHERE status = 'published' AND province IS NOT NULL AND province <> '' AND province LIKE ?
        GROUP BY province ORDER BY (province LIKE ?) DESC, total DESC LIMIT 3`,
      [like, empieza],
    ),
    pool.query<mysql.RowDataPacket[]>(
      `SELECT title AS texto, COUNT(*) AS total FROM accommodation
        WHERE status = 'published' AND title LIKE ?
        GROUP BY title ORDER BY (title LIKE ?) DESC, total DESC LIMIT 4`,
      [like, empieza],
    ),
  ]);

  const lista: Sugerencia[] = [
    ...ciudades[0].map((f) => ({ tipo: "ciudad", texto: String(f.texto), total: Number(f.total ?? 0) })),
    ...provincias[0].map((f) => ({ tipo: "provincia", texto: String(f.texto), total: Number(f.total ?? 0) })),
    ...titulos[0].map((f) => ({ tipo: "alojamiento", texto: String(f.texto), total: Number(f.total ?? 0) })),
  ];

  // Sin repetidos: una ciudad que además es provincia se enseña una sola vez.
  const vistos = new Set<string>();
  return lista
    .filter((s) => {
      const clave = s.texto.toLowerCase();
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    })
    .slice(0, limite);
}

/* ---------------------------------------------------- opciones de filtro -- */

export interface OpcionesFiltros {
  provincias: { province: string; total: number }[];
  /** `amenity` es el identificador que usa el filtro; `nombre` es lo que se muestra. */
  servicios: { amenity: string; nombre: string | null; total: number }[];
  precioMax: number;
}

/** Opciones reales para el panel de filtros: provincias con recuento, servicios con recuento. */
export async function opcionesDeFiltros(): Promise<OpcionesFiltros> {
  const [prov] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT province, COUNT(*) AS total FROM accommodation
      WHERE status = 'published' AND province IS NOT NULL AND province <> ''
      GROUP BY province ORDER BY total DESC`,
  );
  // El nombre del servicio vive en el diccionario `servicio`: `accommodation_amenity.amenity`
  // guarda solo su identificador. Sin esta unión, el panel de filtros mostraba «1 (5769)»,
  // «19 (2031)»… que no dice nada a nadie.
  const [serv] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT am.amenity, s.nombre, COUNT(*) AS total
       FROM accommodation_amenity am
       JOIN accommodation a ON a.id = am.accommodation_id AND a.status = 'published'
       LEFT JOIN servicio s ON s.id = CAST(am.amenity AS UNSIGNED)
      GROUP BY am.amenity, s.nombre ORDER BY total DESC LIMIT 14`,
  );
  const [precio] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COALESCE(MAX(price_per_night), 500) AS maximo FROM accommodation WHERE status = 'published' AND price_per_night IS NOT NULL`,
  );
  return {
    provincias: prov as unknown as { province: string; total: number }[],
    servicios: serv as unknown as { amenity: string; nombre: string | null; total: number }[],
    precioMax: Math.ceil(Number(precio[0]?.maximo ?? 500)),
  };
}

/** Ficha por slug (URL limpia). Acepta también el identificador antiguo para no romper enlaces. */
export async function fichaPorSlug(slugOId: string): Promise<{ alojamiento: AlojamientoFicha; fotos: Foto[]; servicios: Servicio[] } | null> {
  const esNumero = /^\d+$/.test(slugOId);
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT * FROM accommodation WHERE ${esNumero ? "legacy_id = ? OR id = ?" : "slug = ?"} LIMIT 1`,
    esNumero ? [Number(slugOId), Number(slugOId)] : [slugOId],
  );
  const alojamiento = rows[0] as unknown as AlojamientoFicha | undefined;
  if (!alojamiento) return null;

  const [fotos] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, COALESCE(origin_url, storage_key) AS url, storage_key, alt, width, height, is_primary
       FROM accommodation_photo WHERE accommodation_id = ? ORDER BY is_primary DESC, sort_order ASC LIMIT 12`,
    [alojamiento.id],
  );
  const [servicios] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT amenity FROM accommodation_amenity WHERE accommodation_id = ? ORDER BY amenity LIMIT 40`,
    [alojamiento.id],
  );
  return { alojamiento, fotos: fotos as unknown as Foto[], servicios: servicios as unknown as Servicio[] };
}

/** Recuentos del esquema nuevo: sirve para verificar la migración de un vistazo. */
export async function recuentos(): Promise<Record<string, number>> {
  const tablas = ["accommodation", "accommodation_photo", "accommodation_amenity", "user", "reservation", "review", "availability", "calendar_feed"];
  const out: Record<string, number> = {};
  for (const t of tablas) {
    const [r] = await pool.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n FROM \`${t}\``);
    out[t] = Number(r[0]?.n ?? 0);
  }
  return out;
}

/* --------------------------------------------------------- portada nueva -- */

export interface ProvinciaDestino {
  province: string;
  total: number;
  portada: string | null;
}

/** Provincias con más alojamientos publicados, cada una con una foto representativa real. */
export async function destinosDestacados(limite = 12): Promise<ProvinciaDestino[]> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT a.province,
            COUNT(*) AS total,
            (SELECT COALESCE(p.origin_url, p.storage_key)
               FROM accommodation_photo p
               JOIN accommodation b ON b.id = p.accommodation_id
              WHERE b.province = a.province AND b.status = 'published'
                AND COALESCE(p.origin_url, p.storage_key) IS NOT NULL
              ORDER BY p.is_primary DESC, p.sort_order ASC
              LIMIT 1) AS portada
       FROM accommodation a
      WHERE a.status = 'published' AND a.province IS NOT NULL AND a.province <> ''
      GROUP BY a.province
      ORDER BY total DESC
      LIMIT ?`,
    [limite],
  );
  return rows as unknown as ProvinciaDestino[];
}

export interface EstiloDestino {
  clave: string;
  etiqueta: string;
  descripcion: string;
  portada: string | null;
  total: number;
}

/** Primera foto disponible para un conjunto de condiciones, con su recuento. */
async function portadaYTotal(condicion: string, valor: unknown[]): Promise<{ portada: string | null; total: number }> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            (SELECT COALESCE(p.origin_url, p.storage_key)
               FROM accommodation a2
               JOIN accommodation_photo p ON p.accommodation_id = a2.id
              WHERE ${condicion.replace(/\ba\./g, "a2.")}
                AND COALESCE(p.origin_url, p.storage_key) IS NOT NULL
              ORDER BY p.is_primary DESC, p.sort_order ASC
              LIMIT 1) AS portada
       FROM accommodation a
      WHERE ${condicion}`,
    // Los marcadores aparecen DOS veces en la consulta: una en la subconsulta que busca la
    // portada y otra en el WHERE exterior. Si se pasan una sola vez, MySQL rechaza la
    // sentencia y la portada devuelve 500 (visto en producción en el cutover).
    [...valor, ...valor],
  );
  const r = rows[0];
  return { portada: (r?.portada as string) ?? null, total: Number(r?.total ?? 0) };
}

/**
 * Los cuatro atajos por forma de viajar, con foto real y recuento real.
 * Las condiciones son heurísticas transparentes sobre datos que YA tenemos
 * (provincia costera, provincia de montaña, nombre con carácter histórico,
 * capacidad familiar). No se inventa ninguna clasificación que no exista.
 */
export async function estilosDeViaje(): Promise<EstiloDestino[]> {
  const COSTA = ["Alacant/Alicante", "Málaga", "Illes Balears", "Girona", "Barcelona", "València/Valencia", "Tarragona", "Cantabria", "A Coruña", "Pontevedra", "Las Palmas", "Santa Cruz de Tenerife", "Murcia", "Cádiz", "Huelva", "Castelló/Castellón", "Gipuzkoa/Guipúzcoa", "Bizkaia/Vizcaya"];
  const MONTAÑA = ["Asturias", "Cantabria", "Granada", "Segovia", "Ávila", "Navarra", "Huesca", "Lleida", "Girona", "Teruel", "Cuenca", "Jaén", "La Rioja", "Palencia", "Soria", "León"];
  /*
   * SIN marcadores. En producción, esta consulta llegaba a MySQL con los `?` literales y
   * fallaba con ER_PARSE_ERROR (errno 1064) al construir la portada. La causa es que la
   * lista aparece DOS veces en la sentencia (subconsulta de portada + WHERE exterior) y la
   * interpolación no cubría ambas.
   *
   * Los valores son constantes de este fichero, no entrada de usuario, así que se incrustan
   * ya citados y escapados: el SQL deja de depender de la interpolación de parámetros y el
   * problema desaparece de raíz, no se parchea.
   */
  const lista = (arr: string[]) => arr.map((v) => "'" + v.replace(/'/g, "''") + "'").join(",");

  const [costa, montana, historia, familias] = await Promise.all([
    portadaYTotal(`a.status='published' AND a.province IN (${lista(COSTA)})`, []),
    portadaYTotal(`a.status='published' AND a.province IN (${lista(MONTAÑA)})`, []),
    portadaYTotal(
      `a.status='published' AND (a.title LIKE '%casa%' OR a.title LIKE '%palacio%' OR a.title LIKE '%convento%' OR a.title LIKE '%castillo%' OR a.title LIKE '%monasterio%' OR a.title LIKE '%torre%')`,
      [],
    ),
    portadaYTotal(`a.status='published' AND a.capacity >= 6`, []),
  ]);

  return [
    { clave: "mar", etiqueta: "Costa y mar", descripcion: "Casas junto al agua", ...costa },
    { clave: "montana", etiqueta: "Paisaje de montaña", descripcion: "Valles y sierras", ...montana },
    { clave: "historia", etiqueta: "Arquitectura histórica", descripcion: "Casas con historia", ...historia },
    { clave: "familias", etiqueta: "Planes en familia", descripcion: "Espacio para todos", ...familias },
  ];
}

/** Alojamientos destacados: con foto, con precio publicado y orden estable. */
export async function destacados(limite = 8): Promise<AlojamientoTarjeta[]> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT a.id, a.legacy_id, a.slug, a.title, a.city, a.province, a.country,
            a.price_per_night, a.indicative_price, a.price_type,
            a.capacity, a.bedrooms, a.beds, a.review_score, a.review_count,
            (SELECT COALESCE(p.origin_url, p.storage_key)
               FROM accommodation_photo p
              WHERE p.accommodation_id = a.id AND COALESCE(p.origin_url, p.storage_key) IS NOT NULL
              ORDER BY p.is_primary DESC, p.sort_order ASC LIMIT 1) AS portada
       FROM accommodation a
      WHERE a.status = 'published'
      ORDER BY (a.price_per_night IS NULL), a.review_count DESC, a.id ASC
      LIMIT ?`,
    [limite],
  );
  return rows as unknown as AlojamientoTarjeta[];
}

/**
 * Tarjetas para una lista concreta de ids, conservando el orden recibido.
 *
 * Se usa en favoritos: el orden lo decide el usuario (lo último guardado, primero) y debe
 * mantenerse, no reordenarse por id. Solo lectura y parametrizado.
 */
export async function porIds(ids: number[]): Promise<AlojamientoTarjeta[]> {
  const limpios = ids.filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
  if (limpios.length === 0) return [];
  const huecos = limpios.map(() => "?").join(",");
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT a.id, a.legacy_id, a.slug, a.title, a.city, a.province, a.country,
            a.price_per_night, a.indicative_price, a.price_type,
            a.capacity, a.bedrooms, a.beds, a.review_score, a.review_count,
            (SELECT COALESCE(p.origin_url, p.storage_key)
               FROM accommodation_photo p
              WHERE p.accommodation_id = a.id AND COALESCE(p.origin_url, p.storage_key) IS NOT NULL
              ORDER BY p.is_primary DESC, p.sort_order ASC LIMIT 1) AS portada
       FROM accommodation a
      WHERE a.id IN (${huecos})
      ORDER BY FIELD(a.id, ${huecos})`,
    [...limpios, ...limpios],
  );
  return rows as unknown as AlojamientoTarjeta[];
}
