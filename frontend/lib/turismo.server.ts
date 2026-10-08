/**
 * EXTRACTORES DE TURISMO OFICIAL — SOLO SERVIDOR.
 *
 * Niveles 2 y 3 de la resolución de identidad:
 *   2 · turismo oficial de la LOCALIDAD
 *   3 · turismo oficial de la PROVINCIA o REGIÓN
 *
 * Por qué existe esto: depender solo del buscador general daba pocas coincidencias fiables en
 * negocios pequeños. Los portales oficiales de turismo publican fichas de los sitios de su
 * territorio, con dirección, teléfono y a veces tarifas, y son fuente de nivel 2-3: mejor que
 * cualquier resultado suelto.
 *
 * Cómo funciona, sin inventar nada:
 *   1. Se proponen portales oficiales conocidos (una tabla por provincia/región) y patrones de
 *      dominio para el turismo de la localidad.
 *   2. CADA dominio se comprueba contra la red en el momento: si no responde o no es un portal de
 *      turismo, se descarta y no se vuelve a intentar en toda la tanda (caché en memoria).
 *   3. En el portal que responde se usa SU buscador interno con el nombre de la entidad, y solo se
 *      aceptan resultados que mencionen el nombre.
 *   4. La página resultante la abre y la verifica la capa de resolución: nombre + ubicación.
 *
 * Nunca se da por bueno un resultado por venir de un portal: se comprueba igual que los demás.
 */
import { normalizar, palabras } from "@/lib/fuentes.server";

const UA = "Hestiat/3.0 (resolucion de catalogo; https://hestiat.com; hola@hestiat.com)";

/** Portales oficiales de turismo por provincia o comunidad. Son instituciones públicas; se comprueba
 *  que respondan antes de usar ninguno, así que un dominio equivocado simplemente no se usa. */
const PORTALES_REGIONALES: Record<string, string[]> = {
  asturias: ["https://www.turismoasturias.es", "https://asturias.me"],
  cantabria: ["https://www.turismodecantabria.com"],
  "illes balears": ["https://www.illesbalears.travel"],
  baleares: ["https://www.illesbalears.travel"],
  almeria: ["https://www.turismodealmeria.org"],
  alicante: ["https://www.alicanteturismo.com"],
  "alacant/alacant": ["https://www.alicanteturismo.com"],
  madrid: ["https://www.esmadrid.com"],
  barcelona: ["https://www.barcelonaturisme.com"],
  girona: ["https://www.costabrava.org"],
  granada: ["https://www.granadatur.com"],
  malaga: ["https://www.malagaturismo.com"],
  sevilla: ["https://www.visitasevilla.es"],
  valencia: ["https://www.visitvalencia.com"],
  "valencia/valencia": ["https://www.visitvalencia.com"],
  bizkaia: ["https://www.bizkaia.eus/turismo"],
  gipuzkoa: ["https://www.gipuzkoaturismoa.eus"],
  alava: ["https://www.vitoria-gasteiz.org"],
  galicia: ["https://www.turismo.gal"],
  "a coruna": ["https://www.turismocoruna.com"],
  pontevedra: ["https://www.turismoriasbaixas.com"],
  murcia: ["https://www.murciaturistica.es"],
  "castilla y leon": ["https://www.turismocastillayleon.com"],
  "castilla-la mancha": ["https://www.turismocastillalamancha.es"],
  extremadura: ["https://www.turismoextremadura.com"],
  aragon: ["https://www.turismodearagon.com"],
  navarra: ["https://www.turismo.navarra.es"],
  "la rioja": ["https://www.larioja.org/turismo"],
  canarias: ["https://www.hellocanaryislands.com"],
  "santa cruz de tenerife": ["https://www.webtenerife.com"],
  "las palmas": ["https://www.grancanaria.com"],
  ceuta: ["https://www.ceuta.es"],
  melilla: ["https://www.melillaturismo.com"],
};

/** Patrones de dominio para el turismo de una localidad concreta. */
function dominiosLocales(ciudad: string): string[] {
  const limpio = normalizar(ciudad).replace(/\s+/g, "");
  if (limpio.length < 4) return [];
  return [
    `https://www.turismo${limpio}.es`,
    `https://www.turismode${limpio}.es`,
    `https://www.visit${limpio}.com`,
    `https://www.visit${limpio}.es`,
  ];
}

/** Rutas de búsqueda interna más habituales de un portal de turismo. */
const RUTAS_BUSQUEDA = ["/?s=", "/es/buscar?q=", "/buscar?q=", "/es/search?q="];

/** Caché de portales: si un dominio no responde, no se vuelve a intentar en toda la tanda. */
const portalesVivos = new Map<string, boolean>();

async function traer(url: string, timeoutMs = 9000): Promise<{ html: string; final: string } | null> {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: control.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "es-ES,es;q=0.9" },
    });
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type") ?? "";
    if (!tipo.includes("text/html")) return null;
    return { html: (await r.text()).slice(0, 500_000), final: r.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function limpiar(t: string): string {
  return t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export interface HallazgoTurismo {
  url: string;
  nivel: 2 | 3;
  portal: string;
  titulo: string;
}

/**
 * Busca la entidad en los portales de turismo que correspondan a su localidad y su provincia.
 * Devuelve páginas candidatas; la verificación de identidad la hace después la capa de resolución.
 */
export async function buscarEnTurismoOficial(entrada: {
  nombre: string;
  ciudad: string | null;
  provincia: string | null;
}): Promise<HallazgoTurismo[]> {
  const salida: HallazgoTurismo[] = [];
  const yaVisto = new Set<string>();
  const clavesNombre = palabras(entrada.nombre);
  if (clavesNombre.length === 0) return salida;

  const planes: { nivel: 2 | 3; dominios: string[]; portal: string }[] = [];
  const locales = entrada.ciudad ? dominiosLocales(entrada.ciudad) : [];
  if (locales.length > 0) planes.push({ nivel: 2, dominios: locales.slice(0, 2), portal: `Turismo de ${entrada.ciudad}` });
  const regionales = PORTALES_REGIONALES[normalizar(entrada.provincia ?? "")] ?? [];
  if (regionales.length > 0) planes.push({ nivel: 3, dominios: regionales.slice(0, 1), portal: `Turismo de ${entrada.provincia}` });

  for (const plan of planes) {
    let encontrado = false;
    for (const dominio of plan.dominios) {
      if (encontrado) break;
      let host = "";
      try {
        host = new URL(dominio).hostname;
      } catch {
        continue;
      }
      if (portalesVivos.get(host) === false) continue;
      // Dos rutas de búsqueda como mucho por dominio: suficiente para saber si el portal tiene
      // buscador y si encuentra la entidad.
      for (const ruta of RUTAS_BUSQUEDA.slice(0, 2)) {
        const r = await traer(`${dominio}${ruta}${encodeURIComponent(entrada.nombre)}`);
        if (!r) continue;
        portalesVivos.set(host, true);
        const origen = new URL(r.final).origin;
        const enlaces: { url: string; titulo: string }[] = [];
        for (const m of r.html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
          const texto = limpiar(m[2]);
          let destino = "";
          try {
            const u = new URL(m[1], r.final);
            if (u.origin !== origen) continue;
            destino = u.toString();
          } catch {
            continue;
          }
          if (yaVisto.has(destino)) continue;
          // Solo resultados que nombren la entidad: el buscador del portal no basta por sí solo.
          const textoNorm = normalizar(`${texto} ${destino}`);
          if (!clavesNombre.some((p) => textoNorm.includes(p.slice(0, Math.max(5, p.length - 2))))) continue;
          yaVisto.add(destino);
          enlaces.push({ url: destino, titulo: texto });
          if (enlaces.length >= 2) break;
        }
        for (const e of enlaces) {
          salida.push({ url: e.url, nivel: plan.nivel, portal: plan.portal, titulo: e.titulo || entrada.nombre });
          encontrado = true;
        }
        if (encontrado) break;
      }
      if (!encontrado && portalesVivos.get(host) === undefined) portalesVivos.set(host, false);
    }
  }

  return salida;
}
