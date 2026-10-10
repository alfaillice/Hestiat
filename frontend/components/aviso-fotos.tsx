import Link from "next/link";

/**
 * AVISO DE FOTOS EN EL PANEL DEL ANFITRIÓN.
 *
 * Un anuncio sin fotos propias se enseña con la imagen de referencia de su zona, claramente marcada
 * como tal. Eso evita el hueco vacío, pero no es una foto del alojamiento: la enseña quien la tiene.
 * Este aviso se lo dice al anfitrión, con el número exacto y un camino directo para resolverlo.
 *
 * No aparece si todos sus anuncios tienen fotos: un aviso permanente deja de leerse.
 */
export default function AvisoFotos({ total, sinFotos }: { total: number; sinFotos: number }) {
  if (total === 0 || sinFotos === 0) return null;
  const uno = sinFotos === 1;
  return (
    <div className="aviso aviso-aviso" role="status" style={{ marginTop: 12 }}>
      <p style={{ margin: 0 }}>
        {uno ? "Uno de tus anuncios no tiene fotos." : `${sinFotos} de tus ${total} anuncios no tienen fotos.`}{" "}
        Mientras no las tenga, se enseña la <strong>imagen de referencia de su zona</strong>, marcada como tal,
        en lugar de una fotografía del alojamiento.
      </p>
      <p className="ficha-texto" style={{ margin: "8px 0 0" }}>
        Las fotos propias son lo que más influye en que alguien reserve: súbelas desde la ficha de cada
        anuncio, en <Link href="/host/alojamientos">Mis alojamientos</Link>. Formato JPG, PNG o WebP.
      </p>
    </div>
  );
}
