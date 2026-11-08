import Link from "next/link";
import * as mysql from "mysql2/promise";
import { pool } from "@/lib/db";
import { metadatosInformativos } from "@/lib/paginas-info";
import FormularioAlta, { type CategoriaOpcion } from "@/components/formulario-alta";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Publicar una experiencia en Hestiat",
  descripcion:
    "Cómo aparecen las experiencias en Hestiat, de dónde salen sus datos y qué hacer si eres el organizador y quieres corregir o completar tu ficha.",
  ruta: "/publicar-experiencia",
});

export default async function PublicarExperiencia({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const aviso = (uno(sp.aviso) ?? "").slice(0, 200);
  const ok = (uno(sp.ok) ?? "") === "1";

  // Categorías REALES del catálogo, las mismas que ve el visitante en /experiencias.
  let categorias: CategoriaOpcion[] = [];
  try {
    const [filas] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT c.id, c.nombre, COUNT(*) AS n
         FROM exp_categoria c
         JOIN experiencia_clasificacion cl ON cl.categoria_id = c.id
        GROUP BY c.id, c.nombre ORDER BY n DESC`,
    );
    categorias = filas.map((f) => ({ id: Number(f.id), nombre: String(f.nombre) }));
  } catch {
    categorias = [];
  }

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

      <section className="seccion-home">
        <h2>Envía tu experiencia para revisión</h2>
        <p style={{ lineHeight: 1.7, marginBottom: 12 }}>
          Rellena lo que sepas: lo revisamos y, si todo cuadra, la publicamos en el catálogo. No entra
          directo, para que no se cuele nada que no corresponda.
        </p>
        <FormularioAlta
          tipo="experiencia"
          categorias={categorias}
          aviso={aviso ? { ok, texto: aviso } : ok ? { ok: true, texto: "Hemos recibido tu experiencia." } : null}
        />
      </section>
    </main>
  );
}
