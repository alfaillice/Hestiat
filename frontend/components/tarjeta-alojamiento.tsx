import Link from "next/link";
import Corazon from "@/components/corazon";
import ImagenSegura from "@/components/imagen-segura";
import { textoPrecio } from "@/lib/tarjetas";
import type { TarjetaGaleria } from "@/lib/tarjetas";

/**
 * Tarjeta de la galería de alojamientos.
 *
 * Orden de importancia, tal y como se pidió: fotografía → nombre → ubicación → valoración → precio.
 * La fotografía ocupa la mayor parte; no hay descripción, ni camas, ni baños, ni servicios: eso
 * pertenece a la ficha.
 *
 * Dos detalles deliberados:
 *  · **Nada inventado.** Si no hay valoración, no se pinta ninguna; si no hay foto, se dice «Sin
 *    fotografía» en lugar de dejar un hueco o una imagen genérica.
 *  · **Toda la tarjeta es clicable** mediante un enlace estirado (`tjg-enlace`) que cubre la tarjeta,
 *    y el corazón va por encima con más índice de capa. Así no hay que acertar en un enlace pequeño
 *    y el HTML sigue siendo válido (un botón dentro de un enlace no lo sería).
 */
export default function TarjetaAlojamiento({
  a,
  guardado = false,
  haySesion = false,
  volverA = "/search",
  nota,
}: {
  a: TarjetaGaleria;
  guardado?: boolean;
  haySesion?: boolean;
  volverA?: string;
  /** Línea extra bajo la ubicación (por ejemplo, la distancia: «a 3,2 km»). */
  nota?: string;
}) {
  const lugar = [a.ciudad, a.provincia].filter(Boolean).join(", ");
  const { principal, sufijo } = textoPrecio(a);

  return (
    <article className="tjg">
      <div className="tjg-foto">
        {a.portada ? (
          <ImagenSegura src={a.portada} alt={a.titulo} ancho={420} alto={315} fondo="tjg-sinfoto" />
        ) : (
          <span className="tjg-sinfoto">Sin fotografía</span>
        )}
        {a.precioConfirmado && <span className="tjg-badge">Precio confirmado</span>}
        <Corazon accommodationId={a.id} guardadoInicial={guardado} haySesion={haySesion} volverA={volverA} />
      </div>

      <div className="tjg-info">
        <h3 className="tjg-nombre">{a.titulo}</h3>
        {lugar && <p className="tjg-lugar">{lugar}</p>}
        {nota ? <p className="tjg-lugar">{nota}</p> : null}
        {a.puntuacion !== null && (
          <p className="tjg-estrella">
            <span aria-hidden="true">★</span> {a.puntuacion.toFixed(1).replace(".", ",")}
            <span className="tjg-resenas"> ({a.resenas})</span>
          </p>
        )}
        <p className="tjg-precio">
          {principal}
          {sufijo && <span className="tjg-sufijo">{sufijo}</span>}
        </p>
      </div>

      <Link className="tjg-enlace" href={`/alojamiento/${a.slug}`}>
        <span className="sr-only">
          Ver la ficha de {a.titulo}
          {lugar ? ` en ${lugar}` : ""}
        </span>
      </Link>
    </article>
  );
}
