/**
 * PUBLICIDAD — ESTRUCTURA PREPARADA Y NADA ACTIVADO.
 *
 * Hoy Hestiat es 100 % gratuito y no gana dinero: no hay comisión, no hay cuota, no hay publicidad.
 * Este fichero existe para que el día que haya tráfico suficiente se pueda incorporar publicidad
 * sin rehacer nada, y para dejar claro qué se cobraría y qué no.
 *
 * MIENTRAS ESTÉ EN `false` NO PASA NADA:
 *   · no se carga ningún script de terceros (ni AdSense ni nada parecido);
 *   · no se reserva espacio vacío que empuje el contenido hacia abajo;
 *   · el hueco no pinta ni un solo píxel, así que no afecta al LCP ni al peso de la página.
 *
 * CUANDO SE ACTIVE, HAY QUE HACER DOS COSAS MÁS, Y SON OBLIGATORIAS:
 *   1. Revisar la política de cookies y la de privacidad: un proveedor de publicidad como AdSense
 *      instala cookies de terceros y hay que declararlo antes de encenderlo.
 *   2. Cargar el script del proveedor DESPUÉS del primer pintado (nunca en el `<head>`), para que
 *      el LCP siga siendo del póster y no de la publicidad.
 *
 * LOS HUECOS ESTÁN LOCALIZADOS, NO INVENTADOS: son los cuatro sitios de la web donde un anuncio
 * encaja sin tapar contenido ni romper la estética.
 */
export type FormatoAnuncio = "horizontal" | "cuadrado";

export interface HuecoPublicidad {
  id: string;
  ubicacion: string;
  formato: FormatoAnuncio;
  /** Alto reservado cuando se active, en píxeles. Nunca se reserva hoy. */
  alto: number;
}

/** Interruptor general. Hoy, apagado. */
export const PUBLICIDAD_ACTIVA = false;

/** Proveedor previsto. Se elige al encenderlo; hoy no hay ninguno cargado. */
export const PROVEEDOR_PUBLICIDAD: null | string = null;

export const HUECOS_PUBLICIDAD: HuecoPublicidad[] = [
  {
    id: "portada-tras-destinos",
    ubicacion: "Portada, entre «Destinos para ti» y «Servicios populares»",
    formato: "horizontal",
    alto: 90,
  },
  {
    id: "listado-costado",
    ubicacion: "Listado de alojamientos, en la columna del mapa (solo escritorio)",
    formato: "cuadrado",
    alto: 250,
  },
  {
    id: "ficha-tras-galeria",
    ubicacion: "Ficha de alojamiento, después de la galería y antes del mapa",
    formato: "horizontal",
    alto: 90,
  },
  {
    id: "experiencias-tras-filtros",
    ubicacion: "Listado de experiencias, después de los filtros",
    formato: "horizontal",
    alto: 90,
  },
];

export function huecoDe(id: string): HuecoPublicidad | null {
  return HUECOS_PUBLICIDAD.find((h) => h.id === id) ?? null;
}
