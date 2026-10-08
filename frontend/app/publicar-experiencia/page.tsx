import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";
import NotaLegal from "@/components/nota-legal";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Publicar una experiencia en Hestiat",
  descripcion:
    "Cómo aparecen las experiencias en Hestiat, de dónde salen sus datos y qué hacer si eres el organizador y quieres corregir o completar tu ficha.",
  ruta: "/publicar-experiencia",
});

export default function PublicarExperiencia() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Publicar una experiencia</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Visitas guiadas, museos, rutas, actividades y ocio en toda España.
      </p>

      <section className="seccion-home">
        <h2>Cómo funciona hoy</h2>
        <p style={{ lineHeight: 1.7 }}>
          Las experiencias del catálogo proceden, en su mayor parte, de <b>fuentes públicas</b>
          (OpenStreetMap y otras) y figuran con su autoría. El alta libre de experiencias por parte de
          organizadores <b>todavía no está abierta</b>: no vamos a poner un formulario que no lleve a
          ninguna parte.
        </p>
        <p style={{ lineHeight: 1.7 }}>
          Lo que sí puedes hacer ahora mismo:
        </p>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            Si tu experiencia <b>ya está en el catálogo</b>,{" "}
            <Link href="/reclamar">reclama su ficha</Link> para corregirla y completarla.
          </li>
          <li>
            Si no está, escríbenos desde <Link href="/contacto">contacto</Link> con los datos y la
            estudiamos para incorporarla.
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>Qué datos hacen falta</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Nombre real de la actividad y de quién la organiza.</li>
          <li>Ubicación exacta y municipio.</li>
          <li>Web oficial, teléfono y horario, si son públicos.</li>
          <li>Precio, solo si está publicado (si no, la ficha dirá «Consultar»).</li>
          <li>Fotos propias o con derecho de uso.</li>
        </ul>
      </section>

      <NotalLegal>
        El alta de experiencias por parte de sus organizadores está pendiente de desarrollo. Si quieres
        que sea la siguiente función que construya, dímelo y la preparo.
      </NotalLegal>
    </main>
  );
}
