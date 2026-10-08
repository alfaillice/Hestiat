import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Hazte anfitrión en Hestiat — publica tu alojamiento",
  descripcion:
    "Publica tu alojamiento en Hestiat: sin coste por publicar, con panel propio, calendario, precios, fotos, reservas e importación del calendario en formato iCal.",
  ruta: "/hazte-anfitrion",
});

export default function HazteAnfitrion() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Hazte anfitrión</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Publica tu alojamiento y gestiónalo tú, sin intermediarios en el cobro.
      </p>

      <section className="seccion-home">
        <h2>Qué tienes al publicar</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            <b>Sin coste por publicar</b> y sin comisión: el pago lo acuerdas con el huésped.
          </li>
          <li>
            <b>Panel propio</b> con el calendario de disponibilidad, precios, fotos y reservas.
          </li>
          <li>
            <b>Aviso por correo de cada reserva</b>, con los datos de contacto del huésped para poder
            responderle.
          </li>
          <li>
            <b>Conexión con tu calendario</b> (importar y exportar en formato iCal) para no vender dos
            veces la misma noche.
          </li>
          <li>
            <b>Sin posiciones de pago</b>: tu ficha se ordena por datos, no por quién paga más.
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>Qué necesitas</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Un correo electrónico para crear la cuenta y confirmarla.</li>
          <li>Los datos del alojamiento: ubicación, capacidad y cómo se llega.</li>
          <li>Fotos de las que tengas derecho de uso: no valen imágenes de otros sitios.</li>
          <li>El precio por noche, si quieres publicarlo (si no, la ficha dirá «Consultar»).</li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>Cómo se publica</h2>
        <ol style={{ lineHeight: 1.9 }}>
          <li>
            Entra en <Link href="/nuevo">publicar alojamiento</Link> y rellena la ficha.
          </li>
          <li>Confirma tu correo con el enlace que te enviamos.</li>
          <li>
            Gestiona todo desde tu <Link href="/host">panel de anfitrión</Link>.
          </li>
        </ol>
        <p style={{ lineHeight: 1.7 }}>
          Y si tu alojamiento <b>ya está en el catálogo</b> (porque procede de fuentes públicas), no lo
          dupliques: <Link href="/reclamar">reclama la ficha</Link> y te damos acceso para completarla y
          corregirla.
        </p>
      </section>

      <p style={{ marginTop: 26 }}>
        Las reglas están en las <Link href="/condiciones-anfitrion">condiciones para anfitriones</Link> y
        en las <Link href="/condiciones-uso">condiciones de uso</Link>.
      </p>
    </main>
  );
}
