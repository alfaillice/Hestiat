/**
 * Traducción de una fila de `accommodation` a los datos que necesita una tarjeta de la galería.
 *
 * Se comparte entre la primera carga (servidor) y las páginas siguientes que pide el scroll
 * infinito, para que las tarjetas nuevas sean idénticas a las primeras. Una sola implementación.
 *
 * Sin acceso a datos: este módulo puede importarse también desde el cliente (solo como tipo).
 */
import { miniatura } from "@/lib/miniatura";

export interface TarjetaGaleria {
  id: number;
  slug: string;
  titulo: string;
  ciudad: string | null;
  provincia: string | null;
  pais: string | null;
  /** Precio a mostrar; null si no hay ninguno. */
  precio: number | null;
  /** true = el precio es orientativo («desde»), no un precio publicado y confirmado. */
  orientativo: boolean;
  /** true si el precio es real (`price_type = 'real'`), el único caso con distintivo. */
  precioConfirmado: boolean;
  puntuacion: number | null;
  resenas: number;
  portada: string | null;
  /** true cuando la imagen que se enseña NO es del alojamiento, sino de referencia (su localidad). */
  portadaReferencial?: boolean;
}

export function aTarjeta(f: Record<string, unknown>): TarjetaGaleria {
  const real = Number(f.price_per_night) > 0 ? Number(f.price_per_night) : null;
  const indicativo = Number(f.indicative_price) > 0 ? Number(f.indicative_price) : null;
  const puntuacion =
    Number(f.review_count) > 0 && f.review_score !== null && f.review_score !== undefined
      ? Number(f.review_score)
      : null;
  return {
    id: Number(f.id),
    slug: String(f.slug ?? ""),
    titulo: String(f.title ?? ""),
    ciudad: (f.city as string) ?? null,
    provincia: (f.province as string) ?? null,
    pais: (f.country as string) ?? null,
    precio: real ?? indicativo,
    orientativo: real === null && indicativo !== null,
    precioConfirmado: real !== null && String(f.price_type ?? "") === "real",
    puntuacion,
    resenas: Number(f.review_count) || 0,
    // Miniatura a 420 px: 42 tarjetas por tanda tienen que pesar poco.
    portada: f.portada ? miniatura(String(f.portada), 420) : null,
    portadaReferencial: Boolean(f.portada_referencial),
  };
}

/** Texto del precio tal y como se muestra: publicado, orientativo o a consultar. */
export function textoPrecio(t: TarjetaGaleria): { principal: string; sufijo: string } {
  if (t.precio === null) return { principal: "Precio a consultar", sufijo: "" };
  const valor = `${t.precio.toLocaleString("es-ES")} €`;
  return { principal: `${t.orientativo ? "Desde " : ""}${valor}`, sufijo: " / noche" };
}

/**
 * El precio del marcador del mapa, en versión corta.
 *
 * No es un segundo cálculo: consume `textoPrecio`, que es el mismo que usa la tarjeta. Así es
 * imposible que la tarjeta diga «95 €» y el marcador diga «Consultar»: los dos leen lo mismo. Lo
 * único propio de aquí es acortar el caso sin precio a «Consultar», porque el marcador es pequeño.
 */
export function textoPrecioMarcador(t: TarjetaGaleria): string {
  if (t.precio === null) return "Consultar";
  return textoPrecio(t).principal;
}
