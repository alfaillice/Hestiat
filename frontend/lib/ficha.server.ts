/**
 * Datos de la ficha pública — SOLO servidor.
 *
 * Aquí se junta todo lo que la ficha necesita, y **solo lo que existe de verdad**. La auditoría de
 * datos dice: 27.357 alojamientos con coordenadas, pero solo 732 con capacidad, 3 con baños, 0 con
 * reseñas y 4 con precio real. Diseñar dando por hecho que esos datos están sería mentir.
 *
 * CONTROL DE CALIDAD DE FOTOGRAFÍAS (lo más importante de este fichero)
 * De 17.619 fotos, **17.616 vienen de Wikimedia**: son imágenes externas, no del alojamiento. Y 248
 * URLs están compartidas entre varias propiedades —una misma foto es la principal de hasta 116
 * alojamientos distintos—. Presentarlas como «la foto de esta casa» sería engañar al usuario.
 *
 * Por eso cada foto se clasifica:
 *   · `propia`      → la imagen no está marcada como compartida. Se puede presentar con normalidad.
 *   · `referencial` → está marcada como compartida o viene de una fuente externa. Se muestra, pero
 *                     etiquetada como imagen de referencia, nunca como fotografía del alojamiento.
 *
 * Si TODAS las fotos son referenciales, la ficha lo dice en vez de fingir una galería propia.
 */
import { pool, poolLegacy } from "@/lib/db";
import { miniatura } from "@/lib/miniatura";

export interface FotoFicha {
  id: number;
  url: string;
  alt: string | null;
  ancho: number | null;
  alto: number | null;
  /** true = imagen del propio alojamiento; false = imagen externa o compartida. */
  propia: boolean;
  fuente: string | null;
}

export interface NocheBloqueada {
  fecha: string;
  motivo: string;
}

export interface AnfitrionFicha {
  id: number;
  nombre: string;
  avatar: string | null;
  bio: string | null;
  desde: string | null;
  ciudad: string | null;
  alojamientos: number;
}

export interface SimilarFicha {
  id: number;
  slug: string;
  titulo: string;
  ciudad: string | null;
  provincia: string | null;
  precio: number | null;
  orientativo: boolean;
  portada: string | null;
  /** true = la portada es una imagen externa, no del propio alojamiento. */
  externa: boolean;
}

export interface ResenaFicha {
  id: number;
  autor: string;
  puntuacion: number | null;
  comentario: string | null;
  fecha: string | null;
  respuesta: string | null;
}

export interface DatosFicha {
  alojamiento: any;
  fotos: FotoFicha[];
  todasReferenciales: boolean;
  servicios: { id: number; slug: string | null; nombre: string; icono: string | null }[];
  nochesBloqueadas: NocheBloqueada[];
  anfitrion: AnfitrionFicha | null;
  /** Número de WhatsApp que el alojamiento tiene publicado como contacto, si lo hay. */
  whatsapp: string | null;
  similares: SimilarFicha[];
  resenas: ResenaFicha[];
  experiencias: { id: number; nombre: string; categoria: string | null; web: string | null }[];
  serviciosTuristicos: { id: number; nombre: string; categoria: string | null }[];
}

/** URLs marcadas como compartidas entre propiedades (una sola consulta, se reutiliza). */
let compartidas: Set<string> | null = null;
async function urlsCompartidas(): Promise<Set<string>> {
  if (compartidas) return compartidas;
  try {
    const [filas] = await poolLegacy.query<any[]>(
      `SELECT detalle FROM hestiat_incidencia WHERE clase = 'foto_compartida' LIMIT 5000`,
    );
    // El detalle guarda «N propiedades | url»: se extrae la URL.
    const set = new Set<string>();
    for (const f of filas) {
      const detalle = String(f.detalle ?? "");
      const i = detalle.indexOf("|");
      if (i > 0) set.add(detalle.slice(i + 1).trim());
    }
    compartidas = set;
  } catch {
    compartidas = new Set();
  }
  return compartidas;
}

function fuenteDe(url: string | null, origin: string | null): string | null {
  const u = (origin ?? url ?? "").toLowerCase();
  if (u.includes("wikimedia") || u.includes("wikipedia")) return "Wikimedia";
  if (u.includes("openstreetmap")) return "OpenStreetMap";
  if (u.includes("unsplash")) return "Unsplash";
  if (origin) return "Fuente externa";
  return null;
}

export async function datosDeFicha(slug: string): Promise<DatosFicha | null> {
  const [baseFilas] = await pool.query<any[]>(`SELECT * FROM accommodation WHERE slug = ? LIMIT 1`, [slug]);
  const a = baseFilas[0];
  if (!a) return null;
  const legacyId = a.legacy_id ? Number(a.legacy_id) : null;
  const id = Number(a.id);

  const compartidasSet = await urlsCompartidas();

  const [fotosFilas, serviciosFilas, bloquesFilas, resenasFilas] = await Promise.all([
    pool.query<any[]>(
      `SELECT id, COALESCE(origin_url, storage_key) AS url, alt, width, height, origin_url, storage_key, is_primary, sort_order
         FROM accommodation_photo WHERE accommodation_id = ? ORDER BY is_primary DESC, sort_order ASC LIMIT 40`,
      [id],
    ).then(([f]) => f).catch(() => []),
    // `accommodation_amenity.amenity` guarda el **id** del servicio, no su nombre. Sin esta unión la
    // ficha mostraba «1», «10», «12»… que no significa nada para nadie. Solo se muestran los códigos
    // que existen en el diccionario `servicio`; los que no están se omiten en vez de enseñar un
    // número suelto.
    pool.query<any[]>(
      `SELECT DISTINCT s.id, s.slug, s.nombre, s.icono
         FROM accommodation_amenity am
         JOIN servicio s ON s.id = CAST(am.amenity AS UNSIGNED)
        WHERE am.accommodation_id = ?
        ORDER BY s.nombre LIMIT 80`,
      [id],
    ).then(([f]) => f).catch(() => []),
    legacyId
      ? poolLegacy.query<any[]>(
          `SELECT fecha, motivo FROM disponibilidad
            WHERE alojamiento_id = ? AND fecha >= CURDATE() AND fecha < DATE_ADD(CURDATE(), INTERVAL 18 MONTH)
            ORDER BY fecha LIMIT 2000`,
          [legacyId],
        ).then(([f]) => f).catch(() => [])
      : Promise.resolve([]),
    pool.query<any[]>(
      `SELECT id, author_name, score, comment, host_reply, created_at FROM review
        WHERE accommodation_id = ? AND status <> 'hidden' ORDER BY created_at DESC LIMIT 10`,
      [id],
    ).then(([f]) => f).catch(() => []),
  ]);

  const fotos: FotoFicha[] = fotosFilas.map((f) => {
    const url = String(f.url ?? "");
    const origen = f.origin_url ?? f.storage_key ?? null;
    const esCompartida = compartidasSet.has(url);
    const externa = Boolean(origen && !url.includes(".r2.dev"));
    return {
      id: Number(f.id),
      // Se pide a 1200 px de ancho en lugar de 1600: la mitad de peso para el mismo uso.
      url: miniatura(url, 1200),
      alt: f.alt ?? null,
      ancho: f.width ? Number(f.width) : null,
      alto: f.height ? Number(f.height) : null,
      // Propia solo si NO está compartida y no es un enlace externo.
      propia: Boolean(url) && !esCompartida && !externa,
      fuente: fuenteDe(url, origen),
    };
  }).filter((f) => f.url);

  // El anfitrión: solo si existe el vínculo real. Con 3 vínculos en 27.359 alojamientos, inventarlo
  // sería lo más fácil y lo más deshonesto.
  let anfitrion: AnfitrionFicha | null = null;
  // `alojamiento_anfitrion.alojamiento_id` guarda el identificador ANTIGUO del alojamiento (el que en el
  // catálogo nuevo es `legacy_id`). Comprobado con los dos vínculos reales que existen.
  if (legacyId) {
    try {
      const [af] = await poolLegacy.query<any[]>(
        `SELECT u.id, u.nombre, u.nombre_mostrado, u.apellidos, u.avatar_url, u.bio, u.ciudad, u.creado_en,
                (SELECT COUNT(*) FROM alojamiento_anfitrion x WHERE x.usuario_id = u.id) AS cuantos
           FROM alojamiento_anfitrion af2
           JOIN usuario u ON u.id = af2.usuario_id
          WHERE af2.alojamiento_id = ? LIMIT 1`,
        [legacyId],
      );
      const h = af[0];
      if (h) {
        const nombre = String(h.nombre_mostrado || h.nombre || h.apellidos || "").trim();
        anfitrion = {
          id: Number(h.id),
          nombre: nombre || "Anfitrión",
          avatar: h.avatar_url ?? null,
          bio: h.bio ?? null,
          desde: h.creado_en ? String(h.creado_en).slice(0, 10) : null,
          ciudad: h.ciudad ?? null,
          alojamientos: Number(h.cuantos ?? 0),
        };
      }
    } catch {
      anfitrion = null;
    }
  }

  // Similares: misma provincia, publicados, excluyendo este. Nunca el mismo alojamiento.
  // Se ordena por número de fotos primero: sin eso salían tarjetas grises de alojamientos sin
  // ninguna imagen. 9.741 alojamientos del catálogo no tienen fotos, así que no es un caso raro.
  let similares: SimilarFicha[] = [];
  try {
    const [filas] = await pool.query<any[]>(
      `SELECT a.id, a.slug, a.title, a.city, a.province, a.price_per_night, a.indicative_price, a.price_type,
              (SELECT COALESCE(p.origin_url, p.storage_key) FROM accommodation_photo p
                WHERE p.accommodation_id = a.id AND COALESCE(p.origin_url, p.storage_key) IS NOT NULL
                ORDER BY p.is_primary DESC, p.sort_order ASC LIMIT 1) AS portada,
              (SELECT COUNT(*) FROM accommodation_photo p2 WHERE p2.accommodation_id = a.id) AS nfotos
         FROM accommodation a
        WHERE a.status='published' AND a.province = ? AND a.id <> ? AND a.slug IS NOT NULL AND a.slug <> ''
        ORDER BY nfotos DESC, a.review_count DESC, a.id ASC LIMIT 6`,
      [a.province ?? "", id],
    );
    similares = filas.map((f) => ({
      id: Number(f.id), slug: String(f.slug), titulo: String(f.title),
      ciudad: f.city ?? null, provincia: f.province ?? null,
      precio: Number(f.price_per_night) > 0 ? Number(f.price_per_night) : Number(f.indicative_price) || null,
      orientativo: String(f.price_type ?? "") !== "real",
      // Miniaturas a 400 px: seis tarjetas a 150 px de alto no necesitan 800 KB cada una.
      portada: f.portada ? miniatura(String(f.portada), 400) : null,
      // Igual que en la galería: si la imagen no está en nuestro almacenamiento, es de fuera y se
      // marca. Sin esta marca, la foto del Parador de Gredos aparecía como si fuera «La City Hotel».
      externa: Boolean(f.portada) && !String(f.portada).includes(".r2.dev"),
    }));
  } catch {
    similares = [];
  }

  // Experiencias y servicios que el anfitrión ha vinculado (si hay vínculos).
  let experiencias: DatosFicha["experiencias"] = [];
  let serviciosTuristicos: DatosFicha["serviciosTuristicos"] = [];
  if (legacyId) {
    try {
      const { enlazadasDelAlojamiento } = await import("@/lib/catalogo.server");
      const enl = await enlazadasDelAlojamiento(legacyId);
      experiencias = enl.experiencias.map((x) => ({ id: x.id, nombre: x.nombre, categoria: x.categoria, web: x.web }));
      serviciosTuristicos = enl.servicios.map((x) => ({ id: x.id, nombre: x.nombre, categoria: x.categoria }));
    } catch {
      /* si falla, la ficha sigue: son datos opcionales */
    }
  }

  // El WhatsApp del alojamiento: se lee del campo que YA existe para este uso. Si está vacío, la
  // ficha lo dirá en vez de enseñar un botón que llevaría a un contacto equivocado.
  let whatsapp: string | null = null;
  if (legacyId) {
    try {
      const [fila] = await poolLegacy.query<any[]>(`SELECT contact_whatsapp FROM alojamiento WHERE id = ? LIMIT 1`, [legacyId]);
      whatsapp = fila[0]?.contact_whatsapp ? String(fila[0].contact_whatsapp) : null;
    } catch {
      whatsapp = null;
    }
  }

  return {
    alojamiento: a,
    whatsapp,
    fotos,
    todasReferenciales: fotos.length > 0 && fotos.every((f) => !f.propia),
    servicios: serviciosFilas.map((s) => ({
      id: Number(s.id),
      slug: s.slug ? String(s.slug) : null,
      nombre: String(s.nombre),
      icono: s.icono ? String(s.icono) : null,
    })),
    nochesBloqueadas: bloquesFilas.map((b) => ({ fecha: String(b.fecha).slice(0, 10), motivo: String(b.motivo ?? "") })),
    anfitrion,
    similares,
    resenas: resenasFilas.map((r) => ({
      id: Number(r.id),
      autor: String(r.author_name ?? "Huésped"),
      puntuacion: r.score === null || r.score === undefined ? null : Number(r.score),
      comentario: r.comment ? String(r.comment) : null,
      fecha: r.created_at ? String(r.created_at).slice(0, 10) : null,
      respuesta: r.host_reply ? String(r.host_reply) : null,
    })),
    experiencias,
    serviciosTuristicos,
  };
}
