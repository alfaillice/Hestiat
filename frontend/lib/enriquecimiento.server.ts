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

import { buscarCandidatos, paginaHablaDe, type Candidato, type Identidad } from "@/lib/fuentes.server";
import { buscarPrecios } from "@/lib/precio-web.server";

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
  | "sin_url"
  | "url_muerta"
  | "url_incorrecta"
  | "sin_informacion_publica"
  | "entidad_ambigua"
  | "entidad_no_localizada"
  | "error_tecnico";
export type Confianza = "high" | "medium" | "low";

export const VERSION_MOTOR = 3;

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
  } = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO catalogo_dato (catalog_type, item_id, campo, original_value, enriched_value, moneda, tipo_precio, source, source_priority, source_name, source_url, original_source_url, verificacion, source_type, confidence, verified_at, lote_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),?)
     ON DUPLICATE KEY UPDATE enriched_value = VALUES(enriched_value), original_value = VALUES(original_value),
       moneda = VALUES(moneda), tipo_precio = VALUES(tipo_precio),
       source = VALUES(source), source_priority = VALUES(source_priority), source_name = VALUES(source_name),
       source_url = VALUES(source_url), original_source_url = VALUES(original_source_url),
       verificacion = VALUES(verificacion), source_type = VALUES(source_type),
       confidence = VALUES(confidence), verified_at = NOW(), lote_id = VALUES(lote_id)`,
    [
      tipo, id, campo, original, enriquecido.slice(0, 700), extra.moneda ?? null, extra.tipoPrecio ?? null,
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
  },
): Promise<void> {
  await pool.query(
    `UPDATE catalogo_enriquecimiento
        SET motivo = ?, clase_fuente = ?, estado_fuente_original = ?, fuente_verificada_url = ?,
            confianza_identidad = ?, motores = ?, actualizado_en = NOW()
      WHERE catalog_type = ? AND item_id = ?`,
    [
      d.motivo ?? null, d.claseFuente ?? null, d.estadoFuenteOriginal ?? null, d.fuenteVerificada ?? null,
      d.confianzaIdentidad ?? null, d.motores ?? null, tipo, id,
    ],
  );
}

async function anotarRevision(tipo: TipoCatalogo, id: number, problema: string, detalle: string, lote: number | null): Promise<void> {
  await pool.query(
    `INSERT INTO catalogo_revision (catalog_type, item_id, problema, detalle, lote_id) VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE detalle = VALUES(detalle), lote_id = VALUES(lote_id)`,
    [tipo, id, problema.slice(0, 200), detalle.slice(0, 700), lote],
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
  if (!url || !urlPermitida(url)) return { motivo: "sin_url", pagina: null, final: url, estado: null, texto: "" };
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: control.signal,
      redirect: "follow",
      headers: { "user-agent": "HestiatBot/2.0 (+https://hestiat.com; hola@hestiat.com)" },
    });
    const final = r.url || url;
    if (!r.ok) return { motivo: "url_muerta", pagina: null, final, estado: r.status, texto: "" };
    const tipo = r.headers.get("content-type") ?? "";
    if (!tipo.includes("text/html")) return { motivo: "url_muerta", pagina: null, final, estado: r.status, texto: "" };
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
    if (otroDominio) return { motivo: "url_incorrecta", pagina, final, estado: r.status, texto };
    const util = Boolean(pagina.titulo || pagina.descripcion || pagina.imagen || pagina.precio || pagina.telefono);
    if (!util) return { motivo: "sin_informacion_publica", pagina, final, estado: r.status, texto };
    return { motivo: "ok", pagina, final, estado: r.status, texto };
  } catch {
    return { motivo: "url_muerta", pagina: null, final: url, estado: null, texto: "" };
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

    /* 2 · LA FUENTE ORIGINAL, Y QUÉ PASA CON ELLA. Una dirección muerta NO significa que no haya
       información: significa que falló la fuente. Se anota la diferencia —404, otro destino, página
       vacía— y se sigue buscando por otra vía. */
    const webOriginal = (ficha.web ?? "").trim();
    const apertura = await abrirPagina(webOriginal);
    const motivoOriginal: Motivo = webOriginal ? apertura.motivo : "sin_url";
    let pagina = apertura.motivo === "ok" ? apertura.pagina : null;
    let usada: { url: string; prioridad: number; tipo: string; procedencia: string } | null = null;
    let identidadConfirmada: Confianza | null = pagina ? "high" : null;
    let motores = "";
    let imagenAlternativa: { url: string; procedencia: string } | null = null;
    let entidadLocalizada = false;

    /* 3 · SEGUNDA ESTRATEGIA. Si la dirección original no sirve, se busca la entidad en fuentes
       abiertas (Wikidata, Wikipedia, Nominatim) y se comprueba NOMBRE + UBICACIÓN antes de aceptar
       nada. No vale la primera que aparezca ni una que solo comparta una palabra. */
    if (!pagina) {
      const ident: Identidad = {
        nombre: ficha.nombre,
        municipio: ficha.municipio,
        provincia: ficha.provincia,
        pais: "España",
        lat: ficha.lat,
        lng: ficha.lng,
      };
      const busqueda = await buscarCandidatos(ident);
      motores = busqueda.motores.join(", ");
      entidadLocalizada = busqueda.localizada;
      let huboParecidos = false;
      for (const candidato of busqueda.candidatos.slice(0, 4)) {
        if (!candidato.nombreCoincide) {
          huboParecidos = true;
          continue;
        }
        const prueba = await abrirPagina(candidato.url);
        if (!prueba.pagina) continue;
        const habla = paginaHablaDe(prueba.texto, ident);
        if (!habla.nombre) {
          huboParecidos = true;
          continue;
        }
        // Aceptada: el nombre coincide y la página habla de la entidad. La ubicación fija la confianza.
        pagina = prueba.pagina;
        usada = { url: prueba.final, prioridad: candidato.prioridad, tipo: candidato.tipo, procedencia: candidato.procedencia };
        identidadConfirmada =
          habla.lugar || candidato.ubicacionCoincide === true
            ? "high"
            : candidato.ubicacionCoincide === false
              ? "low"
              : "medium";
        if (candidato.imagen) {
          imagenAlternativa = { url: candidato.imagen, procedencia: `${candidato.imagenProcedencia ?? candidato.procedencia} · ${candidato.procedenciaUrl}` };
        }
        break;
      }

      if (!pagina) {
        // No se ha podido confirmar nada. Se distingue POR QUÉ, que es justo lo que se preguntó.
        const motivo: Motivo =
          motivoOriginal === "url_muerta" || motivoOriginal === "url_incorrecta" || motivoOriginal === "sin_informacion_publica"
            ? motivoOriginal
            : huboParecidos
              ? "entidad_ambigua"
              : entidadLocalizada
                ? "sin_informacion_publica"
                : "entidad_no_localizada";
        const estado: Estado = webOriginal ? "source_failed" : "not_found_after_search";
        if (huboParecidos) {
          await anotarRevision(tipo, id, "identidad sin confirmar", "Se encontraron páginas parecidas, pero no se pudo confirmar nombre y ubicación", lote);
        }
        await marcarEstado(tipo, id, estado, {
          campos: campos.length,
          error: `Fuente original: ${motivoOriginal}. Sin alternativa confirmada (${motivo})`,
          lote,
        });
        // El diagnóstico se anota DESPUÉS de crear la fila de estado: si no, el UPDATE no tendría dónde.
        await anotarDiagnostico(tipo, id, {
          motivo,
          claseFuente: huboParecidos && !entidadLocalizada ? "needs_review" : "not_found_after_secondary_search",
          estadoFuenteOriginal: webOriginal ? "source_failed" : "sin_url",
          confianzaIdentidad: huboParecidos ? "low" : null,
          motores: motores || "sin resultados",
        });
        await registrar(tipo, id, estado, campos, webOriginal || null, "Sin fuente utilizable", motivo, lote);
        return { id, estado, campos, fuente: null };
      }
    }

    /* 4 · CON LA FUENTE BUENA: la original si servía, o la que se ha verificado buscándola. Todo lo
       que se guarde lleva su procedencia, su prioridad y, si la original estaba rota, la dirección
       original al lado de la verificada. */
    const fuenteDe = (campo: string, confidence: Confianza) =>
      usada
        ? { source: "external_verified", name: `${usada.procedencia} · ${usada.tipo}`, url: usada.url, type: campo, confidence }
        : { source: "official_web", name: ficha.nombre, url: pagina.url, type: campo, confidence };
    const extra = {
      priority: usada?.prioridad ?? 1,
      originalSourceUrl: webOriginal || null,
      verificacion: usada
        ? `nombre + ubicación: ${identidadConfirmada === "high" ? "confirmados" : identidadConfirmada === "medium" ? "el nombre sí, la ubicación no visible" : "sin confirmar"}`
        : "fuente original del catálogo",
    };
    const fuenteWeb = (campo: string, valor: string, confidence: Confianza) =>
      guardarDato(tipo, id, campo, null, valor, fuenteDe(campo, confidence), lote, extra);

    /* 5 · DESCRIPCIÓN: solo si falta. Nunca se pisa la que ya hay. */
    if (!ficha.descripcion && pagina.descripcion) {
      await fuenteWeb("descripcion", pagina.descripcion.slice(0, 700), usada ? identidadConfirmada ?? "medium" : "medium");
      campos.push("descripcion");
    }

    /* 6 · TELÉFONO: solo si falta y la web lo publica. */
    if (!ficha.telefono && pagina.telefono) {
      await fuenteWeb("telefono", pagina.telefono, usada ? "medium" : "high");
      campos.push("telefono");
    }

    /* 6b · CORREO: la misma regla que el teléfono. Solo si falta y lo publica la propia web. */
    if (!ficha.email && pagina.email && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(pagina.email)) {
      await fuenteWeb("email", pagina.email.slice(0, 200), usada ? "medium" : "high");
      campos.push("email");
    }

    /* 7 · DIRECCIÓN: solo si falta y viene en los datos estructurados de la propia web. */
    if (!ficha.direccion && pagina.direccion) {
      await fuenteWeb("direccion", pagina.direccion.slice(0, 300), usada ? "medium" : "high");
      campos.push("direccion");
    }

    /* 8 · FOTOGRAFÍA: la oficial del sitio; si no la hay, la de la entidad encontrada (con su
       procedencia). Nunca una foto de otra empresa ni de otro lugar: va con la entidad verificada. */
    if (pagina.imagen && urlPermitida(pagina.imagen)) {
      await fuenteWeb("imagen_oficial", pagina.imagen.slice(0, 700), "medium");
      campos.push("imagen_oficial");
      revisar.push(["imagen oficial propuesta", "La imagen oficial está disponible para revisión"]);
    } else if (imagenAlternativa && urlPermitida(imagenAlternativa.url)) {
      await guardarDato(
        tipo,
        id,
        "imagen_oficial",
        null,
        imagenAlternativa.url.slice(0, 700),
        { source: "external_verified", name: imagenAlternativa.procedencia, url: usada?.url ?? pagina.url, type: "imagen_oficial", confidence: "medium" },
        lote,
        extra,
      );
      campos.push("imagen_oficial");
      revisar.push(["imagen oficial propuesta", `Imagen de la entidad verificada · ${imagenAlternativa.procedencia}`]);
    }

    /* 9 · PRECIO. Se busca donde puede verificarse: en la web del propio sitio y en sus páginas de
       tarifas, entradas o reservas. Siempre ORIENTATIVO, con la dirección exacta de donde salió. Si
       no hay ninguna tarifa legible, no se escribe nada: la ficha sigue diciendo «Consultar». */
    let precioWeb = pagina.precio ? Number(String(pagina.precio).replace(",", ".")) : NaN;
    let precioDetalle = precioWeb ? "datos estructurados de la web" : "";
    let visitadas = 0;
    let monedaPrecio = (pagina.moneda ?? "EUR").slice(0, 3).toUpperCase();
    let tipoPrecio = "datos_estructurados";
    if (!ficha.precioValor && (!Number.isFinite(precioWeb) || precioWeb <= 0)) {
      const objetivo = usada?.url ?? pagina.url;
      const busquedaPrecio = await buscarPrecios(objetivo, { maxPaginas: 3 });
      visitadas = busquedaPrecio.visitadas.length;
      const elegido = busquedaPrecio.precios.find((p) => p.confianza === "high") ?? busquedaPrecio.precios.find((p) => p.confianza === "medium") ?? null;
      if (elegido) {
        precioWeb = elegido.valor;
        precioDetalle = elegido.contexto.slice(0, 120);
        monedaPrecio = elegido.moneda;
        tipoPrecio = elegido.tipo;
      }
    }
    if (!ficha.precioValor && Number.isFinite(precioWeb) && precioWeb > 0) {
      await guardarDato(
        tipo,
        id,
        "precio_orientativo",
        null,
        `${precioWeb}`,
        { ...fuenteDe("precio_orientativo", "medium"), url: usada?.url ?? pagina.url },
        lote,
        {
          ...extra,
          moneda: monedaPrecio,
          tipoPrecio,
          verificacion: `${extra.verificacion} · ${precioDetalle}`.slice(0, 120),
        },
      );
      campos.push("precio_orientativo");
      // El precio se publica como ORIENTATIVO («Desde X €»), nunca como precio confirmado: la revisión
      // es para decidir si se convierte en precio propio, no para poder mostrarlo.
      revisar.push(["precio orientativo propuesto", `Publicado por el propio sitio: ${precioDetalle}. Se muestra como orientativo; se revisa si pasa a precio propio`]);
    } else if (!ficha.precioValor) {
      revisar.push([
        "precio no encontrado",
        visitadas > 1 ? `Se miraron ${visitadas} páginas del sitio y ninguna publica tarifa legible` : "El sitio no publica tarifas legibles",
      ]);
    }

    /* 8 · Lo que sigue faltando, a la cola de revisión. */
    if (!ficha.lat || !ficha.lng) revisar.push(["sin coordenadas", "No hay coordenadas para mostrar el mapa"]);
    if (!ficha.imagen && !pagina.imagen) revisar.push(["sin fotografía", "No hay imagen propia ni oficial disponible"]);
    for (const [problema, detalle] of revisar) await anotarRevision(tipo, id, problema, detalle, lote);

    /* 10 · ESTADO FINAL del elemento, con su diagnóstico. */
    const encontrados = campos.filter((c) => !["categoria", "subcategoria"].includes(c)).length;
    // Si la fuente se localizó y se verificó pero no publica nada que falte, la ficha NO está «sin
    // encontrar»: está verificada y sin nada que añadir. No es lo mismo, y se dice distinto.
    const fuenteConfirmada = Boolean(usada || motivoOriginal === "ok");
    const estado: Estado =
      encontrados === 0 ? (fuenteConfirmada ? "enriched" : "not_found_after_search") : revisar.length > 0 ? "partial" : "enriched";
    await marcarEstado(tipo, id, estado, { campos: campos.length, lote });
    await anotarDiagnostico(tipo, id, {
      motivo: motivoOriginal,
      claseFuente: identidadConfirmada === "low" ? "needs_review" : usada ? "source_original_failed_but_secondary_found" : "source_original_ok",
      estadoFuenteOriginal: webOriginal ? (motivoOriginal === "ok" ? "ok" : "source_failed") : "sin_url",
      fuenteVerificada: usada?.url ?? (motivoOriginal === "ok" ? pagina.url : null),
      confianzaIdentidad: identidadConfirmada,
      motores: motores || null,
    });
    await registrar(tipo, id, estado, campos, pagina.url, `Enriquecidos ${campos.length} campos`, null, lote);
    return { id, estado, campos, fuente: pagina.url };
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
