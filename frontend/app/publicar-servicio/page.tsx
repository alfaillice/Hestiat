import Link from "next/link";
import { metadatosInformativos } from "@/lib/paginas-info";
import NotaLegal from "@/components/nota-legal";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Publicar un servicio en Hestiat",
  descripcion:
    "Cómo aparecen los servicios en Hestiat, de dónde salen sus datos y qué hacer si eres el proveedor y quieres corregir, completar o reclamar tu ficha.",
  ruta: "/publicar-servicio",
});

export default function PublicarServicio() {
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: "76ch" }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Publicar un servicio</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 22 }}>
        Peluquerías, bienestar, deporte, mascotas, transporte, hogar y mucho más.
      </p>

      <section className="seccion-home">
        <h2>Cómo funciona hoy</h2>
        <p style={{ lineHeight: 1.7 }}>
          Los 35.585 servicios del catálogo proceden de <b>fuentes públicas</b> y figuran con su autoría.
          El alta libre por parte de proveedores <b>todavía no está abierta</b>, y no vamos a publicar un
          formulario que no sirva de nada.
        </p>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            Si tu negocio <b>ya está en el catálogo</b>,{" "}
            <Link href="/reclamar">reclama su ficha</Link> para corregirla y completarla.
          </li>
          <li>
            Si no está, escríbenos desde <Link href="/contacto">contacto</Link> y lo estudiamos.
          </li>
        </ul>
      </section>

      <section className="seccion-home">
        <h2>Qué datos hacen falta</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>Nombre del negocio, actividad concreta y categoría.</li>
          <li>Dirección y municipio.</li>
          <li>Web oficial, teléfono y horario, si son públicos.</li>
          <li>Precio o tarifa, solo si está publicada.</li>
          <li>Fotos propias o con derecho de uso.</li>
        </ul>
      </section>

      <NotalLegal>
        El alta de servicios por parte de sus proveedores está pendiente de desarrollo. Dime si quieres
        que sea lo siguiente y lo preparo.
      </NotalLegal>
    </main>
  );
}
