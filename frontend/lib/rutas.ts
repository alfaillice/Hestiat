/**
 * GENERADOR CENTRAL DE RUTAS PÚBLICAS.
 *
 * Motivo: cada componente construía su ruta a mano (`/alojamiento/${slug}`, etc.). Nada impedía
 * que un componente compartido recibiera datos de servicio y produjera una ruta de alojamiento.
 * Este módulo es el ÚNICO sitio donde se decide qué ruta corresponde a cada tipo de publicación.
 *
 * Los tipos son estrictos a propósito: pasar un tipo que no exista es un error de compilación,
 * no un enlace roto descubierto por un visitante.
 *
 * IMPORTANTE: las rutas de aquí son las REALES del proyecto y ya están indexadas. No se cambian.
 *   /alojamiento/<slug>    /experiencias/<slug>    /servicios/<slug>
 *   /experiencia/<id>  NO existe.  /servicio/<id>  NO existe.
 */

export type TipoPublicacion = "alojamiento" | "experiencia" | "servicio";

/** Raíz pública, en un solo sitio. */
export const BASE_URL = "https://hestiat.com";

/** Ruta base de cada tipo. Añadir un tipo nuevo obliga a tocar este mapa y nada más. */
const RUTA_BASE: Record<TipoPublicacion, string> = {
  alojamiento: "/alojamiento",
  experiencia: "/experiencias",
  servicio: "/servicios",
};

/** Rutas que NO deben aparecer nunca en un enlace generado para otro tipo. */
const RUTA_PROHIBIDA: Record<TipoPublicacion, string> = {
  alojamiento: "/alojamiento",
  experiencia: "/experiencias",
  servicio: "/servicios",
};

/**
 * Ruta relativa de la ficha pública. Es la función que deben usar los componentes.
 *
 * El slug se codifica y se limpia: un slug con barra inicial no puede convertirse en otro segmento
 * de ruta, y un slug ausente no puede producir un enlace a la portada del tipo (eso sería un enlace
 * que parece de la ficha y no lo es).
 */
export function rutaFicha(tipo: TipoPublicacion, slug: string | null | undefined): string | null {
  const limpio = String(slug ?? "").trim().replace(/^\/+/, "");
  if (!limpio) return null;
  return `${RUTA_BASE[tipo]}/${encodeURIComponent(limpio)}`;
}

/** Ruta absoluta, para mensajes de WhatsApp, datos estructurados y sitemaps. */
export function urlFicha(tipo: TipoPublicacion, slug: string | null | undefined): string | null {
  const r = rutaFicha(tipo, slug);
  return r ? `${BASE_URL}${r}` : null;
}

/** Ruta del listado de una categoría, opcionalmente filtrado. */
export function rutaListado(
  tipo: TipoPublicacion,
  filtros?: { categoria?: string | null; provincia?: string | null },
): string {
  const p = new URLSearchParams();
  const cat = String(filtros?.categoria ?? "").trim();
  const prov = String(filtros?.provincia ?? "").trim();
  if (cat) p.set("categoria", cat);
  if (prov) p.set("provincia", prov);
  const q = p.toString();
  return q ? `${RUTA_BASE[tipo]}?${q}` : RUTA_BASE[tipo];
}

/**
 * Comprobación estructural: ¿esta ruta corresponde de verdad a este tipo?
 *
 * Se usa en pruebas de regresión para detectar el fallo que motivó este módulo: un enlace de
 * servicio construido con la ruta de alojamiento. Devuelve `false` si el tipo está mal, si la ruta
 * pertenece a otra categoría o si no hay ruta.
 */
export function rutaCorresponde(tipo: TipoPublicacion, ruta: string | null | undefined): boolean {
  const r = String(ruta ?? "").trim();
  if (!r) return false;
  const base = RUTA_BASE[tipo];
  if (!r.startsWith(`${base}/`) && r !== base) return false;
  // Y no puede contener la base de OTRA categoría por delante.
  const otras = (Object.keys(RUTA_PROHIBIDA) as TipoPublicacion[]).filter((t) => t !== tipo);
  return !otras.some((t) => r.includes(`${RUTA_PROHIBIDA[t]}/`));
}

/** Deduce el tipo a partir de una ruta. Útil para auditar enlaces existentes. */
export function tipoDeRuta(ruta: string | null | undefined): TipoPublicacion | null {
  const r = String(ruta ?? "").trim();
  for (const t of Object.keys(RUTA_BASE) as TipoPublicacion[]) {
    if (r === RUTA_BASE[t] || r.startsWith(`${RUTA_BASE[t]}/`) || r.startsWith(`${RUTA_BASE[t]}?`)) return t;
  }
  return null;
}
