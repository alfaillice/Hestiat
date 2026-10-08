/**
 * MOTOR DE ENRIQUECIMIENTO DE CATÁLOGO — SOLO SERVIDOR.
 *
 * Un solo motor para experiencias, servicios y (preparado) alojamientos. No hay código duplicado: lo
 * único que cambia por tipo es de qué tabla se lee la ficha y cómo se llaman sus columnas; a partir
 * de ahí, el proceso es el mismo.
 *
 * PRINCIPIOS QUE RESPETA, y que son la razón de que exista:
 *
 *  · NUNCA se toca el dato original. Lo que trae Internet se guarda aparte, en `catalogo_dato`, con
 *    su valor original (lo que había), su valor enriquecido, la fuente, la URL, el tipo de fuente y
 *    la confianza. El catálogo original queda intacto y siempre se puede comparar.
 *
 *  · IDEMPOTENCIA. Cada ficha tiene su estado en `catalogo_enriquecimiento`. Si ya está enriquecida
 *    con la versión actual, no se vuelve a procesar. Volver a lanzar un lote no repite trabajo.
 *
 *  · REANUDABLE. El lote guarda por dónde va (`avance`). Si se corta en la ficha 247, el siguiente
 *    arranque sigue desde ahí, sin empezar de cero.
 *
 *  · ERRORES AISLADOS. Un fallo en una ficha no detiene el lote: se anota el motivo, se marca
 *    `error` y se sigue con la siguiente. Los reintentos son limitados; no hay bucles.
 *
 *  · RITMO CONTROLADO. Una petición por ficha, con tiempo máximo y una pausa entre fichas. Nada de
 *    miles de consultas a la vez.
 *
 *  · SIN INVENTAR. Si un dato no se puede verificar, no se escribe. Se marca `not_found` o
 *    `needs_review` y ahí queda, para que el panel lo revise.
 */
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";

import { resolveCatalogEntity, NIVELES, type FuenteEncontrada } from "@/lib/resolucion.server";

export type TipoCatalogo = "experience" | "service" | "accommodation";
export type Estado =
  | "pending"
  | "processing"
  | "enriched"
  | "partial"
  | "needs_review"
  | "not_found"
  | "not_found_after_search"
  | "source_failed"
  | "error";
/**
 * POR QUÉ acabó así una ficha. Es la diferencia que importa: «la fuente original falló» NO es lo
 * mismo que «se buscó y no hay nada público». Lo primero habla de nuestros datos; lo segundo, del
 * mundo. Se guarda por ficha para poder mirarlo después.
 */
export type Motivo =
  | "ok"
  | "no_url"
  | "dead_url"
  | "redirect"
  | "source_exists_no_public_data"
  | "ambiguous_identity"
  | "not_located"
  | "insufficient_evidence"
  | "no_price_found"
  | "no_image_found";
export type Confianza = "high" | "medium" | "low";

export const VERSION_MOTOR = 4;

/** Ficha normalizada: lo mismo para los tres catálogos. */
export interface FichaCatalogo {
  id: number;
  nombre: string;
  descripcion: string | null;
  resumen: string | null;
  web: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  municipio: string | null;
  provincia: string | null;
  lat: number | null;
  lng: number | null;
  imagen: string | null;
  precioValor: number | null;
  precioTipo: string | null;
  categoria: string | null;
  subcategoria: string | null;
  confianzaClasificacion: Confianza | null;
  origenClasificacion: string | null;
}

/* ------------------------------------------------------ lectura por tipo -- */

const CONSULTAS: Record<TipoCatalogo, string> = {
  experience: `
    SELECT e.id, e.name AS nombre, e.description AS descripcion, e.short_description AS resumen,
           e.website_url AS web, e.phone AS telefono, e.email AS email, e.address AS direccion,
           e.municipality AS municipio, e.province AS provincia, e.latitude AS lat, e.longitude AS lng,
           e.main_image AS imagen, e.price AS precioValor, e.price_type AS precioTipo,
           c.nombre AS categoria, s.nombre AS subcategoria, cl.confianza AS confianzaClasificacion, cl.origen AS origenClasificacion
      FROM experiencia e
      LEFT JOIN experiencia_clasificacion cl ON cl.experiencia_id = e.id
      LEFT JOIN exp_categoria c ON c.id = cl.categoria_id
      LEFT JOIN exp_categoria s ON s.id = cl.subcategoria_id
     WHERE e.id = ? LIMIT 1`,
  service: `
    SELECT s.id, s.name AS nombre, s.short_description AS descripcion, s.short_description AS resumen,
           s.website_url AS web, s.phone AS telefono, s.email AS email, s.address AS direccion,
           s.municipality AS municipio, s.province AS provincia, s.latitude AS lat, s.longitude AS lng,
           s.main_image AS imagen, s.price AS precioValor, s.price_type AS precioTipo,
           c.nombre AS categoria, sub.nombre AS subcategoria, cl.confianza AS confianzaClasificacion, cl.origen AS origenClasificacion
      FROM servicio_turistico s
      LEFT JOIN servicio_clasificacion cl ON cl.servicio_id = s.id
      LEFT JOIN serv_categoria c ON c.id = cl.categoria_id
      LEFT JOIN serv_categoria sub ON sub.id = cl.subcategoria_id
     WHERE s.id = ? LIMIT 1`,
  // Preparado para cuando toque: el alojamiento tiene los mismos campos con otros nombres.
  accommodation: `
    SELECT a.id, a.title AS nombre, a.description AS descripcion, a.description AS resumen,
           NULL AS web, NULL AS telefono, NULL AS email, a.address AS direccion,
           a.city AS municipio, a.province AS provincia, a.lat AS lat, a.lng AS lng,
           (SELECT COALESCE(p.origin_url, p.storage_key) FROM accommodation_photo p WHERE p.accommodation_id = a.id
             ORDER BY p.is_primary DESC, p.sort_order ASC LIMIT 1) AS imagen,
           a.price_per_night AS precioValor, a.price_type AS precioTipo,
           NULL AS categoria, NULL AS subcategoria, NULL AS confianzaClasificacion, NULL AS origenClasificacion
      FROM accommodation a WHERE a.id = ? LIMIT 1`,
};

export async function leerFicha(tipo: TipoCatalogo, id: number): Promise<FichaCatalogo | null> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(CONSULTAS[tipo], [id]);
  const f = filas[0];
  if (!f) return null;
  const conf = String(f.confianzaClasificacion ?? "");
  return {
    id: Number(f.id),
    nombre: String(f.nombre ?? ""),
    descripcion: f.descripcion ?? null,
    email: f.email ?? null,
    resumen: f.resumen ?? null,
    web: f.web ?? null,
    telefono: f.telefono ?? null,
    direccion: f.direccion ?? null,
    municipio: f.municipio ?? null,
    provincia: f.provincia ?? null,
    lat: f.lat !== null ? Number(f.lat) : null,
    lng: f.lng !== null ? Number(f.lng) : null,
    imagen: f.imagen ?? null,
    precioValor: f.precioValor !== null ? Number(f.precioValor) : null,
    precioTipo: f.precioTipo ?? null,
    categoria: f.categoria ?? null,
    subcategoria: f.subcategoria ?? null,
    confianzaClasificacion: conf === "alta" ? "high" : conf === "media" ? "medium" : conf === "baja" ? "low" : null,
    origenClasificacion: f.origenClasificacion ?? null,
  };
}

/* --------------------------------------------------------- estado y datos -- */

export async function estadoDe(tipo: TipoCatalogo, id: number): Promise<{ estado: Estado; version: number } | null> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT estado, enrichment_version FROM catalogo_enriquecimiento WHERE catalog_type = ? AND item_id = ? LIMIT 1`,
    [tipo, id],
  );
  const f = filas[0];
  return f ? { estado: String(f.estado) as Estado, version: Number(f.enrichment_version) } : null;
}

async function marcarEstado(
  tipo: TipoCatalogo,
  id: number,
  estado: Estado,
  opciones: { campos?: number; error?: string | null; lote?: number | null } = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO catalogo_enriquecimiento (catalog_type, item_id, estado, campos_enriquecidos, intentos, ultimo_error, last_enriched_at, enrichment_version, lote_id, actualizado_en)
     VALUES (?,?,?,?,1,?,NOW(),?,?,NOW())
     ON DUPLICATE KEY UPDATE estado = VALUES(estado), campos_enriquecidos = VALUES(campos_enriquecidos),
       intentos = intentos + 1, ultimo_error = VALUES(ultimo_error), last_enriched_at = NOW(),
       enrichment_version = VALUES(enrichment_version), lote_id = VALUES(lote_id), actualizado_en = NOW()`,
    [tipo, id, estado, opciones.campos ?? 0, opciones.error ?? null, VERSION_MOTOR, opciones.lote ?? null],
  );
}

async function guardarDato(
  tipo: TipoCatalogo,
  id: number,
  campo: string,
  original: string | null,
  enriquecido: string,
  fuente: { source: string; name: string | null; url: string | null; type: string | null; confidence: Confianza },
  lote: number | null,
  extra: {
    priority?: number | null;
    originalSourceUrl?: string | null;
    verificacion?: string | null;
    moneda?: string | null;
    tipoPrecio?: string | null;
    priceUnit?: string | null;
  } = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO catalogo_dato (catalog_type, item_id, campo, original_value, enriched_value, moneda, tipo_precio, price_unit, source, source_priority, source_name, source_url, original_source_url, verificacion, source_type, confidence, verified_at, lote_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),?)
     ON DUPLICATE KEY UPDATE enriched_value = VALUES(enriched_value), original_value = VALUES(original_value),
       moneda = VALUES(moneda), tipo_precio = VALUES(tipo_precio), price_unit = VALUES(price_unit),
       source = VALUES(source), source_priority = VALUES(source_priority), source_name = VALUES(source_name),
       source_url = VALUES(source_url), original_source_url = VALUES(original_source_url),
       verificacion = VALUES(verificacion), source_type = VALUES(source_type),
       confidence = VALUES(confidence), verified_at = NOW(), lote_id = VALUES(lote_id)`,
    [
      tipo, id, campo, original, enriquecido.slice(0, 700), extra.moneda ?? null, extra.tipoPrecio ?? null, extra.priceUnit ?? null,
      fuente.source, extra.priority ?? null,
      fuente.name, fuente.url, extra.originalSourceUrl ?? null, extra.verificacion ?? null,
      fuente.type, fuente.confidence, lote,
    ],
  );
}

/**
 * Deja anotado por qué acabó así la ficha: si la fuente original servía o falló, con qué motivo, qué
 * fuente se acabó usando y con qué confianza se comprobó la identidad.
 */
async function anotarDiagnostico(
  tipo: TipoCatalogo,
  id: number,
  d: {
    motivo?: Motivo | null;
    /** Las cuatro clases que se pidieron, tal cual: de dónde acabó saliendo el dato. */
    claseFuente?: string | null;
    estadoFuenteOriginal?: "ok" | "source_failed" | "sin_url" | null;
    fuenteVerificada?: string | null;
    confianzaIdentidad?: Confianza | null;
    motores?: string | null;
    /** HIGH / MEDIUM / LOW / AMBIGUOUS / NOT_FOUND, con todas las señales que se usaron. */
    confianzaResolucion?: string | null;
    fuentesUsadas?: string | null;
  },
): Promise<void> {
  await pool.query(
    `UPDATE catalogo_enriquecimiento
        SET motivo = ?, clase_fuente = ?, estado_fuente_original = ?, fuente_verificada_url = ?,
            confianza_identidad = ?, motores = ?, confianza_resolucion = ?, fuentes_usadas = ?,
            actualizado_en = NOW()
      WHERE catalog_type = ? AND item_id = ?`,
    [
      d.motivo ?? null, d.claseFuente ?? null, d.estadoFuenteOriginal ?? null, d.fuenteVerificada ?? null,
      d.confianzaIdentidad ?? null, d.motores ?? null, d.confianzaResolucion ?? null, d.fuentesUsadas ?? null,
      tipo, id,
    ],
  );
}

/**
 * Anota una propuesta para revisión. La estructura ya está lista para que un administrador pueda
 * decidir: aprobar, rechazar, corregir o volver a buscar.
 */
async function anotarRevision(
  tipo: TipoCatalogo,
  id: number,
  problema: string,
  detalle: string,
  lote: number | null,
  extra: { confianza?: string | null; propuesta?: string | null } = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO catalogo_revision (catalog_type, item_id, problema, detalle, confianza, propuesta, lote_id) VALUES (?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE detalle = VALUES(detalle), confianza = VALUES(confianza),
       propuesta = VALUES(propuesta), lote_id = VALUES(lote_id)`,
    [tipo, id, problema.slice(0, 200), detalle.slice(0, 700), extra.confianza ?? null, extra.propuesta ?? null, lote],
  );
}

/** Las fuentes encontradas se guardan aparte: una puede confirmar la existencia y otra el precio. */
async function guardarFuente(
  tipo: TipoCatalogo,
  id: number,
  f: FuenteEncontrada,
  lote: number | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO catalogo_fuente (catalog_type, item_id, url, nivel, tipo, procedencia, nombre, confianza, aporta, lote_id)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE nivel = VALUES(nivel), tipo = VALUES(tipo), procedencia = VALUES(procedencia),
       nombre = VALUES(nombre), confianza = VALUES(confianza), aporta = VALUES(aporta), lote_id = VALUES(lote_id)`,
    [
      tipo, id, f.url.slice(0, 700), f.nivel, f.tipo.slice(0, 40), f.procedencia.slice(0, 120),
      (f.nombre ?? "").slice(0, 200) || null, f.confianza, f.senales.join(", ").slice(0, 200), lote,
    ],
  );
}

async function registrar(
  tipo: TipoCatalogo,
  id: number,
  estado: string,
  campos: string[],
  fuente: string | null,
  resultado: string,
  error: string | null,
  lote: number | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO catalogo_log (catalog_type, item_id, estado, campos_modificados, fuente, resultado, error, lote_id)
     VALUES (?,?,?,?,?,?,?,?)`,
    [tipo, id, estado, campos.join(",").slice(0, 400), fuente, resultado.slice(0, 400), error, lote],
  );
}

/* ------------------------------------------------------- lectura externa -- */

/** No se piden direcciones internas ni inventadas: solo http(s) públicas. */
function urlPermitida(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return false;
    if (h.includes(":")) return false;
    return true;
  } catch {
    return false;
  }
}

interface PaginaOficial {
  url: string;
  titulo: string | null;
  descripcion: string | null;
  imagen: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  precio: string | null;
  moneda: string | null;
}

function limpiarHtml(t: string): string {
  return t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Lo que la propia página declara: título, descripción, imagen social (og:image), teléfono (tel:),
 * dirección y precio si vienen en datos estructurados. No se interpreta ni se adivina nada.
 */
function parsearHtml(html: string, url: string): PaginaOficial {
    const meta = (nombre: string) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${nombre}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${nombre}["']`, "i"))?.[1] ??
      null;

    const tel = html.match(/href=["']tel:([+0-9][0-9\s().-]{6,20})["']/i)?.[1] ?? null;
    const correo = html.match(/href=["']mailto:([^"'?]+@[^"'?]+)["']/i)?.[1]?.trim() ?? null;

    // Datos estructurados: si la web los publica, son la fuente más fiable de dirección y precio.
    let direccion: string | null = null;
    let precio: string | null = null;
    let moneda: string | null = null;
    let telefonoEstructurado: string | null = null;
    let correoEstructurado: string | null = null;
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const datos = JSON.parse(m[1]);
        const lista = Array.isArray(datos) ? datos : [datos];
        for (const d of lista) {
          const dir = d?.address;
          if (!direccion && dir) {
            direccion = [dir.streetAddress, dir.postalCode, dir.addressLocality].filter(Boolean).join(", ") || null;
          }
          if (!telefonoEstructurado && d?.telephone) telefonoEstructurado = String(d.telephone);
          if (!correoEstructurado && d?.email) correoEstructurado = String(d.email);
          if (!precio && (d?.price || d?.offers?.price)) precio = String(d.price ?? d.offers.price);
          if (!moneda && (d?.priceCurrency || d?.offers?.priceCurrency)) moneda = String(d.priceCurrency ?? d.offers.priceCurrency);
        }
      } catch {
        /* un JSON-LD roto no rompe nada */
      }
    }

    return {
      url,
      titulo: limpiarHtml(meta("og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || null,
      descripcion: limpiarHtml(meta("og:description") ?? meta("description") ?? "") || null,
      imagen: meta("og:image") ?? null,
      telefono: telefonoEstructurado ?? (tel ? tel.trim() : null),
      email: correoEstructurado ?? correo,
      direccion,
      precio,
      moneda,
    };
}

interface Apertura {
  motivo: Motivo;
  pagina: PaginaOficial | null;
  final: string;
  estado: number | null;
  /** Texto visible de la página, para comprobar si de verdad habla de esta entidad. */
  texto: string;
}

/**
 * Abre una dirección y DICE QUÉ HA PASADO, no solo si hay página. No es lo mismo «la web está
 * muerta» que «la web responde pero no publica nada útil», ni que «esta dirección ahora lleva a
 * otro sitio»: esas tres cosas se guardan distintas, porque significan cosas distintas.
 */
async function abrirPagina(url: string, timeoutMs = 9000): Promise<Apertura> {
  if (!url || !urlPermitida(url)) return { motivo: "no_url", pagina: null, final: url, estado: null, texto: "" };
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: control.signal,
      redirect: "follow",
      headers: { "user-agent": "HestiatBot/2.0 (+https://hestiat.com; hola@hestiat.com)" },
    });
    const final = r.url || url;
    if (!r.ok) return { motivo: "dead_url", pagina: null, final, estado: r.status, texto: "" };
    const tipo = r.headers.get("content-type") ?? "";
    if (!tipo.includes("text/html")) return { motivo: "dead_url", pagina: null, final, estado: r.status, texto: "" };
    const html = (await r.text()).slice(0, 400_000);
    const pagina = parsearHtml(html, final);
    const texto = limpiarHtml(html).slice(0, 60_000);
    // Si acaba en OTRO dominio, la dirección guardada ya no lleva ahí: no se usa como fuente propia.
    let otroDominio = false;
    try {
      const a = new URL(final).hostname.replace(/^www\./, "");
      const b = new URL(url).hostname.replace(/^www\./, "");
      otroDominio = a !== b;
    } catch {
      /* una dirección rara no rompe nada */
    }
    if (otroDominio) return { motivo: "redirect", pagina, final, estado: r.status, texto };
    const util = Boolean(pagina.titulo || pagina.descripcion || pagina.imagen || pagina.precio || pagina.telefono);
    if (!util) return { motivo: "source_exists_no_public_data", pagina, final, estado: r.status, texto };
    return { motivo: "ok", pagina, final, estado: r.status, texto };
  } catch {
    return { motivo: "dead_url", pagina: null, final: url, estado: null, texto: "" };
  } finally {
    clearTimeout(t);
  }
}

/* ------------------------------------------------------------ un elemento -- */

export interface ResultadoFicha {
  id: number;
  estado: Estado;
  campos: string[];
  fuente: string | null;
  omitida?: boolean;
}

/**
 * Enriquece UNA ficha. Es la pieza que comparten los tres catálogos.
 *
 * Devuelve lo que ha pasado, sin lanzar: cualquier fallo se traduce en estado `error` con su motivo.
 */
export async function enriquecerFicha(
  tipo: TipoCatalogo,
  id: number,
  opciones: { lote?: number | null; forzar?: boolean } = {},
): Promise<ResultadoFicha> {
  const lote = opciones.lote ?? null;
  const ficha = await leerFicha(tipo, id);
  if (!ficha) {
    await marcarEstado(tipo, id, "not_found", { error: "La ficha no existe en el catálogo", lote });
    await registrar(tipo, id, "not_found", [], null, "No encontrada", null, lote);
    return { id, estado: "not_found", campos: [], fuente: null };
  }

  // Idempotencia: si ya está enriquecida con esta versión y no se fuerza, no se repite el trabajo.
  const previo = await estadoDe(tipo, id);
  // Se dan por acabados los estados terminales, incluidos los nuevos: así reanudar no repite trabajo
  // ya hecho, y una ficha a medias (partial) o a revisión sí se vuelve a intentar.
  if (
    !opciones.forzar &&
    previo &&
    previo.version === VERSION_MOTOR &&
    ["enriched", "not_found", "not_found_after_search", "source_failed"].includes(previo.estado)
  ) {
    return { id, estado: previo.estado, campos: [], fuente: null, omitida: true };
  }

  const campos: string[] = [];
  const revisar: [string, string][] = [];

  try {
    /* 1 · CLASIFICACIÓN. No se inventa: se registra la que ya tiene, con su confianza, y si es baja
       se manda a la cola de revisión. */
    if (ficha.categoria) {
      const conf: Confianza = ficha.confianzaClasificacion ?? "low";
      await guardarDato(tipo, id, "categoria", null, ficha.categoria, {
        source: "database", name: "Clasificación propia por reglas", url: null, type: ficha.origenClasificacion, confidence: conf,
      }, lote);
      if (ficha.subcategoria) {
        await guardarDato(tipo, id, "subcategoria", null, ficha.subcategoria, {
          source: "database", name: "Clasificación propia por reglas", url: null, type: ficha.origenClasificacion, confidence: conf,
        }, lote);
      }
      campos.push("categoria", "subcategoria");
      if (conf === "low") revisar.push(["clasificación dudosa", `Se propone ${ficha.categoria} con confianza baja`]);
    } else {
      revisar.push(["sin clasificar", "No se ha podido asignar categoría con seguridad"]);
    }

    /* 2 · RESOLUCIÓN MULTIFUENTE. Todo el trabajo —abrir la fuente original, buscar por niveles (web
       oficial, turismo local y regional, directorios, mapas, OSM, redes del proveedor, municipal,
       sectorial y buscador general), comprobar la identidad con varias señales y extraer cada dato con
       su procedencia— vive en resolveCatalogEntity(). Aquí solo se GUARDA lo que devuelve. */
    const webOriginal = (ficha.web ?? "").trim();
    const resuelto = await resolveCatalogEntity({
      entity_type: tipo,
      entity_id: id,
      name: ficha.nombre,
      city: ficha.municipio,
      province: ficha.provincia,
      country: "España",
      original_url: webOriginal || null,
      existing_coordinates: { lat: ficha.lat, lng: ficha.lng },
      category: ficha.categoria,
      phone: ficha.telefono,
      address: ficha.direccion,
    });
    const motivoOriginal: Motivo = resuelto.reason;
    const paginaUrl = resuelto.sources[0]?.url ?? null;
    const nivelFuente = resuelto.sources[0]?.nivel ?? 1;
    const conf: Confianza = resuelto.confidence === "HIGH" ? "high" : resuelto.confidence === "MEDIUM" ? "medium" : "low";

    // Las fuentes se guardan aparte: una puede confirmar la existencia, otra el teléfono y otra el precio.
    for (const f of resuelto.sources) await guardarFuente(tipo, id, f, lote);

    // Si la ficha YA tenía el dato original, no se toca: lo enriquecido es un extra, nunca un reemplazo.
    const yaLoTiene: Record<string, boolean> = {
      descripcion: Boolean(ficha.descripcion),
      telefono: Boolean(ficha.telefono),
      email: Boolean(ficha.email),
      direccion: Boolean(ficha.direccion),
      precio_orientativo: Boolean(ficha.precioValor),
    };
    // La FOTOGRAFÍA es la excepción a propósito: aunque la ficha tenga imagen (casi siempre una de
    // referencia), la oficial verificada se guarda como CANDIDATA. Es la capa pública la que decide
    // cuál enseñar, y ahora sabe distinguir una oficial de una de Wikipedia.
    const yaTieneImagen = Boolean(ficha.imagen);

    for (const campo of resuelto.fields) {
      if (yaLoTiene[campo.campo]) continue;
      await guardarDato(tipo, id, campo.campo, null, campo.valor, {
        source: campo.fuenteNivel === 1 ? "official_web" : campo.fuenteNivel <= 3 ? "tourism_official" : "external_verified",
        name: campo.fuenteNombre,
        url: campo.fuenteUrl,
        type: campo.fuenteTipo,
        confidence: campo.confianza === "HIGH" ? "high" : campo.confianza === "MEDIUM" ? "medium" : "low",
      }, lote, {
        priority: campo.prioridad,
        originalSourceUrl: webOriginal || null,
        verificacion: campo.verificacion.slice(0, 120),
      });
      campos.push(campo.campo);
      await anotarRevision(
        tipo, id, `propuesta: ${campo.campo}`,
        `${campo.valor.slice(0, 220)} · ${campo.fuenteUrl ?? ""} · ${NIVELES[campo.fuenteNivel]} · confianza ${campo.confianza}`,
        lote,
        { confianza: campo.confianza, propuesta: JSON.stringify(campo) },
      );
    }

    /* FOTOGRAFÍA. El TIPO va guardado con cada imagen: una imagen de Wikipedia NUNCA se presenta como
       fotografía oficial del proveedor. */
    for (const img of resuelto.images) {
      await guardarDato(tipo, id, "imagen_oficial", null, img.url, {
        source: img.source_type === "oficial" ? "official_web" : img.source_type === "turismo_oficial" ? "tourism_official" : "external_verified",
        name: img.fuente,
        url: img.source_type === "wikipedia" ? img.url : paginaUrl,
        type: `imagen_${img.source_type}`,
        confidence: img.confianza === "HIGH" ? "high" : img.confianza === "MEDIUM" ? "medium" : "low",
      }, lote, {
        priority: nivelFuente,
        originalSourceUrl: webOriginal || null,
        verificacion: `imagen: ${img.source_type}`.slice(0, 120),
      });
      campos.push("imagen_oficial");
      await anotarRevision(
        tipo, id, `propuesta: imagen (${img.source_type})`,
        `${img.url.slice(0, 200)} · ${img.fuente ?? ""} · confianza ${img.confianza}`,
        lote,
        { confianza: img.confianza, propuesta: JSON.stringify(img) },
      );
    }

    /* PRECIO. Con valor, moneda, tipo y unidad, y la dirección exacta de donde salió. */
    if (resuelto.price && !yaLoTiene.precio_orientativo) {
      const p = resuelto.price;
      await guardarDato(tipo, id, "precio_orientativo", null, String(p.value), {
        source: nivelFuente === 1 ? "official_web" : nivelFuente <= 3 ? "tourism_official" : "external_verified",
        name: `Precio publicado (${p.price_type})`,
        url: p.source_url,
        type: `precio_${p.price_type.replace(/\s/g, "_")}`,
        confidence: p.confianza === "HIGH" ? "high" : "medium",
      }, lote, {
        priority: nivelFuente,
        originalSourceUrl: webOriginal || null,
        moneda: p.currency,
        tipoPrecio: p.price_type,
        priceUnit: p.price_unit,
        verificacion: `precio ${p.price_type} · ${p.price_unit}`.slice(0, 120),
      });
      campos.push("precio_orientativo");
      await anotarRevision(
        tipo, id, "propuesta: precio",
        `${p.value} ${p.currency} · ${p.price_type} (${p.price_unit}) · ${p.source_url} · confianza ${p.confianza}`,
        lote,
        { confianza: p.confianza, propuesta: JSON.stringify(p) },
      );
    }

    /* Lo que sigue faltando, cada cosa con su motivo específico: no todo es «no encontrado». */
    if (!ficha.descripcion && !resuelto.fields.some((f) => f.campo === "descripcion")) {
      revisar.push(["sin descripción", "Ni la ficha ni las fuentes publican descripción"]);
    }
    if (!ficha.precioValor && !resuelto.price) {
      revisar.push(["no_price_found", "No hay ninguna tarifa legible: se muestra «Consultar»"]);
    }
    if (!ficha.imagen && resuelto.images.length === 0) {
      revisar.push(["no_image_found", "No hay imagen propia, oficial ni de la entidad"]);
    }
    if (resuelto.confidence === "LOW" || resuelto.confidence === "AMBIGUOUS") {
      revisar.push([
        "confianza baja",
        `Coincidencia ${resuelto.confidence}: no se publica como dato verificado. Señales: ${resuelto.sources[0]?.senales.join(" + ") ?? "-"}`,
      ]);
    }
    for (const [problema, detalle] of revisar) await anotarRevision(tipo, id, problema, detalle, lote);

    /* 10 · ESTADO FINAL, con su diagnóstico y su confianza. */
    const estado: Estado =
      resuelto.status === "not_found"
        ? webOriginal
          ? "source_failed"
          : "not_found_after_search"
        : resuelto.status === "needs_review"
          ? "needs_review"
          : resuelto.status === "partial"
            ? "partial"
            : "enriched";
    await marcarEstado(tipo, id, estado, { campos: campos.length, lote });
    await anotarDiagnostico(tipo, id, {
      motivo: motivoOriginal,
      claseFuente:
        resuelto.confidence === "LOW" || resuelto.confidence === "AMBIGUOUS"
          ? "needs_review"
          : paginaUrl && webOriginal && motivoOriginal !== "ok"
            ? "source_original_failed_but_secondary_found"
            : "source_original_ok",
      estadoFuenteOriginal: webOriginal ? (motivoOriginal === "ok" ? "ok" : "source_failed") : "sin_url",
      fuenteVerificada: paginaUrl,
      confianzaIdentidad: conf,
      motores: resuelto.sources.map((s) => s.procedencia).join(" | ").slice(0, 255),
      confianzaResolucion: resuelto.confidence,
      fuentesUsadas: resuelto.sources.map((s) => `${s.nivel}:${s.tipo}`).join(" | ").slice(0, 400),
    });
    await registrar(tipo, id, estado, campos, paginaUrl, `Enriquecidos ${campos.length} campos · ${resuelto.confidence}`, null, lote);
    return { id, estado, campos, fuente: paginaUrl };
  } catch (error) {
    // Un fallo en una ficha no puede tumbar el lote: se anota y se sigue.
    const motivo = error instanceof Error ? error.message.slice(0, 200) : "error desconocido";
    await marcarEstado(tipo, id, "error", { campos: campos.length, error: motivo, lote });
    await registrar(tipo, id, "error", campos, null, "Error al procesar", motivo, lote);
    return { id, estado: "error", campos, fuente: null };
  }
}

/* ------------------------------------------------------------------ lotes -- */

export interface ResumenLote {
  lote: number;
  tipo: TipoCatalogo;
  /** Cómo acabó el lote: terminado, o en_curso si se cortó a mitad. */
  estado_final: "terminado" | "en_curso";
  desde: number;
  hasta: number;
  procesadas: number;
  completas: number;
  parciales: number;
  revision: number;
  noEncontradas: number;
  errores: number;
  omitidas: number;
  fotografias: number;
  precios: number;
  ubicaciones: number;
  estados: Record<string, number>;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Lanza un lote: procesa las fichas del tipo indicado, en orden de identificador, a partir de
 * `desde`. Guarda el avance en cada paso, así que se puede reanudar. Ritmo controlado: una ficha
 * cada `pausaMs`.
 */
export async function lanzarLote(
  tipo: TipoCatalogo,
  opciones: { desde?: number; limite?: number; pausaMs?: number; usuarioId?: number | null; forzar?: boolean } = {},
): Promise<ResumenLote> {
  const limite = Math.min(Math.max(opciones.limite ?? 50, 1), 500);
  const pausaMs = Math.min(Math.max(opciones.pausaMs ?? 250, 0), 5000);
  const desde = Math.max(0, opciones.desde ?? 0);

  const [ins] = await pool.query<mysql.ResultSetHeader>(
    `INSERT INTO catalogo_lote (catalog_type, desde, hasta, estado, iniciado_por) VALUES (?,?,?,'en_curso',?)`,
    [tipo, desde, 0, opciones.usuarioId ?? null],
  );
  const lote = Number(ins.insertId);

  const tabla = tipo === "experience" ? "experiencia" : tipo === "service" ? "servicio_turistico" : "accommodation";
  const filtroActivo = tipo === "experience" || tipo === "service" ? "AND is_active = 1" : "AND status = 'published'";
  const [ids] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM ${tabla} WHERE id > ? ${filtroActivo} ORDER BY id ASC LIMIT ?`,
    [desde, limite],
  );

  const r: ResumenLote = {
    lote, tipo, desde, hasta: 0, procesadas: 0, completas: 0, parciales: 0, revision: 0,
    estado_final: "terminado",
    noEncontradas: 0, errores: 0, omitidas: 0, fotografias: 0, precios: 0, ubicaciones: 0, estados: {},
  };

  for (const fila of ids) {
    const id = Number(fila.id);
    const res = await enriquecerFicha(tipo, id, { lote, forzar: opciones.forzar });
    r.procesadas += 1;
    r.hasta = id;
    r.estados[res.estado] = (r.estados[res.estado] ?? 0) + 1;
    if (res.omitida) r.omitidas += 1;
    if (res.estado === "enriched") r.completas += 1;
    if (res.estado === "partial") r.parciales += 1;
    if (res.estado === "needs_review") r.revision += 1;
    if (res.estado === "not_found") r.noEncontradas += 1;
    if (res.estado === "error") r.errores += 1;
    if (res.campos.includes("imagen_oficial")) r.fotografias += 1;
    if (res.campos.includes("precio_orientativo")) r.precios += 1;
    if (res.campos.includes("direccion")) r.ubicaciones += 1;
    // El avance se guarda ficha a ficha: si se corta aquí, se reanuda desde la siguiente.
    await pool.query(`UPDATE catalogo_lote SET avance = ?, actualizado_en = NOW() WHERE id = ?`, [id, lote]);
    if (pausaMs > 0) await dormir(pausaMs);
  }

  // El recuento de revisión del lote es el de la cola real, no una estimación.
  const [rev] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM catalogo_revision WHERE lote_id = ? AND estado = 'pendiente'`,
    [lote],
  );
  r.revision = Number(rev[0]?.n ?? 0);

  // TARIFAS COMPARTIDAS. Si el mismo precio de la MISMA web aparece en varias fichas distintas, es
  // una tarifa del sistema (un abono anual, una entrada general), no el precio propio de cada ficha.
  // Se marca para que no cuente como precio independiente ni se presente como el precio del negocio.
  await pool.query(
    `UPDATE catalogo_dato d
       JOIN (SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(source_url, '/', 3), '//', -1) AS host,
                    enriched_value AS valor, COUNT(DISTINCT CONCAT(catalog_type, '-', item_id)) AS n
               FROM catalogo_dato
              WHERE campo = 'precio_orientativo' AND lote_id = ?
              GROUP BY host, valor HAVING n > 1) g
         ON SUBSTRING_INDEX(SUBSTRING_INDEX(d.source_url, '/', 3), '//', -1) = g.host
        AND d.enriched_value = g.valor
        SET d.tarifa_compartida = 1
      WHERE d.campo = 'precio_orientativo' AND d.lote_id = ?`,
    [lote, lote],
  );

  await pool.query(
    `UPDATE catalogo_lote SET hasta = ?, estado = 'terminado', resumen = ?, actualizado_en = NOW() WHERE id = ?`,
    [r.hasta, JSON.stringify(r), lote],
  );
  return r;
}

/** Reanuda el último lote que quedó a medias del tipo indicado. */
export async function reanudarUltimoLote(tipo: TipoCatalogo, opciones: { limite?: number; pausaMs?: number } = {}): Promise<ResumenLote | null> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, avance FROM catalogo_lote WHERE catalog_type = ? AND estado IN ('en_curso','pausado')
      ORDER BY id DESC LIMIT 1`,
    [tipo],
  );
  const f = filas[0];
  if (!f) return null;
  await pool.query(`UPDATE catalogo_lote SET estado = 'pausado', actualizado_en = NOW() WHERE id = ?`, [Number(f.id)]);
  return lanzarLote(tipo, { desde: Number(f.avance ?? 0), ...opciones });
}

/** Resumen del estado de un catálogo, para el panel y para los informes. */
export async function situacion(tipo: TipoCatalogo): Promise<Record<string, number>> {
  const [filas] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT estado, COUNT(*) AS n FROM catalogo_enriquecimiento WHERE catalog_type = ? GROUP BY estado`,
    [tipo],
  );
  const out: Record<string, number> = {};
  for (const f of filas) out[String(f.estado)] = Number(f.n);
  return out;
}
