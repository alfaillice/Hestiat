/**
 * SEGUNDA ESTRATEGIA DE BÚSQUEDA — SOLO SERVIDOR.
 *
 * Cuando la dirección que traía el catálogo está muerta, no responde o no dice nada útil, esto es lo
 * que se hace: buscar la entidad en fuentes abiertas y ESTRUCTURADAS, y comprobar que lo encontrado
 * es de verdad la misma entidad antes de aceptar nada.
 *
 * Fuentes, por orden de prioridad (el orden es el que se pidió):
 *   1 · web oficial del establecimiento o proveedor
 *   2 · organismo oficial de turismo
 *   3 · ayuntamiento
 *   4 · organismo público
 *   5 · fuente turística reputada
 *   6 · otras fuentes fiables
 *
 * De dónde salen los candidatos (todas son APIs públicas, sin clave, y se consultan despacio):
 *   · Wikidata  → el dato estructurado: web oficial (P856) y coordenadas (P625).
 *   · Wikipedia (es) → el artículo y sus enlaces externos institucionales; da coordenadas e imagen.
 *   · Nominatim (OpenStreetMap) → el lugar por nombre y localidad, con su web y sus coordenadas.
 *
 * Y SIEMPRE se verifica la identidad: nombre + ubicación. Una página no se acepta por contener una
 * palabra parecida. Si hay duda, se marca para revisión en vez de dar por bueno algo dudoso.
 *
 * NO se usa Overpass: está bloqueado para la IP de este servidor y no se fuerza el acceso.
 */

const UA = "Hestiat/2.0 (enriquecimiento de catalogo; https://hestiat.com; hola@hestiat.com)";

export type Prioridad = 1 | 2 | 3 | 4 | 5 | 6;

export const NOMBRE_PRIORIDAD: Record<Prioridad, string> = {
  1: "web_oficial",
  2: "organismo_turismo",
  3: "ayuntamiento",
  4: "organismo_publico",
  5: "turismo_reputado",
  6: "otra_fiable",
};

export interface Identidad {
  nombre: string;
  municipio: string | null;
  provincia: string | null;
  pais: string | null;
  lat: number | null;
  lng: number | null;
}

export interface Candidato {
  url: string;
  prioridad: Prioridad;
  tipo: string;
  titulo: string;
  procedencia: string;
  procedenciaUrl: string;
  nombreCoincide: boolean;
  ubicacionCoincide: boolean | null;
  distanciaKm: number | null;
  confianza: "high" | "medium" | "low";
  /** Imagen asociada a la entidad encontrada (Wikipedia), si la hay. */
  imagen: string | null;
  imagenProcedencia: string | null;
}

/* ------------------------------------------------------------- utilidades -- */

export function normalizar(t: string | null | undefined): string {
  return (t ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palabras que describen el TIPO de sitio, no la identidad: no sirven para distinguir entidades. */
const GENERICAS = new Set([
  "hotel", "hostal", "museo", "centro", "parque", "casa", "restaurante", "bar", "cafeteria", "tienda",
  "the", "and", "los", "las", "del", "de", "la", "el", "y", "en", "con", "para", "por", "san", "santa",
]);

export function palabras(t: string | null | undefined): string[] {
  return normalizar(t)
    .split(" ")
    .filter((p) => p.length > 2 && !GENERICAS.has(p));
}

/** ¿Los dos nombres hablan de lo mismo? Igualdad, contención o mayoría de palabras en común. */
export function pareceElMismo(a: string, b: string): boolean {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 6 && nb.length >= 6 && (na.includes(nb) || nb.includes(na))) return true;
  const pa = new Set(palabras(a));
  const pb = new Set(palabras(b));
  if (pa.size === 0 || pb.size === 0) return false;
  let comunes = 0;
  for (const p of pa) if (pb.has(p)) comunes += 1;
  return comunes / Math.min(pa.size, pb.size) >= 0.6;
}

/** Distancia real entre dos puntos, en kilómetros. */
export function distanciaKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** ¿El texto de una página habla de esta entidad? Nombre y lugar, por separado. */
export function paginaHablaDe(html: string, ident: Identidad): { nombre: boolean; lugar: boolean } {
  const texto = normalizar(html.slice(0, 250_000));
  const np = palabras(ident.nombre);
  const encontradas = np.filter((p) => texto.includes(p)).length;
  const lugar = normalizar(ident.municipio ?? ident.provincia ?? "");
  return {
    nombre: np.length > 0 && encontradas / np.length >= 0.6,
    lugar: lugar.length > 2 && texto.includes(lugar),
  };
}

/** Prioridad según el dominio, para lo que no viene ya etiquetado como oficial. */
function prioridadPorDominio(url: string, etiqueta?: string | null): Prioridad {
  let h = "";
  try {
    h = new URL(url).hostname.toLowerCase();
  } catch {
    return 6;
  }
  if (/(^|\.)(spain\.info|turismo\.gob\.es|turismo\.[a-z]{2,}|visit[a-z-]*\.(com|es|org|eu)|andalucia\.org|euskadi\.eus|asturias\.me|turismocastillayleon\.com|comunitatvalenciana\.com)/.test(h)) return 2;
  if (/(^|\.)(ayto[a-z0-9-]*|ajuntament[a-z]*|concellode[a-z]+)\./.test(h) || h.includes("ayuntamiento")) return 3;
  if (h.endsWith(".gob.es") || h.endsWith(".gob") || h.endsWith(".gov") || h.endsWith(".eus") || h.endsWith(".edu")) return 4;
  if (/(tripadvisor|lonelyplanet|minube|guiarepsol|elviajero|timeout|nationalgeographic)/.test(h)) return 5;
  // Web del propio sitio: el dominio lleva las palabras de su nombre.
  const np = palabras(etiqueta ?? "");
  const hostLimpio = h.replace(/[^a-z0-9]/g, "");
  if (np.length > 0 && np.some((p) => hostlimpioContiene(hostLimpio, p))) return 1;
  return 6;
}

function hostlimpioContiene(host: string, palabra: string): boolean {
  if (palabra.length < 5) return false;
  return host.includes(palabra.slice(0, Math.max(5, palabra.length - 2)));
}

/* ---------------------------------------------------------------- pedir -- */

/** Cada servicio se consulta como mucho una vez por segundo: es lo que piden sus normas de uso. */
const ultimaLlamada = new Map<string, number>();

async function esperarTurno(host: string, minimoMs = 1100): Promise<void> {
  const ahora = Date.now();
  const previa = ultimaLlamada.get(host) ?? 0;
  const espera = previa + minimoMs - ahora;
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaLlamada.set(host, Date.now());
}

async function pedirJson(url: string, timeoutMs = 9000): Promise<Record<string, unknown> | null> {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  await esperarTurno(host);
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: control.signal,
      headers: { "user-agent": UA, accept: "application/json" },
    });
    if (!r.ok) return null;
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/* ------------------------------------------------------------- candidatos -- */

function conVerificacion(
  base: Omit<Candidato, "nombreCoincide" | "ubicacionCoincide" | "distanciaKm" | "confianza">,
  ident: Identidad,
  candidatoLat: number | null,
  candidatoLng: number | null,
  candidatoLugar: string | null,
): Candidato {
  const nombreCoincide = pareceElMismo(ident.nombre, base.titulo);
  let distancia: number | null = null;
  let ubicacionCoincide: boolean | null = null;
  if (ident.lat !== null && ident.lng !== null && candidatoLat !== null && candidatoLng !== null) {
    distancia = Math.round(distanciaKm(ident.lat, ident.lng, candidatoLat, candidatoLng) * 10) / 10;
    // 30 km da margen a un municipio grande; más de eso, es otro sitio.
    ubicacionCoincide = distancia <= 30;
  } else if (candidatoLugar) {
    const nuestro = ident.municipio ?? ident.provincia;
    ubicacionCoincide = nuestro ? pareceElMismo(nuestro, candidatoLugar) : null;
  }
  const confianza: Candidato["confianza"] =
    nombreCoincide && ubicacionCoincide === true ? "high" : nombreCoincide && ubicacionCoincide === null ? "medium" : "low";
  return { ...base, nombreCoincide, ubicacionCoincide, distanciaKm: distancia, confianza };
}

async function deWikidata(ident: Identidad, consultas: string[]): Promise<Candidato[]> {
  const salida: Candidato[] = [];
  const busqueda = await pedirJson(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(consultas[0])}&language=es&uselang=es&type=item&limit=5&format=json`,
  );
  const ids = ((busqueda?.search ?? []) as { id?: string }[]).map((x) => String(x.id ?? "")).filter(Boolean).slice(0, 3);
  if (ids.length === 0) return salida;
  const entidades = await pedirJson(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join("|")}&props=claims|descriptions&languages=es&format=json`,
  );
  const datos = (entidades?.entities ?? {}) as Record<string, Record<string, unknown>>;
  for (const id of ids) {
    const e = datos[id];
    if (!e) continue;
    const etiqueta = String((e.descriptions as Record<string, { value?: string }> | undefined)?.es?.value ?? id);
    const claims = (e.claims ?? {}) as Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
    const web = claims.P856?.[0]?.mainsnak?.datavalue?.value;
    const coords = claims.P625?.[0]?.mainsnak?.datavalue?.value as { latitude?: number; longitude?: number } | undefined;
    const cLat = typeof coords?.latitude === "number" ? coords.latitude : null;
    const cLng = typeof coords?.longitude === "number" ? coords.longitude : null;
    if (typeof web !== "string" || !/^https?:/i.test(web)) continue;
    const cand = conVerificacion(
      {
        url: web,
        prioridad: 1,
        tipo: NOMBRE_PRIORIDAD[1],
        titulo: etiqueta,
        procedencia: "Wikidata",
        procedenciaUrl: `https://www.wikidata.org/wiki/${id}`,
        imagen: null,
        imagenProcedencia: null,
      },
      ident,
      cLat,
      cLng,
      null,
    );
    salida.push(cand);
  }
  return salida;
}

async function deWikipedia(ident: Identidad, consultas: string[]): Promise<{ candidatos: Candidato[]; articulo: Candidato | null }> {
  const salida: Candidato[] = [];
  const busqueda = await pedirJson(
    `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`"${ident.nombre}" ${ident.municipio ?? ident.provincia ?? ""}`.trim())}&srlimit=3&format=json`,
  );
  const titulos = ((busqueda?.query as { search?: { title?: string }[] } | undefined)?.search ?? [])
    .map((x) => String(x.title ?? ""))
    .filter(Boolean);
  if (titulos.length === 0) return { candidatos: salida, articulo: null };
  const mejor = titulos.find((t) => pareceElMismo(ident.nombre, t)) ?? null;
  if (!mejor) return { candidatos: salida, articulo: null };
  const detalle = await pedirJson(
    `https://es.wikipedia.org/w/api.php?action=query&prop=coordinates|pageimages|extracts|extlinks|info&inprop=url&exintro=1&explaintext=1&ellimit=30&titles=${encodeURIComponent(mejor)}&format=json`,
  );
  const paginas = (detalle?.query as { pages?: Record<string, Record<string, unknown>> } | undefined)?.pages ?? {};
  const pagina = Object.values(paginas)[0];
  if (!pagina) return { candidatos: salida, articulo: null };
  const coords = (pagina.coordinates as { lat?: number; lon?: number }[] | undefined)?.[0];
  const cLat = typeof coords?.lat === "number" ? coords.lat : null;
  const cLng = typeof coords?.lon === "number" ? coords.lon : null;
  const imagen = (pagina.thumbnail as { source?: string } | undefined)?.source ?? null;
  const urlArticulo = String(pagina.fullurl ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(mejor)}`);
  const articulo = conVerificacion(
    {
      url: urlArticulo,
      prioridad: 5,
      tipo: NOMBRE_PRIORIDAD[5],
      titulo: mejor,
      procedencia: "Wikipedia (es)",
      procedenciaUrl: urlArticulo,
      imagen,
      imagenProcedencia: "Wikipedia",
    },
    ident,
    cLat,
    cLng,
    null,
  );
  // Enlaces externos institucionales del artículo (turismo oficial, ayuntamiento, organismo público).
  for (const enlace of (pagina.extlinks as { "*"?: string }[] | undefined) ?? []) {
    const u = String(enlace?.["*"] ?? "");
    if (!/^https?:/i.test(u)) continue;
    let host = "";
    try {
      host = new URL(u).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (/wikipedia|wikimedia|wikidata|archive\.org|doi\.org|jstor|google\.|books\.google/.test(host)) continue;
    const pr = prioridadPorDominio(u, ident.nombre);
    if (pr > 4) continue; // solo institucional: lo demás no se acepta por venir de un artículo
    salida.push(
      conVerificacion(
        {
          url: u,
          prioridad: pr,
          tipo: NOMBRE_PRIORIDAD[pr],
          titulo: mejor,
          procedencia: "Wikipedia (es) · enlace externo",
          procedenciaUrl: urlArticulo,
          imagen: null,
          imagenProcedencia: null,
        },
        ident,
        cLat,
        cLng,
        null,
      ),
    );
  }
  return { candidatos: salida, articulo };
}

async function deNominatim(ident: Identidad, consultas: string[]): Promise<{ candidatos: Candidato[]; localizada: boolean }> {
  const salida: Candidato[] = [];
  let localizada = false;
  const consulta = consultas[0];
  const datos = await pedirJson(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(consulta)}&format=jsonv2&extratags=1&addressdetails=1&limit=3&accept-language=es`,
  );
  const lista = Array.isArray(datos) ? (datos as Record<string, unknown>[]) : [];
  for (const r of lista) {
    const etiquetas = (r.extratags ?? {}) as Record<string, string>;
    const web = etiquetas.website ?? etiquetas["contact:website"] ?? null;
    const nombre = String(r.name ?? etiquetas.name ?? "");
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    const lugar = String((r.address as Record<string, string> | undefined)?.city ?? (r.address as Record<string, string> | undefined)?.town ?? (r.address as Record<string, string> | undefined)?.municipality ?? "");
    // La entidad puede estar localizada y no publicar web: son dos cosas distintas, y esta segunda
    // es la que explica la mayoría de los huecos («existe, pero no publica nada»).
    const coincideNombre = nombre ? pareceElMismo(ident.nombre, nombre) : false;
    const coincideLugar = lugar && ident.municipio ? pareceElMismo(ident.municipio, lugar) : null;
    if (coincideNombre && coincideLugar !== false) localizada = true;
    if (!web || !/^https?:/i.test(web)) continue;
    if (!coincideNombre) continue;
    salida.push(
      conVerificacion(
        {
          url: web,
          prioridad: 1,
          tipo: NOMBRE_PRIORIDAD[1],
          titulo: nombre,
          procedencia: "Nominatim (OpenStreetMap)",
          procedenciaUrl: `https://www.openstreetmap.org/${String(r.osm_type ?? "node")}/${String(r.osm_id ?? "")}`,
          imagen: null,
          imagenProcedencia: null,
        },
        ident,
        Number.isFinite(lat) ? lat : null,
        Number.isFinite(lng) ? lng : null,
        lugar || null,
      ),
    );
  }
  return { candidatos: salida, localizada };
}

/**
 * Las consultas que se hacen, tal y como se pidieron: nombre + ciudad, nombre + provincia,
 * nombre + turismo, nombre + oficial, nombre + precio.
 */
export function consultasPara(ident: Identidad): string[] {
  const partes = [ident.nombre];
  const salida = [
    `${ident.nombre} ${ident.municipio ?? ""} ${ident.provincia ?? ""}`.trim(),
    `${ident.nombre} ${ident.municipio ?? ""}`.trim(),
    `${ident.nombre} ${ident.provincia ?? ""}`.trim(),
    `${ident.nombre} turismo`,
    `${ident.nombre} oficial`,
    `${ident.nombre} precio`,
  ];
  return [...new Set(salida.filter((c) => c.length > partes[0].length))];
}

export interface ResultadoBusqueda {
  candidatos: Candidato[];
  articulo: Candidato | null;
  consultas: string[];
  motores: string[];
  /** La entidad existe en las fuentes abiertas, aunque no publique web. Es un motivo distinto. */
  localizada: boolean;
}

/**
 * Busca la entidad en las fuentes abiertas y devuelve los candidatos ORDENADOS por prioridad y
 * confianza. No decide por el primero que aparezca: eso lo hace el motor, comprobando la identidad.
 */
export async function buscarCandidatos(ident: Identidad): Promise<ResultadoBusqueda> {
  const consultas = consultasPara(ident);
  const motores: string[] = [];
  const todos: Candidato[] = [];
  let articulo: Candidato | null = null;

  const [wd, wp, nm] = await Promise.all([
    deWikidata(ident, consultas).catch(() => [] as Candidato[]),
    deWikipedia(ident, consultas).catch(() => ({ candidatos: [] as Candidato[], articulo: null })),
    deNominatim(ident, consultas).catch(() => ({ candidatos: [] as Candidato[], localizada: false })),
  ]);
  if (wd.length) motores.push("Wikidata");
  if (wp.candidatos.length || wp.articulo) motores.push("Wikipedia (es)");
  if (nm.candidatos.length) motores.push("Nominatim");
  todos.push(...wd, ...wp.candidatos, ...nm.candidatos);
  articulo = wp.articulo;

  // Sin duplicados por dominio, y ordenados: primero la prioridad, y dentro de ella la confianza.
  const vistos = new Set<string>();
  const orden: Record<Candidato["confianza"], number> = { high: 0, medium: 1, low: 2 };
  const limpios = todos
    .filter((c) => {
      let host = "";
      try {
        host = new URL(c.url).hostname.toLowerCase().replace(/^www\./, "");
      } catch {
        return false;
      }
      if (vistos.has(host)) return false;
      vistos.add(host);
      return true;
    })
    .sort((a, b) => a.prioridad - b.prioridad || orden[a.confianza] - orden[b.confianza]);

  return { candidatos: limpios, articulo, consultas, motores, localizada: nm.localizada || wp.articulo !== null };
}
