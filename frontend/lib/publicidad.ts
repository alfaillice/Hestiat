/**
 * PUBLICIDAD — ESTRUCTURA PREPARADA, CON ADENSE CONECTADO Y APAGADO TODAVÍA.
 *
 * ── HISTORIA DE ESTE FICHERO ────────────────────────────────────────────────────────────────────
 * Nació cuando Hestiat era 100 % gratuito y sin publicidad, para dejar los huecos localizados. Hoy
 * el propietario ha autorizado Google AdSense, así que aquí vive ya el identificador de editor y el
 * identificador de cada bloque.
 *
 * ── MIENTRAS `PUBLICIDAD_ACTIVA` ESTÉ EN `false` NO PASA NADA ───────────────────────────────────
 *   · no se reserva espacio vacío que empuje el contenido hacia abajo;
 *   · el hueco no pinta ni un solo píxel, así que no afecta al LCP ni al peso de la página;
 *   · y como ningún bloque tiene todavía su identificador, aunque se encendiera no se mostraría un
 *     hueco vacío: sin `slotAdsense` no se dibuja nada.
 *
 * ── LO QUE FALTA PARA ENCENDERLO, Y NO DEPENDE DE MÍ ────────────────────────────────────────────
 *   1. Crear en el panel de AdSense cada bloque de anuncio y copiar aquí su `data-ad-slot`.
 *   2. Poner `PUBLICIDAD_ACTIVA = true`.
 *   3. Tener publicado el mensaje de consentimiento (CMP) en AdSense: es obligatorio antes de servir
 *      publicidad a visitantes de España.
 *
 * ── DOS NOTAS HONESTAS ──────────────────────────────────────────────────────────────────────────
 *   · La política de cookies y la de privacidad YA están actualizadas (12-10-2026) para declarar
 *     AdSense y sus cookies: era la primera condición obligatoria de este fichero, y está hecha.
 *   · Aquí se decía que el script del proveedor no debía ir nunca en el `<head>`, para no competir
 *     con el primer pintado. El código de VERIFICACIÓN de AdSense que pidió el propietario va en el
 *     `<head>` porque Google lo exige así para verificar el sitio (va con `async`, no bloquea el
 *     pintado). Los BLOQUES de anuncio, que son los que sí pesan, se cargan solo cuando este
 *     interruptor esté encendido.
 */

export type FormatoAnuncio = "horizontal" | "cuadrado";

export interface HuecoPublicidad {
  id: string;
  ubicacion: string;
  formato: FormatoAnuncio;
  /** Alto reservado cuando se active, en píxeles. Nunca se reserva hoy. */
  alto: number;
  /**
   * Identificador del bloque de AdSense (`data-ad-slot`). VACÍO = ese hueco no muestra nada.
   * Se copia del código que entrega Google para cada bloque.
   */
  slotAdsense: string;
}

/** Identificador de editor de AdSense. Es público: viaja en la dirección del script. */
export const ADSENSE_CLIENTE = "ca-pub-8207026302114375";

/**
 * Interruptor general. ENCENDIDO desde el 12-10-2026, cuando el propietario entregó el
 * identificador del bloque de anuncio.
 *
 * AVISO QUE SIGUE VIVO: el mensaje de consentimiento (CMP) de AdSense todavía NO está publicado.
 * Mientras no lo esté, la política de cookies publicada (que dice que las cookies publicitarias
 * solo se cargan si las aceptas) no se corresponde con la realidad. Es el paso que falta.
 */
export const PUBLICIDAD_ACTIVA = true;

/** Proveedor conectado. */
export const PROVEEDOR_PUBLICIDAD: null | string = "google-adsense";

export const HUECOS_PUBLICIDAD: HuecoPublicidad[] = [
  {
    id: "portada-tras-destinos",
    ubicacion: "Portada, entre «Destinos para ti» y «Servicios populares»",
    formato: "horizontal",
    alto: 110,
    slotAdsense: "5085417706",
  },
  {
    id: "listado-costado",
    ubicacion: "Listado de alojamientos, en la columna del mapa (solo escritorio)",
    formato: "cuadrado",
    alto: 250,
    slotAdsense: "",
  },
  {
    id: "ficha-tras-galeria",
    ubicacion: "Ficha de alojamiento, después de la galería y antes del mapa",
    formato: "horizontal",
    alto: 90,
    slotAdsense: "",
  },
  {
    id: "experiencias-tras-filtros",
    ubicacion: "Listado de experiencias, después de los filtros",
    formato: "horizontal",
    alto: 90,
    slotAdsense: "",
  },
  /* ── Huecos pedidos para las páginas de más tráfico, todos al final del contenido, donde un
        anuncio no interrumpe la lectura ni tapa nada. ── */
  {
    id: "experiencia-final",
    ubicacion: "Ficha de experiencia, al final, después de «Experiencias cerca de aquí»",
    formato: "horizontal",
    alto: 280,
    slotAdsense: "5085417706",
  },
  {
    id: "destino-final",
    ubicacion: "Ficha de destino /destino/<ciudad>, al final del contenido",
    formato: "horizontal",
    alto: 280,
    slotAdsense: "5085417706",
  },
  {
    id: "guia-final",
    ubicacion: "Guía de destino /guia/<ciudad>, al final del texto, antes del pie",
    formato: "horizontal",
    alto: 280,
    slotAdsense: "5085417706",
  },
  /* ── SEGUNDO ANUNCIO POR PÁGINA (decisión del propietario, 12-10-2026) ──────────────────────────
     Debajo de la cabecera, en el arranque del contenido. Van ETIQUETADOS como publicidad: no se
     camuflan como artículo porque eso incumple la política de Google (y haría perder la cuenta) y
     porque la política de cookies publicada en el sitio dice que los anuncios van identificados.
     Se usa el mismo bloque porque es el único que existe; lo suyo es crear en AdSense un bloque
     aparte para estos tres y pegar aquí su identificador. ── */
  {
    id: "experiencia-encabezado",
    ubicacion: "Ficha de experiencia, debajo de la cabecera, antes del título",
    formato: "horizontal",
    alto: 110,
    slotAdsense: "5085417706",
  },
  {
    id: "portada-tras-video",
    ubicacion: "Portada, justo después del vídeo de portada y antes de «Destinos para ti»",
    formato: "horizontal",
    alto: 110,
    slotAdsense: "5085417706",
  },
  {
    id: "destino-encabezado",
    ubicacion: "Ficha de destino, debajo de la cabecera, antes del título",
    formato: "horizontal",
    alto: 110,
    slotAdsense: "5085417706",
  },
  {
    id: "guia-encabezado",
    ubicacion: "Guía de destino, debajo de la cabecera, antes del título",
    formato: "horizontal",
    alto: 110,
    slotAdsense: "5085417706",
  },
];

export function huecoDe(id: string): HuecoPublicidad | null {
  return HUECOS_PUBLICIDAD.find((h) => h.id === id) ?? null;
}
