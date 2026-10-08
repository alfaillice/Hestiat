/**
 * BÚSQUEDA DE PRECIO EN LA WEB DEL PROPIO SITIO — SOLO SERVIDOR.
 *
 * Un precio solo se busca donde puede verificarse: en la web oficial de la entidad, y en sus páginas
 * de tarifas, entradas o reservas. Nada de buscadores generales ni de directorios: si el precio no
 * está publicado por quien lo cobra, no se escribe.
 *
 * Lo que se lee:
 *   · datos estructurados de la página (ofertas y precios declarados);
 *   · texto visible con su palabra al lado («Entrada general: 5 €», «Desde 12 €», «Tarifa adulto 9 €»).
 *
 * Lo que se guarda: SIEMPRE como orientativo, con la dirección exacta de donde salió. Si no hay
 * ningún precio legible, no se guarda nada: la ficha sigue diciendo «Consultar». Nunca se inventa.
 */

const UA = "Hestiat/2.0 (enriquecimiento de catalogo; https://hestiat.com; hola@hestiat.com)";

export interface PrecioHallado {
  valor: number;
  texto: string;
  url: string;
  contexto: string;
  confianza: "high" | "medium" | "low";
}

/** Palabras que indican que ahí hay una tarifa. */
const CLAVES = /(entrada|entradas|tarifa|tarifas|precio|precios|desde|adulto|adultos|general|reducida|nino|ninos|grupo|abono|cuota|coste|importe|rate|rates|price|ticket|tickets|reserva)/i;
/** Enlaces que suelen llevar a la página de precios. */
const ENLACE_PRECIOS = /(tarifa|precio|entrada|entradas|reserva|abono|cuota|rate|price|ticket|book)/i;

function limpiarHtml(t: string): string {
  return t
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function traer(url: string, timeoutMs = 9000): Promise<{ html: string; final: string } | null> {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: control.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    });
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type") ?? "";
    if (!tipo.includes("text/html")) return null;
    return { html: (await r.text()).slice(0, 400_000), final: r.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Los precios que la propia página declara en sus datos estructurados. */
function deDatosEstructurados(html: string, url: string): PrecioHallado[] {
  const salida: PrecioHallado[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const crudo = JSON.parse(m[1]);
      const lista = Array.isArray(crudo) ? crudo : [crudo];
      for (const d of lista) {
        const ofertas = d?.offers ? (Array.isArray(d.offers) ? d.offers : [d.offers]) : [];
        const valores = [
          ...ofertas.map((o: Record<string, unknown>) => o?.price),
          d?.price,
          d?.priceRange,
        ].filter((v) => v !== undefined && v !== null);
        for (const v of valores) {
          const texto = String(v);
          const num = Number(texto.replace(/[^0-9.,]/g, "").replace(",", "."));
          if (Number.isFinite(num) && num > 0 && num < 100000) {
            salida.push({ valor: num, texto, url, contexto: "datos estructurados de la página", confianza: "high" });
          }
        }
      }
    } catch {
      /* un JSON-LD roto no rompe nada */
    }
  }
  return salida;
}

/** Los precios escritos en el texto, siempre con su palabra al lado. */
function delTexto(html: string, url: string): PrecioHallado[] {
  const salida: PrecioHallado[] = [];
  const texto = limpiarHtml(html);
  // Cantidades que NO son dinero aunque lleven un número al lado: minutos, kilómetros, plazas...
  const NO_ES_DINERO = /(minuto|min\b|hora|d[ií]a|semana|mes|a[nñ]o|km|kil[oó]metro|metro|plaza|persona|%|por ciento|plazas)/i;
  const patrones = [
    /(entrada[^.\d]{0,28}|tarifa[^.\d]{0,28}|precio[^.\d]{0,28}|desde[^.\d]{0,14}|adultos?[^.\d]{0,18}|general[^.\d]{0,18}|cuota[^.\d]{0,18}|abono[^.\d]{0,18}|rate[^.\d]{0,18}|price[^.\d]{0,18})(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|EUR|euros)/gi,
    /(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|EUR|euros)[^.\d]{0,24}(entrada|tarifa|precio|adultos?|general|desde|cuota|abono|rate|price)/gi,
  ];
  for (const patron of patrones) {
    for (const m of texto.matchAll(patron)) {
      const textoNumero = m[2] ?? m[1];
      const num = Number(String(textoNumero).replace(",", "."));
      if (!Number.isFinite(num) || num <= 0 || num > 100000) continue;
      const inicio = Math.max(0, (m.index ?? 0) - 40);
      // Si justo antes del número hay una unidad de tiempo o de medida, no es una tarifa.
      if (NO_ES_DINERO.test(texto.slice(Math.max(0, (m.index ?? 0) - 26), m.index ?? 0))) continue;
      salida.push({
        valor: num,
        texto: `${num} €`,
        url,
        contexto: texto.slice(inicio, Math.min(texto.length, inicio + 120)).trim(),
        confianza: "medium",
      });
    }
  }
  return salida;
}

/**
 * Busca precios: primero en la página dada, y si no hay, en hasta dos páginas de tarifas o entradas
 * enlazadas desde ella. Devuelve lo encontrado, sin decidir: eso lo hace el motor.
 */
export async function buscarPrecios(
  base: string,
  opciones: { maxPaginas?: number } = {},
): Promise<{ precios: PrecioHallado[]; visitadas: string[] }> {
  const maxPaginas = Math.min(Math.max(opciones.maxPaginas ?? 3, 1), 4);
  const visitadas: string[] = [];
  const precios: PrecioHallado[] = [];

  const principal = await traer(base);
  if (!principal) return { precios, visitadas };
  visitadas.push(principal.final);
  precios.push(...deDatosEstructurados(principal.html, principal.final), ...delTexto(principal.html, principal.final));

  if (precios.length > 0) return { precios, visitadas };

  // Sin precio en la portada: se miran sus páginas de tarifas, entradas o reservas.
  const enlaces: string[] = [];
  for (const m of principal.html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const href = m[1];
    const texto = limpiarHtml(m[2]);
    if (!ENLACE_PRECIOS.test(href) && !ENLACE_PRECIOS.test(texto)) continue;
    try {
      const u = new URL(href, principal.final);
      if (u.hostname !== new URL(principal.final).hostname) continue;
      u.hash = "";
      if (!enlaces.includes(u.toString())) enlaces.push(u.toString());
    } catch {
      /* un enlace raro no rompe nada */
    }
    if (enlaces.length >= maxPaginas - 1) break;
  }

  for (const enlace of enlaces) {
    const p = await traer(enlace);
    if (!p) continue;
    visitadas.push(p.final);
    precios.push(...deDatosEstructurados(p.html, p.final), ...delTexto(p.html, p.final));
    if (precios.length > 0) break;
  }

  return { precios, visitadas };
}
