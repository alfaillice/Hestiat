import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Normas de la comunidad — Hestiat",
  descripcion:
    "Las reglas de convivencia de Hestiat: respeto, información veraz, uso legítimo del catálogo y qué se considera un incumplimiento.",
  ruta: "/normas-comunidad",
});

export default function NormasComunidad() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Normas de la comunidad</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Poco y claro. Forman parte de las <Link href="/condiciones-uso">condiciones de uso</Link>.
      </p>

      <section className="seccion-home">
        <h2>Lo que se espera</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            <b>Información veraz.</b> Ni fichas inventadas, ni datos que no correspondan al sitio.
          </li>
          <li>
            <b>Respeto</b> en los mensajes y en el trato entre huéspedes, anfitriones y proveedores.
          </li>
          <li>
            <b>Fotos legítimas.</b> No se suben imágenes de otros sitios ni de las que no se tengan
            derechos.
          </li>
          <li>
            <b>Datos ajenos, para su reserva y nada más.</b> No se usa la información del huésped para
            otra cosa ni se reenvía a terceros.
          </li>
          <li>
            <b>Uso del catálogo sin abusos.</b> Extraer el catálogo de forma automatizada no está
            permitido.
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>Lo que no se permite</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Suplantar a otra persona, negocio o alojamiento.</li>
          <li>Publicar datos falsos sobre disponibilidad, precio o ubicación.</li>
          <li>Enviar publicidad no solicitada a otros usuarios.</li>
          <li>Intentar dañar, sobrecargar o acceder sin permiso a los sistemas del sitio.</li>
          <li>Usar Hestiat para actividades ilícitas.</li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>Qué pasa si se incumple</h2>
        <p style={{ lineHeight: 1.7 }}>
          Se avisa y se pide corregir. Si el incumplimiento continúa o es grave, se puede retirar el
          contenido o bloquear la cuenta. Si ves algo que no debería estar publicado —una ficha falsa,
          un precio engañoso, una foto que no corresponde—, avísanos en{" "}
          <Link href="/contacto">contacto</Link>: se revisa.
        </p>
      </section>
    </main>
  );
}
