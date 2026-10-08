import Link from "next/link";
import type { DestinoHome } from "@/lib/home.server";
import ImagenSegura from "@/components/imagen-segura";

/**
 * Tarjeta de destino: la ciudad, su foto real y cuántos alojamientos tiene.
 *
 * Vertical (3:4) como en la referencia, con la imagen recortada y un degradado suave abajo para que
 * el nombre se lea sobre cualquier foto. Al pasar el ratón se levanta un poco y la imagen se acerca
 * un 3 %: movimiento discreto, nada que rebote.
 *
 * La foto es una fotografía real del monumento de esa ciudad, verificada una a una contra Commons;
 * el nombre del fichero está en `lib/imagenes-home.ts`. Si no hubiera imagen, la tarjeta se dibuja
 * igual con el color de superficie: nunca un hueco roto.
 */
export default function TarjetaDestino({ destino }: { destino: DestinoHome }) {
  return (
    <Link className="tdest" href={destino.href}>
      <span className="tdest-media">
        <ImagenSegura
          src={destino.imagen}
          alt={`${destino.nombre}: imagen de referencia`}
          fondo="tdest-sinfoto"
        />
        <span className="tdest-velo" />
      </span>
      <span className="tdest-txt">
        <b>{destino.nombre}</b>
        <span>
          {destino.total.toLocaleString("es-ES")} alojamientos
          {destino.ambito === "provincia" ? " en la provincia" : ""}
        </span>
      </span>
    </Link>
  );
}
