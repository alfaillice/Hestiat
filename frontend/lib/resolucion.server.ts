/**
 * RESOLUCIÓN DE IDENTIDAD MULTIFUENTE — SOLO SERVIDOR.
 *
 * Una sola pieza, reutilizable para experiencias, servicios y alojamientos: `resolveCatalogEntity()`.
 * No hay tres motores; hay uno al que se le dice de qué tipo es la ficha.
 *
 * IDEA CENTRAL
 * Ninguna fuente tiene por qué contener todos los datos. Una confirma que el sitio existe y cómo se
 * llama; otra da el teléfono; otra la web; otra una imagen; otra un precio. Cada dato se guarda con
 * SU procedencia, y la identidad se decide con varias señales a la vez, no porque un nombre se
 * parezca.
 *
 * NIVELES DE FUENTE (el orden que se pidió)
 *   1 web oficial del proveedor · 2 turismo oficial de la localidad · 3 turismo oficial de la
 *   provincia o región · 4 directorio empresarial o profesional · 5 mapa o directorio geolocalizado ·
 *   6 OpenStreetMap u otra fuente geo · 7 red social oficial del proveedor · 8 fuente municipal ·
 *   9 fuente sectorial · 10 buscador web general.
 *
 * CONFIANZA
 *   HIGH / MEDIUM / LOW / AMBIGUOUS / NOT_FOUND. Se calcula sumando señales: nombre, localidad,
 *   provincia, país, coordenadas, actividad, teléfono y dominio. LOW nunca se publica como dato
 *   verificado: se manda a revisión.
 *
 * Y lo más importante: «no he encontrado información» NO es «el negocio no existe». Se guarda el
 * motivo exacto (source_exists_no_public_data, not_located, dead_url, ambiguous_identity, redirect,
 * insufficient_evidence, no_price_found, no_image_found) para poder decidir después qué hacer con
 * cada grupo.
 */
import { buscarCandidatos, distanciaKm, normalizar, palabras, pareceElMismo, type Identidad } from "@/lib/fuentes.server";
import { buscarPrecios, type PrecioHallado } from "@/lib/precio-web.server";

export type TipoEntidad = "experience" | "service" | "accommodation";
export type Nivel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Confianza = "HIGH" | "MEDIUM" | "LOW" | "AMBIGUOUS" | "NOT_FOUND";
export type Motivo =
  | "ok"
  | "source_exists_no_public_data"
  | "not_located"
  | "dead_url"
  | "ambiguous_identity"
  | "redirect"
  | "insufficient_evidence"
  | "no_price_found"
  | "no_image_found"
  | "no_url";

export const NIVELES: Record<Nivel, string> = {
  1: "web oficial del proveedor",
  2: "turismo oficial de la localidad",
  3: "turismo oficial de la provincia o región",
  4: "directorio empresarial o profesional",
  5: "mapa o directorio geolocalizado",
  6: "OpenStreetMap u otra fuente geo",
  7: "red social oficial del proveedor",
  8: "fuente municipal",
  9: "fuente sectorial",
  10: "buscador web general",
};

/** Tipo de fuente que se guarda con cada imagen (nunca una de Wikipedia como «oficial»). */
export type TipoImagen = "oficial" | "proveedor" | "turismo_oficial" | "wikipedia" | "directorio" | "representativa" | "sin_imagen_verificada";

export interface EntradaResolucion {
  entity_type: TipoEntidad;
  entity_id: number;
  name: string;
  city: string | null;
  province: string | null;
  country: string | null;
  original_url: string | null;
  existing_coordinates: { lat: number | null; lng: number | null };
  category?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface FuenteEncontrada {
  url: string;
  nivel: Nivel;
  tipo: string;
  procedencia: string;
  nombre: string | null;
  confianza: Confianza;
  senales: string[];
  aporta: string[];
}

export interface CampoResuelto {
  campo: string;
  valor: string;
  fuenteUrl: string | null;
  fuenteNivel: Nivel;
  fuenteTipo: string;
  fuenteNombre: string | null;
  prioridad: number;
  verificacion: string;
  confianza: Confianza;
}

export interface ImagenResuelta {
  url: string;
  source_type: TipoImagen;
  fuente: string | null;
  confianza: Confianza;
}

export interface PrecioResuelto {
  value: number;
  currency: string;
  price_type: string;
  price_unit: string;
  source_url: string;
  source_type: string;
  verified_at: string;
  confianza: Confianza;
}

export interface EntidadResuelta {
  identity: { name: string; city: string | null; province: string | null; country: string | null; address: string | null; phone: string | null; lat: number | null; lng: number | null; activity: string | null };
  sources: FuenteEncontrada[];
  fields: CampoResuelto[];
  images: ImagenResuelta[];
  price: PrecioResuelto | null;
  confidence: Confianza;
  status: "enriched" | "partial" | "not_found" | "needs_review";
  reason: Motivo;
  verified_at: string;
  /** Motivos secundarios, para no perder información: falta precio, falta imagen... */
  secondary: Motivo[];
}

/* ------------------------------------------------------------ leer página -- */

export interface PaginaOficial {
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

export interface Apertura {
  motivo: Motivo;
  pagina: PaginaOficial | null;
  final: string;
  estado: number | null;
  texto: string;
}

function limpiarHtml(t: string): string {
  return t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Solo http(s) públicas: nunca direcciones internas. */
export function urlPublica(url: string): boolean {
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

export function parsearHtml(html: string, url: string): PaginaOficial {
  const meta = (nombre: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${nombre}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${nombre}["']`, "i"))?.[1] ??
    null;
  const tel = html.match(/href=["']tel:([+0-9][0-9\s().-]{6,20})["']/i)?.[1] ?? null;
  const correo = html.match(/href=["']mailto:([^"'?]+@[^"'?]+)["']/i)?.[1]?.trim() ?? null;
  let direccion: string | null = null;
  let precio: string | null = null;
  let moneda: string | null = null;
  let telefonoEstructurado: string | null = null;
  let correoEstructurado: string | null = null;
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const crudo = JSON.parse(m[1]);
      for (const d of Array.isArray(crudo) ? crudo : [crudo]) {
        const dir = d?.address;
        if (!direccion && dir) direccion = [dir.streetAddress, dir.postalCode, dir.addressLocality].filter(Boolean).join(", ") || null;
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

/**
 * Abre una dirección y DICE QUÉ HA PASADO: no es lo mismo una web muerta, que una que responde sin
 * publicar nada útil, que una que ya lleva a otro sitio.
 */
export async function abrirPagina(url: string, timeoutMs = 9000): Promise<Apertura> {
  if (!url || !urlPublica(url)) return { motivo: "no_url", pagina: null, final: url, estado: null, texto: "" };
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: control.signal,
      redirect: "follow",
      headers: { "user-agent": "HestiatBot/3.0 (+https://hestiat.com; hola@hestiat.com)" },
    });
    const final = r.url || url;
    if (!r.ok) return { motivo: "dead_url", pagina: null, final, estado: r.status, texto: "" };
    const tipo = r.headers.get("content-type") ?? "";
    if (!tipo.includes("text/html")) return { motivo: "dead_url", pagina: null, final, estado: r.status, texto: "" };
    const html = (await r.text()).slice(0, 400_000);
    const pagina = parsearHtml(html, final);
    const texto = limpiarHtml(html).slice(0, 60_000);
    let otroDominio = false;
    try {
      otroDominio =
        new URL(final).hostname.replace(/^www\./, "") !== new URL(url).hostname.replace(/^www\./, "");
    } catch {
      /* una dirección rara no rompe nada */
    }
    if (otroDominio) return { motivo: "redirect", pagina, final, estado: r.status, texto };
    const util = Boolean(pagina.titulo || pagina.descripcion || pagina.imagen || pagina.precio || pagina.telefono || pagina.email);
    if (!util) return { motivo: "source_exists_no_public_data", pagina, final, estado: r.status, texto };
    return { motivo: "ok", pagina, final, estado: r.status, texto };
  } catch {
    return { motivo: "dead_url", pagina: null, final: url, estado: null, texto: "" };
  } finally {
    clearTimeout(t);
  }
}

/* ------------------------------------------------------ nivel de la fuente -- */

const REDES = /(facebook|instagram|twitter|x\.com|tiktok|youtube|linkedin|pinterest)\./;
const MAPAS = /(google\.[a-z.]{2,6}|bing\.com|maps\.apple|foursquare|waze|mapcarta|mapquest)/;
const GEO = /(openstreetmap|nominatim|wikimapia|geohack|mapillary|geonames)/;
const DIRECTORIOS = /(paginasamarillas|axesor|einforma|empresite|infoempresa|yelp|tripadvisor|minube|guiarepsol|cylex|11870|hotfrog|expansión|expansion\.com|europages)/;
const TURISMO = /(spain\.info|turismo\.gob\.es|visit[a-z-]*\.|turismo[a-z-]*\.|andalucia\.org|euskadi\.eus|asturias\.me|comunitatvalenciana|turismocastillayleon|turismoasturias)/;
const MUNICIPAL = /((^|\.)(ayto[a-z0-9-]*|ajuntament[a-z]*|concellode[a-z]+)\.|ayuntamiento)/;
const PUBLICO = /(\.gob\.es$|\.gov$|\.eus$|\.edu$)/;
const SECTORIAL = /(asociacion|asociación|federacion|federación|colegio|camara|cámara|gremio|confederacion|confederación|sindicato)/;

/** A qué nivel corresponde una dirección, mirando el dominio y, cuando ayuda, el nombre de la entidad. */
export function nivelPorUrl(url: string, nombre: string, ciudad: string | null, marcadaOficial = false): Nivel {
  let h = "";
  try {
    h = new URL(url).hostname.toLowerCase();
  } catch {
    return 10;
  }
  if (REDES.test(h)) return 7;
  if (MAPAS.test(h)) return 5;
  if (GEO.test(h)) return 6;
  if (DIRECTORIOS.test(h)) return 4;
  if (SECTORIAL.test(h)) return 9;
  if (TURISMO.test(h)) {
    const muni = normalizar(ciudad ?? "").replace(/\s/g, "");
    if (muni.length >= 5 && h.replace(/[^a-z0-9]/g, "").includes(muni.slice(0, 6))) return 2;
    return 3;
  }
  if (MUNICIPAL.test(h)) return 8;
  if (PUBLICO.test(h)) return 8;
  const limpio = h.replace(/[^a-z0-9]/g, "");
  const propio = palabras(nombre).some((p) => p.length >= 5 && limpio.includes(p.slice(0, Math.max(5, p.length - 2))));
  if (marcadaOficial || propio) return 1;
  return 10;
}

/* ------------------------------------------------------ buscador general -- */

const ultimaWeb = { t: 0 };

/**
 * Buscador web general (nivel 10). Se usa la página pública de DuckDuckGo, sin claves. Si el servicio
 * responde con un control de acceso, se deja de usar y se sigue con las demás fuentes: no se fuerza
 * el acceso de ninguna manera.
 */
export async function buscarEnWebGeneral(consulta: string): Promise<{ url: string; titulo: string }[]> {
  const espera = ultimaWeb.t + 1600 - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaWeb.t = Date.now();
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), 12_000);
  try {
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(consulta)}`, {
      signal: control.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; HestiatBot/3.0; +https://hestiat.com)",
        accept: "text/html",
        "accept-language": "es-ES,es;q=0.9",
      },
    });
    if (!r.ok) return [];
    const html = (await r.text()).slice(0, 600_000);
    // Si aparece un control de acceso, se para: no se intenta rodear.
    if (/captcha|unusual traffic|anomaly/i.test(html)) {
      console.warn("[hestiat] buscador general: control de acceso, se deja de usar en esta tanda");
      return [];
    }
    const salida: { url: string; titulo: string }[] = [];
    for (const m of html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
      let destino = m[1];
      const uddg = destino.match(/[?&]uddg=([^&]+)/);
      if (uddg) destino = decodeURIComponent(uddg[1]);
      if (!urlPublica(destino)) continue;
      const titulo = limpiarHtml(m[2]);
      if (!salida.some((s) => s.url === destino)) salida.push({ url: destino, titulo });
      if (salida.length >= 6) break;
    }
    return salida;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

/* ------------------------------------------------------------- puntuación -- */

export interface SenalesCandidato {
  nombre: string | null;
  ciudad: string | null;
  provincia: string | null;
  pais: string | null;
  lat: number | null;
  lng: number | null;
  actividad: string | null;
  telefono: string | null;
}

/**
 * La confianza NO se decide porque el nombre se parezca. Se suman señales independientes: nombre,
 * localidad, provincia, país, coordenadas, actividad, teléfono y dominio.
 */
export function puntuarIdentidad(
  entrada: EntradaResolucion,
  candidato: SenalesCandidato,
  urlCandidato: string | null,
): { confianza: Confianza; puntos: number; senales: string[] } {
  let puntos = 0;
  const senales: string[] = [];
  const nombreOk = candidato.nombre ? pareceElMismo(entrada.name, candidato.nombre) : false;
  if (nombreOk) {
    puntos += 40;
    senales.push("nombre");
  } else {
    const pa = new Set(palabras(entrada.name));
    const pb = new Set(palabras(candidato.nombre ?? ""));
    let comunes = 0;
    for (const p of pa) if (pb.has(p)) comunes += 1;
    const solape = pa.size > 0 && pb.size > 0 ? comunes / Math.min(pa.size, pb.size) : 0;
    if (solape >= 0.4) {
      puntos += 15;
      senales.push("nombre parcial");
    }
  }
  if (candidato.ciudad && entrada.city && pareceElMismo(entrada.city, candidato.ciudad)) {
    puntos += 20;
    senales.push("localidad");
  }
  if (candidato.provincia && entrada.province && pareceElMismo(entrada.province, candidato.provincia)) {
    puntos += 10;
    senales.push("provincia");
  }
  if (candidato.pais && entrada.country && pareceElMismo(entrada.country, candidato.pais)) {
    puntos += 5;
    senales.push("país");
  }
  const lat = entrada.existing_coordinates.lat;
  const lng = entrada.existing_coordinates.lng;
  if (lat !== null && lng !== null && candidato.lat !== null && candidato.lng !== null) {
    const km = distanciaKm(lat, lng, candidato.lat, candidato.lng);
    if (km <= 2) {
      puntos += 20;
      senales.push("coordenadas ≤2 km");
    } else if (km <= 30) {
      puntos += 10;
      senales.push("coordenadas ≤30 km");
    } else if (km > 100) {
      puntos -= 25;
      senales.push("coordenadas lejanas");
    }
  }
  if (candidato.actividad && entrada.category) {
    const a = new Set(palabras(entrada.category));
    const b = new Set(palabras(candidato.actividad));
    for (const p of a) {
      if (b.has(p) || candidato.actividad.toLowerCase().includes(p.slice(0, 5))) {
        puntos += 10;
        senales.push("actividad");
        break;
      }
    }
  }
  const soloDigitos = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "").slice(-9);
  if (candidato.telefono && entrada.phone && soloDigitos(candidato.telefono).length === 9 && soloDigitos(candidato.telefono) === soloDigitos(entrada.phone)) {
    puntos += 10;
    senales.push("teléfono");
  }
  if (urlCandidato) {
    let host = "";
    try {
      host = new URL(urlCandidato).hostname.replace(/[^a-z0-9]/g, "");
    } catch {
      host = "";
    }
    if (host && palabras(entrada.name).some((p) => p.length >= 5 && host.includes(p.slice(0, Math.max(5, p.length - 2))))) {
      puntos += 5;
      senales.push("dominio");
    }
  }
  const confianza: Confianza = puntos >= 70 ? "HIGH" : puntos >= 45 ? "MEDIUM" : puntos >= 25 ? "LOW" : "AMBIGUOUS";
  return { confianza, puntos, senales };
}

/* ------------------------------------------------- descubrir todas fuentes -- */

const VARIANTES = (e: EntradaResolucion) => [
  `${e.name} ${e.city ?? e.province ?? ""}`.trim(),
  `${e.name} ${e.province ?? ""}`.trim(),
  `${e.name} ${e.city ?? ""} oficial`.trim(),
  `${e.name} ${e.city ?? ""} turismo`.trim(),
  `"${e.name}" precio entrada ${e.city ?? ""}`.trim(),
];

async function descubrirFuentes(e: EntradaResolucion): Promise<FuenteEncontrada[]> {
  const ident: Identidad = {
    nombre: e.name,
    municipio: e.city,
    provincia: e.province,
    pais: e.country ?? "España",
    lat: e.existing_coordinates.lat,
    lng: e.existing_coordinates.lng,
  };
  const salida: FuenteEncontrada[] = [];
  const yaVisto = new Set<string>();

  const anotar = (url: string, procedencia: string, nombre: string | null, senalesCand: SenalesCandidato, marcadaOficial = false, aporta: string[] = []) => {
    if (!urlPublica(url)) return;
    let host = "";
    try {
      host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return;
    }
    if (yaVisto.has(host)) return;
    const { confianza, senales } = puntuarIdentidad(e, senalesCand, url);
    if (confianza === "AMBIGUOUS" && !senales.includes("nombre")) return;
    yaVisto.add(host);
    const nivel = nivelPorUrl(url, e.name, e.city, marcadaOficial);
    salida.push({
      url,
      nivel,
      tipo: NIVELES[nivel],
      procedencia,
      nombre,
      confianza,
      senales,
      aporta,
    });
  };

  // Wikidata · Wikipedia · Nominatim (una sola vez, con su verificación propia)
  const base = await buscarCandidatos(ident).catch(() => ({ candidatos: [], articulo: null, consultas: [], motores: [], localizada: false }));
  for (const c of base.candidatos) {
    // Las señales que ya comprobó el buscador (coordenadas y localidad) se pasan al cálculo: sin
    // ellas, la confianza se quedaba corta y HIGH era inalcanzable.
    anotar(
      c.url,
      c.procedencia,
      c.titulo,
      {
        nombre: c.titulo,
        ciudad: c.ubicacionCoincide === true ? e.city : null,
        provincia: null,
        pais: null,
        lat: c.ubicacionCoincide === true ? e.existing_coordinates.lat : null,
        lng: c.ubicacionCoincide === true ? e.existing_coordinates.lng : null,
        actividad: null,
        telefono: null,
      },
      c.prioridad === 1,
      ["existencia", "nombre"],
    );
  }
  if (base.articulo) {
    anotar(
      base.articulo.url,
      "Wikipedia (es)",
      base.articulo.titulo,
      { nombre: base.articulo.titulo, ciudad: null, provincia: null, pais: null, lat: null, lng: null, actividad: null, telefono: null },
      false,
      ["existencia", "imagen de referencia"],
    );
  }

  // Buscador web general, con las variantes pedidas. Se corta en cuanto hay dos fuentes de nivel ≤4.
  const buenas = () => salida.filter((s) => s.nivel <= 4).length;
  let vaciasSeguidas = 0;
  for (const consulta of VARIANTES(e).slice(0, 4)) {
    if (buenas() >= 2) break;
    // Si dos consultas seguidas no aportan ninguna fuente nueva, se deja de insistir: seguir
    // preguntando lo mismo no encuentra más, solo hace la tanda eterna.
    if (vaciasSeguidas >= 2) break;
    const antes = salida.length;
    const resultados = await buscarEnWebGeneral(consulta).catch(() => []);
    for (const r of resultados) {
      const nivel = nivelPorUrl(r.url, e.name, e.city);
      // Del buscador general solo se aceptan los niveles hasta 4 y las redes del propio proveedor.
      if (nivel > 7) continue;
      anotar(
        r.url,
        `Buscador web general · «${consulta}»`,
        r.titulo,
        { nombre: r.titulo, ciudad: null, provincia: null, pais: null, lat: null, lng: null, actividad: null, telefono: null },
        false,
        ["existencia", "nombre"],
      );
    }
    vaciasSeguidas = salida.length > antes ? 0 : vaciasSeguidas + 1;
  }

  return salida.sort((a, b) => a.nivel - b.nivel);
}

/* ------------------------------------------------------------ el resolver -- */

const MEJOR_A_PEOR: Record<Confianza, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, AMBIGUOUS: 3, NOT_FOUND: 4 };

/** Una coincidencia LOW o AMBIGUOUS NO se publica como dato verificado: va a revisión. */
function confianzaBaja(c: Confianza): boolean {
  return c === "LOW" || c === "AMBIGUOUS";
}

function tipoDeImagen(nivel: Nivel, url: string): TipoImagen {
  let h = "";
  try {
    h = new URL(url).hostname.toLowerCase();
  } catch {
    return "representativa";
  }
  if (/wikipedia|wikimedia|commons/.test(h)) return "wikipedia";
  if (nivel === 1) return "oficial";
  if (nivel === 2 || nivel === 3) return "turismo_oficial";
  if (nivel === 4 || nivel === 5) return "directorio";
  if (nivel === 7) return "proveedor";
  return "representativa";
}

function tipoDePrecio(contexto: string): { type: string; unit: string } {
  const t = normalizar(contexto);
  if (/por persona|persona|adulto|nino/.test(t)) return { type: "por persona", unit: "persona" };
  if (/por hora|hora|\/h\b/.test(t)) return { type: "por hora", unit: "hora" };
  if (/noche|por dia/.test(t)) return { type: "por noche", unit: "noche" };
  if (/sesion|clase/.test(t)) return { type: "por sesión", unit: "sesión" };
  if (/entrada|ticket|acceso/.test(t)) return { type: "entrada", unit: "entrada" };
  if (/desde/.test(t)) return { type: "desde", unit: "unidad" };
  return { type: "tarifa única", unit: "unidad" };
}

/**
 * LA FUNCIÓN QUE SE PIDIÓ. Recibe una ficha del catálogo y devuelve una estructura normalizada con
 * identidad, fuentes (cada una con su nivel y qué aporta), campos con su procedencia, imágenes con su
 * tipo, precio, confianza, estado, motivo y fecha de verificación.
 *
 * Sirve igual para experiencias, servicios y alojamientos: lo único que cambia es lo que se le pasa.
 */
export async function resolveCatalogEntity(entrada: EntradaResolucion): Promise<EntidadResuelta> {
  const ahora = new Date().toISOString();
  const fields: CampoResuelto[] = [];
  const images: ImagenResuelta[] = [];
  const secondary: Motivo[] = [];

  // 1 · La dirección original, y qué pasa con ella.
  const apertura = entrada.original_url ? await abrirPagina(entrada.original_url) : { motivo: "no_url" as Motivo, pagina: null, final: "", estado: null, texto: "" };
  const motivoOriginal = apertura.motivo;
  let pagina = motivoOriginal === "ok" ? apertura.pagina : null;
  let fuenteUsada: FuenteEncontrada | null = null;
  let confianza: Confianza = pagina ? "MEDIUM" : "NOT_FOUND";
  let senalesGlobales: string[] = pagina ? ["fuente original del catálogo"] : [];
  let fuentes: FuenteEncontrada[] = [];

  // 2 · Si la original no sirve, se buscan fuentes por niveles y se comprueba la identidad.
  if (!pagina) {
    fuentes = await descubrirFuentes(entrada);
    for (const f of fuentes.sort((a, b) => MEJOR_A_PEOR[b.confianza] - MEJOR_A_PEOR[a.confianza] === 0 ? a.nivel - b.nivel : MEJOR_A_PEOR[a.confianza] - MEJOR_A_PEOR[b.confianza])) {
      if (f.confianza === "AMBIGUOUS" || f.confianza === "NOT_FOUND") continue;
      const prueba = await abrirPagina(f.url);
      if (!prueba.pagina) continue;
      const texto = normalizar(prueba.texto);
      const nombreOk = palabras(entrada.name).filter((p) => texto.includes(p)).length >= Math.max(1, Math.ceil(palabras(entrada.name).length * 0.6));
      if (!nombreOk) {
        f.confianza = "LOW";
        continue;
      }
      pagina = prueba.pagina;
      fuenteUsada = f;
      confianza = f.confianza;
      senalesGlobales = f.senales.length > 0 ? f.senales : ["nombre en la página"];
      break;
    }
  }

  // 3 · Sin ninguna fuente utilizable: se dice POR QUÉ, con el motivo específico.
  if (!pagina) {
    const hayParecidos = fuentes.some((f) => f.senales.includes("nombre") || f.senales.includes("nombre parcial"));
    const motivo: Motivo =
      motivoOriginal === "dead_url" || motivoOriginal === "redirect" || motivoOriginal === "source_exists_no_public_data"
        ? motivoOriginal
        : hayParecidos
          ? "ambiguous_identity"
          : fuentes.length > 0
            ? "insufficient_evidence"
            : "not_located";
    return {
      identity: { name: entrada.name, city: entrada.city, province: entrada.province, country: entrada.country, address: entrada.address ?? null, phone: entrada.phone ?? null, lat: entrada.existing_coordinates.lat, lng: entrada.existing_coordinates.lng, activity: entrada.category ?? null },
      sources: fuentes,
      fields,
      images,
      price: null,
      confidence: hayParecidos ? "AMBIGUOUS" : "NOT_FOUND",
      status: hayParecidos ? "needs_review" : "not_found",
      reason: motivo,
      verified_at: ahora,
      secondary,
    };
  }

  // 4 · Datos de la fuente buena, cada uno con SU procedencia.
  const nivelFuente: Nivel = fuenteUsada?.nivel ?? 1;
  const urlFuente = fuenteUsada?.url ?? pagina.url;
  const procedencia = fuenteUsada?.procedencia ?? "web del catálogo";
  const confianzaDato: Confianza = fuenteUsada ? confianza : "MEDIUM";
  const anadir = (campo: string, valor: string | null | undefined, tipo: string) => {
    if (!valor || !valor.trim()) return;
    fields.push({
      campo,
      valor: valor.slice(0, 700),
      fuenteUrl: urlFuente,
      fuenteNivel: nivelFuente,
      fuenteTipo: tipo,
      fuenteNombre: fuenteUsada?.nombre ?? entrada.name,
      prioridad: nivelFuente,
      verificacion: `${senalesGlobales.join(" + ")}${nivelFuente === 1 ? " · web del propio proveedor" : ` · ${NIVELES[nivelFuente]}`}`,
      confianza: confianzaDato,
    });
  };
  anadir("descripcion", pagina.descripcion, "descripcion");
  anadir("telefono", pagina.telefono, "telefono");
  anadir("email", pagina.email && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(pagina.email) ? pagina.email : null, "email");
  anadir("direccion", pagina.direccion, "direccion");

  // 5 · Imágenes: SIEMPRE con su tipo. Una imagen de Wikipedia nunca es «oficial del sitio».
  if (pagina.imagen && urlPublica(pagina.imagen)) {
    images.push({
      url: pagina.imagen.slice(0, 700),
      source_type: tipoDeImagen(nivelFuente, pagina.imagen),
      fuente: fuenteUsada ? `${procedencia} · ${NIVELES[nivelFuente]}` : "web del catálogo",
      confianza: confianzaDato,
    });
  }
  const articuloWikipedia = fuentes.find((f) => /wikipedia/i.test(f.procedencia));
  if (images.length === 0 && articuloWikipedia) {
    secondary.push("no_image_found");
    images.push({
      url: articuloWikipedia.url,
      source_type: "wikipedia",
      fuente: "Wikipedia (es) · artículo de la entidad",
      confianza: "LOW",
    });
  }
  if (images.length === 0) secondary.push("no_image_found");

  // 6 · Precio: solo donde puede verificarse, y con su unidad y su tipo. Nunca inventado.
  let price: PrecioResuelto | null = null;
  if (pagina.precio) {
    const num = Number(String(pagina.precio).replace(",", "."));
    if (Number.isFinite(num) && num > 0) {
      price = {
        value: num,
        currency: (pagina.moneda ?? "EUR").slice(0, 3).toUpperCase(),
        price_type: "tarifa única",
        price_unit: "unidad",
        source_url: urlFuente,
        source_type: NIVELES[nivelFuente],
        verified_at: ahora,
        confianza: confianzaDato,
      };
    }
  }
  if (!price) {
    const hallados = await buscarPrecios(urlFuente, { maxPaginas: 3 }).catch(() => ({ precios: [] as PrecioHallado[], visitadas: [] }));
    const bueno = hallados.precios.find((p) => p.confianza === "high") ?? hallados.precios.find((p) => p.confianza === "medium") ?? null;
    if (bueno) {
      const pt = tipoDePrecio(bueno.contexto);
      price = {
        value: bueno.valor,
        currency: bueno.moneda,
        price_type: pt.type,
        price_unit: pt.unit,
        source_url: bueno.url,
        source_type: NIVELES[nivelFuente],
        verified_at: ahora,
        confianza: "MEDIUM",
      };
    }
  }
  if (!price) secondary.push("no_price_found");

  const tieneDatos = fields.length > 0 || images.length > 0 || price !== null;
  const status: EntidadResuelta["status"] = !tieneDatos
    ? confianza === "HIGH" || confianza === "MEDIUM"
      ? "enriched"
      : "needs_review"
    : confianzaBaja(confianza)
      ? "needs_review"
      : secondary.length >= 2
        ? "partial"
        : "enriched";

  return {
    identity: {
      name: entrada.name,
      city: entrada.city,
      province: entrada.province,
      country: entrada.country,
      address: fields.find((f) => f.campo === "direccion")?.valor ?? entrada.address ?? null,
      phone: fields.find((f) => f.campo === "telefono")?.valor ?? entrada.phone ?? null,
      lat: entrada.existing_coordinates.lat,
      lng: entrada.existing_coordinates.lng,
      activity: entrada.category ?? null,
    },
    sources: fuentes.length > 0 ? fuentes : [{ url: urlFuente, nivel: nivelFuente, tipo: NIVELES[nivelFuente], procedencia, nombre: entrada.name, confianza, senales: senalesGlobales, aporta: fields.map((f) => f.campo) }],
    fields,
    images,
    price,
    confidence: confianza,
    status,
    reason: motivoOriginal === "ok" ? "ok" : motivoOriginal,
    verified_at: ahora,
    secondary,
  };
}

/** Alias en español, para el resto del motor. La función de fuera se llama como se pidió. */
export const resolverEntidadCatalogo = resolveCatalogEntity;
