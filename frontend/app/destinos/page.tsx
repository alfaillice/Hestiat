import Link from "next/link";
import { ciudadesDestacadas } from "@/lib/seo.server";
import { metadatosInformativos } from "@/lib/paginas-info";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = metadatosInformativos({
  titulo: "Destinos para alojarse en España — Hestiat",
  descripcion:
    "Provincias y ciudades del catálogo de Hestiat con alojamientos publicados, con su recuento real, para entrar directamente a buscar en cada destino.",
  ruta: "/destinos",
});

/** Destinos con datos reales: provincias con alojamientos publicados y su recuento de verdad. */
export default async function Destinos() {
  const ciudades = await ciudadesDestacadas(48);
  let provincias: { provincia: string; total: number }[] = [];
  try {
    const [filas] = await pool.query<any[]>(
      `SELECT province AS provincia, COUNT(*) AS total FROM accommodation
        WHERE status = 'published' AND province IS NOT NULL AND province <> ''
        GROUP BY province ORDER BY total DESC LIMIT 60`,
    );
    provincias = filas.map((f) => ({ provincia: String(f.provincia), total: Number(f.total) }));
  } catch {
    provincias = [];
  }

  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 8 }}>Destinos</h1>
      <p className="m" style={{ color: "var(--muted-fg)", marginBottom: 20 }}>
        {provincias.length > 0
          ? `${provincias.length} provincias con alojamientos publicados, con su recuento real.`
          : "Explora el catálogo por destino."}
      </p>

      <h2 style={{ marginTop: 26 }}>Ciudades con contenido</h2>
      <p style={{ color: "var(--muted-fg)", fontSize: 14 }}>
        Páginas de ciudad con las fichas reales de alojamientos, experiencias y servicios de cada una.
      </p>
      <div className="f-chips" style={{ marginBottom: 18 }}>
        {ciudades.map((c) => (
          <Link className="f-chip" key={c.slug} href={`/destino/${c.slug}`}>
            {c.ciudad} <em>({c.total.toLocaleString("es-ES")})</em>
          </Link>
        ))}
      </div>

      {provincias.length === 0 ? (
        <p className="aviso">
          No se ha podido leer el listado ahora mismo. Puedes buscar igualmente desde{" "}
          <Link href="/search">Explorar alojamientos</Link>.
        </p>
      ) : (
        <div className="f-chips">
          {provincias.map((p) => (
            <Link className="f-chip" key={p.provincia} href={`/search?provincia=${encodeURIComponent(p.provincia)}`}>
              <span>
                {p.provincia} <em>({p.total.toLocaleString("es-ES")})</em>
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
