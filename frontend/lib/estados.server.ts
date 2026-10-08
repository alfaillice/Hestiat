/**
 * ESTADOS DE PUBLICACIÓN — UNA SOLA VOCABULARIO PARA TODO HESTIAT.
 *
 * El catálogo arrastra tres formas distintas de decir lo mismo, una por familia de fichas:
 *
 *   alojamientos   accommodation.status      draft | published | paused | archived
 *   experiencias   experiencia.is_active     + quality_status (inactive | partial | complete)
 *   servicios      servicio_turistico.is_active + quality_status (… | needs_review)
 *
 * Eso obliga a que cada pantalla sepa cómo se dice «oculto» en la tabla que toque, y garantiza que
 * tarde o temprano alguien lo escriba mal. Aquí se traduce todo a UN vocabulario y se traduce de
 * vuelta, en un único sitio. No se duplican estructuras: los estados que ya existen se usan tal cual.
 *
 * TRADUCCIÓN A LO QUE YA HAY
 *   draft          → accommodation.status = 'draft'
 *   pending_review → accommodation.status = 'pending_review' (ampliado en la Fase 2) · o una solicitud
 *                    de alta pendiente en solicitud_catalogo · o quality_status = 'needs_review'
 *   published      → accommodation.status = 'published' · is_active = 1
 *   unpublished    → accommodation.status = 'paused' (así lo llama la web desde siempre) · is_active = 0
 *   suspended      → accommodation.status = 'suspended' (ampliado) · en catálogo: sin equivalente hoy
 *   deleted        → accommodation.status = 'deleted' (ampliado; borrado LÓGICO, la fila no se pierde)
 *   archived       → accommodation.status = 'archived' (ya existía; se conserva)
 *
 * LO QUE TODAVÍA NO SE PUEDE REPRESENTAR, Y SE DICE
 *   En experiencias y servicios solo hay «activa / no activa» y la calidad del dato. No existe hoy
 *   forma de marcar una ficha como suspendida o borrada sin tocar esas banderas. Para el portal de
 *   propietarios hará falta añadir esas dos marcas: se hará cuando se abra, no antes, y sin inventar
 *   estados que la base no pueda guardar.
 */
export type EstadoPublicacion =
  | "draft"
  | "pending_review"
  | "published"
  | "unpublished"
  | "suspended"
  | "deleted"
  | "archived";

export type EntidadPublicable = "alojamiento" | "experiencia" | "servicio";

export const ETIQUETA_ESTADO: Record<EstadoPublicacion, string> = {
  draft: "Borrador",
  pending_review: "Pendiente de revisión",
  published: "Publicado",
  unpublished: "Oculto",
  suspended: "Suspendido",
  deleted: "Eliminado (recuperable)",
  archived: "Archivado",
};

/** Estados en los que la ficha se ve en la web pública. */
export const VISIBLES: EstadoPublicacion[] = ["published"];

/** Estados que cuentan como «eliminado lógicamente»: no se borra la fila, se deja de mostrar. */
export const ELIMINADOS_LOGICOS: EstadoPublicacion[] = ["deleted", "archived"];

/* --------------------------------------------------------- traducción -- */

/** De lo que guarda `accommodation` al vocabulario común. */
export function estadoDeAlojamiento(status: string | null | undefined): EstadoPublicacion {
  const s = String(status ?? "").toLowerCase();
  if (s === "draft" || s === "pending_review" || s === "published" || s === "paused" || s === "suspended" || s === "deleted" || s === "archived") {
    return s === "paused" ? "unpublished" : (s as EstadoPublicacion);
  }
  // Cualquier valor desconocido se trata como borrador: nunca se publica por accidente.
  return "draft";
}

/** De lo que guardan experiencias y servicios (banderas) al vocabulario común. */
export function estadoDeCatalogo(fila: { is_active?: number | boolean | null; quality_status?: string | null }): EstadoPublicacion {
  const activa = Number(fila.is_active ?? 0) === 1;
  const calidad = String(fila.quality_status ?? "").toLowerCase();
  if (!activa) return calidad === "inactive" ? "unpublished" : "unpublished";
  if (calidad === "needs_review") return "pending_review";
  return "published";
}

/** De una solicitud de alta al vocabulario común: es el «borrador» de un proveedor. */
export function estadoDeSolicitud(estado: string | null | undefined): EstadoPublicacion {
  const s = String(estado ?? "").toLowerCase();
  if (s === "pendiente") return "pending_review";
  if (s === "aprobada") return "published";
  if (s === "rechazada") return "deleted";
  return "draft";
}

/* --------------------------------------------- traducción de vuelta -- */

export interface Escritura {
  /** Columna y valor que hay que escribir en la tabla de esa familia de fichas. */
  columnas: Record<string, string | number>;
  /** Si el estado implica que la ficha no se ve en la web. */
  oculta: boolean;
  /** Aviso para pantallas y para el futuro agente: qué significa y qué no. */
  nota: string;
}

/**
 * Cómo se escribe un estado canónico en cada familia. Devuelve lo que hay que guardar, y si hoy no
 * es representable lo dice en la nota en lugar de fingir que sí.
 */
export function escrituraDe(tipo: EntidadPublicable, estado: EstadoPublicacion): Escritura {
  if (tipo === "alojamiento") {
    const valor = estado === "unpublished" ? "paused" : estado;
    return {
      columnas: { status: valor },
      oculta: estado !== "published",
      nota:
        estado === "deleted"
          ? "Borrado lógico: la fila se conserva y se puede recuperar."
          : estado === "unpublished"
            ? "Oculto: se guarda como «paused», que es como la web lo llama desde siempre."
            : "",
    };
  }
  // Experiencias y servicios: solo hay activa / no activa.
  if (estado === "published") return { columnas: { is_active: 1 }, oculta: false, nota: "" };
  if (estado === "unpublished") return { columnas: { is_active: 0 }, oculta: true, nota: "" };
  return {
    columnas: {},
    oculta: true,
    nota: `«${ETIQUETA_ESTADO[estado]}» todavía no se puede guardar en una experiencia o un servicio: hace falta añadir esa marca (se hará al abrir el portal de propietarios). No se puede marcar hoy sin tocar las banderas de visibilidad.`,
  };
}

/** Transiciones permitidas. Evita saltos sin sentido (por ejemplo, de borrador a publicado sin revisar). */
export const TRANSICIONES: Record<EstadoPublicacion, EstadoPublicacion[]> = {
  draft: ["pending_review", "deleted"],
  pending_review: ["published", "draft", "deleted"],
  published: ["unpublished", "suspended", "deleted"],
  unpublished: ["published", "deleted"],
  suspended: ["published", "deleted", "unpublished"],
  deleted: ["draft", "published"],
  archived: ["draft", "deleted"],
};

export function puedeTransicionar(desde: EstadoPublicacion, hacia: EstadoPublicacion): boolean {
  return TRANSICIONES[desde]?.includes(hacia) ?? false;
}
