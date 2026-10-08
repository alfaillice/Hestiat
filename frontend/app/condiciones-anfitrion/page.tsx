import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";
import NotaLegal from "@/components/nota-legal";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Condiciones para anfitriones — Hestiat",
  descripcion:
    "Qué se compromete a cumplir quien publica un alojamiento en Hestiat: veracidad de los datos, disponibilidad, precios, fotos propias y trato con los huéspedes.",
  ruta: "/condiciones-anfitrion",
});

export default function CondicionesAnfitrion() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Condiciones para anfitriones</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Lo que se espera de quien publica. Forma parte de las{" "}
        <Link href="/condiciones-uso">condiciones de uso</Link>.
      </p>

      <section className="seccion-home">
        <h2>1. Veracidad de la ficha</h2>
        <p style={{ lineHeight: 1.7 }}>
          La información que publicas (descripción, ubicación, capacidad, servicios, precio y
          disponibilidad) debe ser <b>cierta y estar al día</b>. Si algo cambia, cámbialo tú desde tu
          panel en cuanto puedas.
        </p>
      </section>

      <section className="seccion-home">
        <h2>2. Disponibilidad</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Mantén el calendario actualizado para no aceptar noches que no puedes ofrecer.</li>
          <li>
            Si gestionas reservas en otro sitio, conecta tu calendario en formato iCal para evitar
            duplicidades.
          </li>
          <li>Si tienes que cancelar, avisa al huésped por correo lo antes posible.</li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>3. Precios y pago</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Publica solo precios que estés dispuesto a respetar.</li>
          <li>Si no quieres publicar precio, deja la ficha en «Consultar».</li>
          <li>
            <b>En Hestiat no hay comisión ni pasarela de pago</b>: el pago lo acuerdas con el huésped y
            Hestiat no interviene en él.
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>4. Fotos y contenido</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Solo puedes subir fotos de las que tengas derecho de uso, y deben corresponder a tu alojamiento.</li>
          <li>No se admiten fotos de otros establecimientos ni textos que induzcan a error.</li>
          <li>Lo que publicas sigue siendo tuyo; solo autorizas que se muestre mientras el anuncio esté activo.</li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>5. Trato con los huéspedes</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Responde a las solicitudes y consultas en un plazo razonable.</li>
          <li>Usa los datos del huésped solo para gestionar su reserva.</li>
          <li>Cumple la normativa que te corresponda como titular del alojamiento.</li>
        </ul>
      </section>

      <NotalLegal>
        Faltan dos cosas que dependen de ti, no de mí: la <b>política de cancelación</b> concreta (plazos
        y condiciones) y, si quieres que se apliquen, las <b>normas de la casa</b> que el huésped acepta
        al reservar. Dime los valores y los escribo.
      </NotalLegal>
    </main>
  );
}
