import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Cómo reservar en Hestiat — paso a paso",
  descripcion:
    "Buscar, comparar, elegir y reservar: los pasos reales para reservar un alojamiento en Hestiat, qué recibes por correo y cómo consultar el estado de tu reserva.",
  ruta: "/como-reservar",
});

export default function ComoReservar() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Cómo reservar</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Cuatro pasos, sin letra pequeña.
      </p>

      <section className="seccion-home">
        <h2>1. Busca</h2>
        <p style={{ lineHeight: 1.7 }}>
          Escribe en la barra de la cabecera el destino, la zona o el nombre del alojamiento, o entra
          por <Link href="/search">Explorar alojamientos</Link>. Puedes acotar por destino y fechas, y
          por categoría en experiencias y servicios.
        </p>
      </section>

      <section className="seccion-home">
        <h2>2. Compara</h2>
        <p style={{ lineHeight: 1.7 }}>
          Las tarjetas muestran ubicación, categoría y el precio <b>solo cuando está publicado</b>. Si
          aparece «Consultar», es que no hay precio público y no nos lo inventamos. Guarda en{" "}
          <Link href="/favoritos">Favoritos</Link> lo que quieras comparar después.
        </p>
      </section>

      <section className="seccion-home">
        <h2>3. Elige y reserva</h2>
        <ol style={{ lineHeight: 1.9 }}>
          <li>Abre la ficha y revisa el mapa, las fotos (con su procedencia) y los datos de contacto.</li>
          <li>Elige las fechas y el número de personas en el calendario de la ficha.</li>
          <li>Confirma la reserva. Queda registrada con un <b>código</b>.</li>
        </ol>
        <p style={{ lineHeight: 1.7 }}>
          <b>En Hestiat no se cobra nada:</b> no hay comisión ni pasarela de pago. El pago se acuerda
          directamente con el anfitrión, y así se te recuerda al confirmar.
        </p>
      </section>

      <section className="seccion-home">
        <h2>4. Después de reservar</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Recibes la confirmación por correo, y el anfitrión recibe el aviso con tus datos.</li>
          <li>
            Puedes consultar el estado de la reserva en cualquier momento con su código en{" "}
            <Link href="/reserva">consultar reserva</Link>.
          </li>
          <li>
            Para cambios o cancelaciones, habla con el anfitrión; si algo no cuadra, escríbenos desde{" "}
            <Link href="/contacto">contacto</Link>.
          </li>
        </ul>
      </section>

      <p style={{ marginTop: 24 }}>
        Más dudas en <Link href="/preguntas-frecuentes">preguntas frecuentes</Link> o en{" "}
        <Link href="/cancelaciones">cancelaciones</Link>.
      </p>
    </main>
  );
}
