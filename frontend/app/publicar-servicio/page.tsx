import Link from "next/link";
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";
import { metadatosInformativos } from "@/lib/paginas-info";
import FormularioAlta, { type CategoriaOpcion } from "@/components/formulario-alta";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Publicar un servicio en Hestiat",
  descripcion:
    "Cómo aparecen los servicios en Hestiat, de dónde salen sus datos y qué hacer si eres el proveedor y quieres corregir, completar o reclamar tu ficha.",
  ruta: "/publicar-servicio",
});

export default async function PublicarServicio({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const aviso = (uno(sp.aviso) ?? "").slice(0, 200);
  const ok = (uno(sp.ok) ?? "") === "1";

  // Categorías REALES del catálogo, las mismas que ve el visitante en /servicios.
  let categorias: CategoriaOpcion[] = [];
  try {
    const [filas] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT c.id, c.nombre, COUNT(*) AS n
         FROM serv_categoria c
         JOIN servicio_clasificacion cl ON cl.categoria_id = c.id
        GROUP BY c.id, c.nombre ORDER BY n DESC`,
    );
    categorias = filas.map((f) => ({ id: Number(f.id), nombre: String(f.nombre) }));
  } catch {
    categorias = [];
  }

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

      <section className="seccion-home">
        <h2>Envía tu servicio para revisión</h2>
        <p style={{ lineHeight: 1.7, marginBottom: 12 }}>
          Rellena lo que sepas: lo revisamos y, si todo cuadra, lo publicamos en el catálogo. No entra
          directo, para que no se cuele nada que no corresponda.
        </p>
        <FormularioAlta
          tipo="servicio"
          categorias={categorias}
          aviso={aviso ? { ok, texto: aviso } : ok ? { ok: true, texto: "Hemos recibido tu servicio." } : null}
        />
      </section>
    </main>
  );
}
