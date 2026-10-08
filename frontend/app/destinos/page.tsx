import Link from "next/link";
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
