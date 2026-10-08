import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";
import NotaLegal from "@/components/nota-legal";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Cancelaciones y cambios de reserva — Hestiat",
  descripcion:
    "Qué hacer si necesitas cancelar o cambiar una reserva en Hestiat, cómo avisar al anfitrión y qué se puede gestionar hoy desde la plataforma.",
  ruta: "/cancelaciones",
});

export default function Cancelaciones() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Cancelaciones y cambios</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Lo que se puede hacer hoy, sin prometer lo que no existe.
      </p>

      <section className="seccion-home">
        <h2>Si tienes que cancelar</h2>
        <ol style={{ lineHeight: 1.9 }}>
          <li>
            <b>Avisa al anfitrión cuanto antes.</b> En el correo de confirmación tienes su dirección de
            contacto preparada para responderle.
          </li>
          <li>
            Si no encuentras ese correo, puedes consultar el estado de la reserva con su código en{" "}
            <Link href="/reserva">consultar reserva</Link>.
          </li>
          <li>
            Si algo va mal, escríbenos desde <Link href="/contacto">contacto</Link> con el código de la
            reserva.
          </li>
        </ol>
      </section>

      <section className="seccion-home">
        <h2>Lo que Hestiat no hace</h2>
        <p style={{ lineHeight: 1.7 }}>
          Hestiat no cobra la reserva ni retiene dinero: <b>no hay comisión ni pasarela de pago</b>, y el
          importe se acuerda con el anfitrión. Por eso no devolvemos ni retenemos importes: no pasan por
          nosotros. Las condiciones de cancelación (plazos y posibles gastos) las fija cada anfitrión.
        </p>
      </section>

      <section className="seccion-home">
        <h2>Si eres anfitrión y necesitas cancelar</h2>
        <p style={{ lineHeight: 1.7 }}>
          Avísale por correo lo antes posible y mantén el calendario al día en tu{" "}
          <Link href="/host">panel</Link>, para que no se puedan reservar noches que ya no ofreces.
        </p>
      </section>

      <NotalLegal>
        Una política de cancelación con plazos y condiciones concretas es una decisión tuya, no un dato
        que yo pueda inventar. Dime los plazos que quieres (por ejemplo, cancelación gratuita hasta X
        días antes) y los dejo escritos aquí, en las{" "}
        <Link href="/condiciones-anfitrion">condiciones para anfitriones</Link> y en las{" "}
        <Link href="/condiciones-uso">condiciones de uso</Link>.
      </NotalLegal>
    </main>
  );
}
